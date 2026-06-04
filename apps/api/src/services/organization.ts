import { customAlphabet } from 'nanoid';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { enforceOrganizationQuota } from './quotas.js';
import { generateInviteCode, normalizeInviteCode } from './orgInvites.js';

const orgCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

/**
 * 列出用户所属的所有组织
 * @param userId - 用户ID
 * @returns 包含组织和角色信息的成员列表
 */
export const listUserOrganizations = async (userId: string) => {
  return prisma.orgMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          code: true,
          inviteCode: true,
          description: true,
          ownerId: true,
        },
      },
      role: true,
    },
  });
};

/**
 * 创建新组织
 * @param data - 组织创建数据，包含名称、描述和创建者用户ID
 * @returns 新创建的组织
 */
export const createOrganization = async (data: {
  name: string;
  description?: string;
  userId: string;
}) => {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: 'owner' },
  });
  return prisma.organization.create({
    data: {
      name: data.name,
      description: data.description,
      code: orgCode(),
      inviteCode: generateInviteCode(),
      ownerId: data.userId,
      members: { create: { userId: data.userId, roleId: role.id } },
    },
  });
};

/**
 * 通过邀请码查找组织
 * @param inviteCode - 邀请码
 * @returns 组织信息，未找到时返回 null
 */
export const findOrganizationByInviteCode = async (inviteCode: string) => {
  return prisma.organization.findUnique({
    where: { inviteCode: normalizeInviteCode(inviteCode) },
  });
};

/**
 * 查找组织中的特定成员
 * @param organizationId - 组织ID
 * @param userId - 用户ID
 * @returns 成员信息，未找到时返回 null
 */
export const findOrgMember = async (organizationId: string, userId: string) => {
  return prisma.orgMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });
};

/**
 * 用户加入组织
 * @param data - 加入组织所需数据，包含组织ID和用户ID
 * @returns 加入后的成员信息
 */
export const joinOrganization = async (data: {
  organizationId: string;
  userId: string;
}) => {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: 'readonly' },
  });

  return prisma.$transaction(async (tx) => {
    const existingMember = await tx.orgMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: data.organizationId,
          userId: data.userId,
        },
      },
    });
    if (existingMember?.status === 'ACTIVE')
      throw new HttpError(400, '不能重复加入同一个组织');

    await enforceOrganizationQuota(
      tx,
      data.organizationId,
      'member',
      async () => {
        const activeMemberCount = await tx.orgMember.count({
          where: { organizationId: data.organizationId, status: 'ACTIVE' },
        });
        return activeMemberCount + 1;
      }
    );

    return tx.orgMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: data.organizationId,
          userId: data.userId,
        },
      },
      create: {
        organizationId: data.organizationId,
        userId: data.userId,
        roleId: role.id,
      },
      update: { status: 'ACTIVE' },
    });
  });
};

/**
 * 通过ID获取组织信息
 * @param organizationId - 组织ID
 * @returns 组织信息
 */
export const getOrganizationById = async (organizationId: string) => {
  return prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
};

/**
 * 刷新组织的邀请码
 * @param organizationId - 组织ID
 * @returns 更新后的组织信息
 */
export const refreshOrganizationInviteCode = async (organizationId: string) => {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { inviteCode: generateInviteCode() },
  });
};

/**
 * 列出所有启用的套餐计划
 * @returns 套餐计划列表
 */
export const listPlans = async () => {
  return prisma.plan.findMany({
    where: { enabled: true },
    orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
  });
};

/**
 * 获取组织的当前有效订阅
 * @param organizationId - 组织ID
 * @returns 订阅信息，未找到时返回 null
 */
export const getOrganizationSubscription = async (organizationId: string) => {
  return prisma.subscription.findFirst({
    where: {
      organizationId,
      active: true,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    include: { plan: true },
    orderBy: { startsAt: 'desc' },
  });
};

/**
 * 获取组织的使用情况统计
 * @param organizationId - 组织ID
 * @returns 组织的公寓数和成员数统计
 */
export const getOrganizationUsage = async (organizationId: string) => {
  return prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { _count: { select: { apartments: true, members: true } } },
  });
};

/**
 * 列出组织的配额包
 * @param organizationId - 组织ID
 * @returns 配额包列表
 */
export const listOrgQuotaPackages = async (organizationId: string) => {
  return prisma.orgQuotaPackage.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * 通过ID查找套餐计划
 * @param planId - 套餐ID
 * @returns 套餐信息，未找到时返回 null
 */
export const findPlanById = async (planId: string) => {
  return prisma.plan.findUnique({ where: { id: planId } });
};

/**
 * 为组织创建新的订阅
 * @param data - 订阅创建数据，包含组织ID和套餐ID
 * @returns 新创建的订阅信息
 */
export const createSubscription = async (data: {
  organizationId: string;
  planId: string;
}) => {
  return prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { organizationId: data.organizationId, active: true },
      data: { active: false, endsAt: new Date() },
    });
    return tx.subscription.create({
      data: {
        organizationId: data.organizationId,
        planId: data.planId,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });
  });
};

/**
 * 更新组织信息
 * @param organizationId - 组织ID
 * @param data - 更新的数据，包含名称和/或描述
 * @returns 更新后的组织信息
 */
export const updateOrganization = async (
  organizationId: string,
  data: { name?: string; description?: string }
) => {
  return prisma.organization.update({
    where: { id: organizationId },
    data,
  });
};

/**
 * 获取组织信息及其活跃订阅
 * @param organizationId - 组织ID
 * @returns 包含活跃订阅的组织信息
 */
export const getOrganizationWithSubscriptions = async (
  organizationId: string
) => {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscriptions: { where: { active: true } } },
  });
};

/**
 * 软删除组织
 * @param organizationId - 组织ID
 * @returns 更新后的组织信息
 */
export const softDeleteOrganization = async (organizationId: string) => {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { status: 'DELETED' },
  });
};

/**
 * 列出所有角色
 * @returns 角色列表
 */
export const listRoles = async () => {
  return prisma.role.findMany({
    orderBy: [{ system: 'desc' }, { createdAt: 'asc' }],
  });
};

/**
 * 列出组织的所有成员
 * @param organizationId - 组织ID
 * @returns 成员列表，包含用户信息和角色
 */
export const listOrgMembers = async (organizationId: string) => {
  return prisma.orgMember.findMany({
    where: { organizationId },
    include: {
      user: { select: { id: true, phone: true, username: true } },
      role: true,
    },
  });
};

/**
 * 获取成员信息及其角色
 * @param memberId - 成员ID
 * @returns 包含角色信息的成员详情
 */
export const getOrgMemberWithRole = async (memberId: string) => {
  return prisma.orgMember.findUniqueOrThrow({
    where: { id: memberId },
    include: { role: true },
  });
};

/**
 * 禁用组织成员
 * @param memberId - 成员ID
 * @returns 更新后的成员信息
 */
export const disableOrgMember = async (memberId: string) => {
  return prisma.orgMember.update({
    where: { id: memberId },
    data: { status: 'DISABLED' },
  });
};

/**
 * 更新组织成员的角色
 * @param memberId - 成员ID
 * @param roleId - 新角色ID
 * @returns 更新后的成员信息
 */
export const updateOrgMemberRole = async (memberId: string, roleId: string) => {
  return prisma.orgMember.update({
    where: { id: memberId },
    data: { roleId },
  });
};

/**
 * 通过角色编码查找角色
 * @param code - 角色编码
 * @returns 角色信息
 */
export const findRoleByCode = async (code: string) => {
  return prisma.role.findUniqueOrThrow({ where: { code } });
};

/**
 * 转移组织所有权
 * @param data - 转移数据，包含组织ID、原所有者用户ID和新所有者用户ID
 * @returns 无返回值
 */
export const transferOrganizationOwnership = async (data: {
  organizationId: string;
  fromUserId: string;
  toUserId: string;
}) => {
  const ownerRole = await findRoleByCode('owner');
  const managerRole = await findRoleByCode('manager');

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: data.organizationId },
      data: { ownerId: data.toUserId },
    }),
    prisma.orgMember.update({
      where: {
        organizationId_userId: {
          organizationId: data.organizationId,
          userId: data.fromUserId,
        },
      },
      data: { roleId: managerRole.id },
    }),
    prisma.orgMember.update({
      where: {
        organizationId_userId: {
          organizationId: data.organizationId,
          userId: data.toUserId,
        },
      },
      data: { roleId: ownerRole.id },
    }),
  ]);
};
