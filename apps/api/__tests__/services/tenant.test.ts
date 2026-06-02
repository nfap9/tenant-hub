import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTenant = {
  id: 'tenant-1',
  organizationId: 'org-1',
  name: '张三',
  phone: '13800000000',
  idCard: '110101199001011234',
  emergencyContact: '李四',
  emergencyPhone: '13900000000',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockLease = {
  id: 'lease-1',
  tenantId: 'tenant-1',
  roomId: 'room-1',
  status: 'ACTIVE',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  room: {
    id: 'room-1',
    name: '101',
    apartment: { id: 'apt-1', name: '阳光公寓' },
  },
  fees: [],
  deposit: null,
  settlement: null,
  createdAt: new Date('2026-01-01'),
};

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    lease: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import {
  findOrCreateTenant,
  syncTenantDisplayFields,
  getTenantLeaseHistory,
} from '../../src/services/tenant.js';
import { prisma } from '../../src/prisma/client.js';

describe('tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findOrCreateTenant', () => {
    it('should return existing tenant if found with same name', async () => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTenant
      );

      const result = await findOrCreateTenant('org-1', '张三', '13800000000');

      expect(result).toEqual(mockTenant);
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_phone: {
            organizationId: 'org-1',
            phone: '13800000000',
          },
        },
      });
      expect(prisma.tenant.update).not.toHaveBeenCalled();
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('should update name if existing tenant has different name', async () => {
      const existingDifferent = { ...mockTenant, name: '李四' };
      const updatedTenant = {
        ...mockTenant,
        name: '张三',
        idCard: '110101199001011234',
      };
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        existingDifferent
      );
      (prisma.tenant.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        updatedTenant
      );

      const result = await findOrCreateTenant('org-1', '张三', '13800000000', {
        idCard: '110101199001011234',
      });

      expect(result).toEqual(updatedTenant);
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { name: '张三', idCard: '110101199001011234' },
      });
    });

    it('should create a new tenant if not found', async () => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (prisma.tenant.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTenant
      );

      const result = await findOrCreateTenant('org-1', '张三', '13800000000');

      expect(result).toEqual(mockTenant);
      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: { organizationId: 'org-1', name: '张三', phone: '13800000000' },
      });
    });

    it('should create with extra fields', async () => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (prisma.tenant.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTenant
      );

      await findOrCreateTenant('org-1', '张三', '13800000000', {
        idCard: '110101199001011234',
        emergencyContact: '李四',
        emergencyPhone: '13900000000',
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          name: '张三',
          phone: '13800000000',
          idCard: '110101199001011234',
          emergencyContact: '李四',
          emergencyPhone: '13900000000',
        },
      });
    });
  });

  describe('syncTenantDisplayFields', () => {
    it('should update display fields on active leases', async () => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTenant
      );
      (prisma.lease.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 2,
      });

      await syncTenantDisplayFields('tenant-1');

      expect(prisma.lease.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'ACTIVE' },
        data: { tenantName: '张三', tenantPhone: '13800000000' },
      });
    });

    it('should do nothing if tenant not found', async () => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await syncTenantDisplayFields('tenant-missing');

      expect(prisma.lease.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getTenantLeaseHistory', () => {
    it('should return lease history with includes', async () => {
      (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockLease,
      ]);

      const result = await getTenantLeaseHistory('tenant-1');

      expect(result).toEqual([mockLease]);
      expect(prisma.lease.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        include: {
          room: { include: { apartment: true } },
          fees: true,
          deposit: true,
          settlement: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array for tenant with no leases', async () => {
      (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getTenantLeaseHistory('tenant-1');

      expect(result).toEqual([]);
    });
  });
});
