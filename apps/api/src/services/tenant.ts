import { prisma } from '../config/prisma.js';

export const findOrCreateTenant = async (
  organizationId: string,
  name: string,
  phone: string,
  extra?: {
    idCard?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  }
) => {
  const existing = await prisma.tenant.findUnique({
    where: { organizationId_phone: { organizationId, phone } },
  });
  if (existing) {
    if (name && existing.name !== name) {
      return prisma.tenant.update({
        where: { id: existing.id },
        data: { name, ...extra },
      });
    }
    return existing;
  }
  return prisma.tenant.create({
    data: { organizationId, name, phone, ...extra },
  });
};

export const syncTenantDisplayFields = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) return;
  await prisma.lease.updateMany({
    where: { tenantId, status: 'ACTIVE' },
    data: { tenantName: tenant.name, tenantPhone: tenant.phone },
  });
};

export const getTenantLeaseHistory = async (tenantId: string) => {
  return prisma.lease.findMany({
    where: { tenantId },
    include: {
      room: { include: { apartment: true } },
      fees: true,
      deposit: true,
      settlement: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};
