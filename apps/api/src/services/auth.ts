import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import { generateInviteCode } from './orgInvites.js';

export const getSmsConfigured = async (): Promise<boolean> => {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'sms_config' },
  });
  const value = setting?.value as Record<string, unknown> | undefined;
  return Boolean(value?.enabled && value?.url);
};

export const getSmsConfig = async () => {
  const smsConfig = await prisma.systemSetting.findUnique({
    where: { key: 'sms_config' },
  });
  const parsedConfig = smsConfig?.value
    ? (smsConfig.value as Record<string, unknown>)
    : null;

  if (!parsedConfig?.url) return null;

  return {
    enabled: Boolean(parsedConfig.enabled),
    url: String(parsedConfig.url),
    method: (parsedConfig.method === 'GET' ||
    parsedConfig.method === 'POST' ||
    parsedConfig.method === 'PUT'
      ? parsedConfig.method
      : 'POST') as 'GET' | 'POST' | 'PUT',
    headers:
      typeof parsedConfig.headers === 'object' && parsedConfig.headers !== null
        ? (parsedConfig.headers as Record<string, string>)
        : undefined,
    queryParams:
      typeof parsedConfig.queryParams === 'object' &&
      parsedConfig.queryParams !== null
        ? (parsedConfig.queryParams as Record<string, string>)
        : undefined,
    bodyParams:
      typeof parsedConfig.bodyParams === 'object' &&
      parsedConfig.bodyParams !== null
        ? (parsedConfig.bodyParams as Record<string, string>)
        : undefined,
  };
};

export const createOtpCode = async (data: {
  phone: string;
  purpose: 'REGISTER' | 'LOGIN';
  code: string;
}) => {
  return prisma.otpCode.create({
    data: {
      phone: data.phone,
      purpose: data.purpose,
      codeHash: await bcrypt.hash(data.code, env.BCRYPT_OTP_SALT_ROUNDS),
      expiresAt: new Date(Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000),
    },
  });
};

export const verifyOtpCode = async (
  phone: string,
  code: string,
  purpose: 'REGISTER' | 'LOGIN'
) => {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new HttpError(400, '验证码已失效');
  const matched = await bcrypt.compare(code, otp.codeHash);
  if (!matched) throw new HttpError(400, '验证码不正确');
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });
};

export const findUserByPhone = async (phone: string) => {
  return prisma.user.findUnique({ where: { phone } });
};

export const isFirstUser = async () => {
  const count = await prisma.user.count();
  return count === 0;
};

export const createUser = async (data: {
  phone: string;
  username: string;
  password: string;
  platformRole?: 'USER' | 'SUPER_ADMIN';
}) => {
  return prisma.user.create({
    data: {
      phone: data.phone,
      username: data.username,
      passwordHash: await bcrypt.hash(
        data.password,
        env.BCRYPT_PASSWORD_SALT_ROUNDS
      ),
      platformRole: data.platformRole || 'USER',
    },
    select: { id: true, phone: true, username: true, platformRole: true },
  });
};

export const verifyPassword = async (userId: string, password: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });
  const matched = await bcrypt.compare(password, user.passwordHash);
  return { matched, user };
};

export const updateUserPassword = async (
  userId: string,
  newPassword: string
) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(
        newPassword,
        env.BCRYPT_PASSWORD_SALT_ROUNDS
      ),
      passwordChangedAt: new Date(),
    },
  });
};

export const getUserWithMemberships = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, phone: true, username: true, platformRole: true },
  });
  const memberships = await prisma.orgMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true, role: true },
  });

  // 为没有 inviteCode 的组织自动生成邀请码
  await Promise.all(
    memberships
      .filter((m) => !m.organization.inviteCode)
      .map(async (m) => {
        const newCode = generateInviteCode();
        await prisma.organization.update({
          where: { id: m.organization.id },
          data: { inviteCode: newCode },
        });
        m.organization.inviteCode = newCode;
      })
  );

  return { user, memberships };
};
