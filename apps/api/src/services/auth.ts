import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import { generateInviteCode } from './orgInvites.js';

/**
 * 检查短信服务是否已配置
 * @returns 是否已配置短信服务
 */
export const getSmsConfigured = async (): Promise<boolean> => {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'sms_config' },
  });
  const value = setting?.value as Record<string, unknown> | undefined;
  return Boolean(value?.enabled && value?.url);
};

/**
 * 获取短信服务配置
 * @returns 短信配置对象，若未配置则返回 null
 */
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

/**
 * 创建验证码记录
 * @param data - 包含手机号、用途和验证码的数据对象
 * @param data.phone - 用户手机号
 * @param data.purpose - 验证码用途（REGISTER 或 LOGIN）
 * @param data.code - 原始验证码
 * @returns 创建的验证码记录
 */
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

/**
 * 校验验证码是否有效
 * @param phone - 用户手机号
 * @param code - 用户输入的验证码
 * @param purpose - 验证码用途（REGISTER 或 LOGIN）
 * @returns 无返回值，校验失败时抛出 HttpError
 */
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

/**
 * 根据手机号查找用户
 * @param phone - 用户手机号
 * @returns 查找到的用户对象，未找到则返回 null
 */
export const findUserByPhone = async (phone: string) => {
  return prisma.user.findUnique({ where: { phone } });
};

/**
 * 检查当前是否为首个注册用户
 * @returns 若系统中尚无用户则返回 true，否则返回 false
 */
export const isFirstUser = async () => {
  const count = await prisma.user.count();
  return count === 0;
};

/**
 * 创建新用户
 * @param data - 用户注册信息
 * @param data.phone - 用户手机号
 * @param data.username - 用户名
 * @param data.password - 原始密码（会自动哈希存储）
 * @param data.platformRole - 平台角色，默认为 USER
 * @returns 创建的用户基本信息（id、phone、username、platformRole）
 */
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

/**
 * 校验用户密码是否正确
 * @param userId - 用户 ID
 * @param password - 原始密码
 * @returns 包含匹配结果和用户对象
 */
export const verifyPassword = async (userId: string, password: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });
  const matched = await bcrypt.compare(password, user.passwordHash);
  return { matched, user };
};

/**
 * 更新用户密码
 * @param userId - 用户 ID
 * @param newPassword - 新密码（会自动哈希存储）
 * @returns 更新后的用户记录
 */
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

/**
 * 获取用户及其所属组织成员信息
 * @param userId - 用户 ID
 * @returns 包含用户基本信息和活跃组织成员关系的对象
 */
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
