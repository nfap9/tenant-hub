import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { generateInviteCode } from './orgInvites.js';

/**
 * 根据手机号查找用户
 */
export const findUserByPhone = async (phone: string) => {
  return prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      username: true,
      systemRole: true,
      passwordHash: true,
    },
  });
};

/**
 * 检查当前是否为首个注册用户
 */
export const isFirstUser = async () => {
  const count = await prisma.user.count();
  return count === 0;
};

/**
 * 创建新用户。首个注册用户自动成为系统管理员。
 */
export const createUser = async (data: {
  phone: string;
  username: string;
  password: string;
}) => {
  const isFirst = await isFirstUser();
  return prisma.user.create({
    data: {
      phone: data.phone,
      username: data.username,
      passwordHash: await bcrypt.hash(
        data.password,
        env.BCRYPT_PASSWORD_SALT_ROUNDS
      ),
      systemRole: isFirst ? 'SYSTEM_ADMIN' : null,
    },
    select: { id: true, phone: true, username: true, systemRole: true },
  });
};

/**
 * 校验用户密码是否正确
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
 * 获取用户及其所属组织成员信息（含系统角色）
 */
export const getUserWithMemberships = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, phone: true, username: true, systemRole: true },
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
