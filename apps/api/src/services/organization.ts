import { customAlphabet } from 'nanoid';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { enforceOrganizationQuota } from './quotas.js';
import { generateInviteCode, normalizeInviteCode } from './orgInvites.js';

const orgCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

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

export const findOrganizationByInviteCode = async (inviteCode: string) => {
  return prisma.organization.findUnique({
    where: { inviteCode: normalizeInviteCode(inviteCode) },
  });
};

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

export const getOrganizationById = async (organizationId: string) => {
  return prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
};

export const refreshOrganizationInviteCode = async (organizationId: string) => {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { inviteCode: generateInviteCode() },
  });
};

export const listPlans = async () => {
  return prisma.plan.findMany({
    where: { enabled: true },
    orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
  });
};

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

export const getOrganizationUsage = async (organizationId: string) => {
  return prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { _count: { select: { apartments: true, members: true } } },
  });
};

export const listOrgQuotaPackages = async (organizationId: string) => {
  return prisma.orgQuotaPackage.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
};

export const findPlanById = async (planId: string) => {
  return prisma.plan.findUnique({ where: { id: planId } });
};

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

export const updateOrganization = async (
  organizationId: string,
  data: { name?: string; description?: string }
) => {
  return prisma.organization.update({
    where: { id: organizationId },
    data,
  });
};

export const getOrganizationWithSubscriptions = async (
  organizationId: string
) => {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscriptions: { where: { active: true } } },
  });
};

export const softDeleteOrganization = async (organizationId: string) => {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { status: 'DELETED' },
  });
};

export const listRoles = async () => {
  return prisma.role.findMany({
    orderBy: [{ system: 'desc' }, { createdAt: 'asc' }],
  });
};

export const listOrgMembers = async (organizationId: string) => {
  return prisma.orgMember.findMany({
    where: { organizationId },
    include: {
      user: { select: { id: true, phone: true, username: true } },
      role: true,
    },
  });
};

export const getOrgMemberWithRole = async (memberId: string) => {
  return prisma.orgMember.findUniqueOrThrow({
    where: { id: memberId },
    include: { role: true },
  });
};

export const disableOrgMember = async (memberId: string) => {
  return prisma.orgMember.update({
    where: { id: memberId },
    data: { status: 'DISABLED' },
  });
};

export const updateOrgMemberRole = async (memberId: string, roleId: string) => {
  return prisma.orgMember.update({
    where: { id: memberId },
    data: { roleId },
  });
};

export const findRoleByCode = async (code: string) => {
  return prisma.role.findUniqueOrThrow({ where: { code } });
};

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
