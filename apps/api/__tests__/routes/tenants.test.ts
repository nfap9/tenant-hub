import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-123456789',
    JWT_EXPIRES_IN: '7d',
    NODE_ENV: 'test',
  },
  corsOrigins: ['http://localhost:5173'],
}));

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === 'function') {
        return arg({
          accountTransaction: { create: vi.fn() },
          tenantAccount: { update: vi.fn() },
        });
      }
      for (const p of arg) await p;
    }),
    tenant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(async ({ where }: any) => ({
        id: where.id,
        deletedAt: new Date(),
      })),
    },
    lease: {
      count: vi.fn(),
    },
    accountTransaction: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    tenantAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(async () => ({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
      })),
    },
    orgMember: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/tenant.js', () => ({
  syncTenantDisplayFields: vi.fn(async () => {}),
}));

vi.mock('../../src/services/tenantAccount.js', () => ({
  getAccountBalance: vi.fn(async () => ({
    prepaidBalance: 0,
    depositBalance: 0,
    totalUnpaid: 0,
    netBalance: 0,
    lastCalculatedAt: new Date(),
  })),
  adjustAccount: vi.fn(async () => ({
    id: 'tx-1',
    type: 'ADJUSTMENT',
    amount: 100,
    balanceAfter: 100,
  })),
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';
import {
  getAccountBalance,
  adjustAccount,
} from '../../src/services/tenantAccount.js';
import { syncTenantDisplayFields } from '../../src/services/tenant.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('tenants routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/tenants', () => {
    it('should return tenants for organization', async () => {
      (prisma.tenant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'tenant-1',
          name: '张三',
          phone: '13800138000',
          _count: { leases: 1 },
          account: null,
        },
      ]);

      const res = await request(app)
        .get('/api/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('tenant-1');
      expect(res.body.data[0].name).toBe('张三');
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', deletedAt: null },
          include: {
            _count: { select: { leases: true } },
            account: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/tenants');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/tenants', () => {
    it('should create a tenant', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (prisma.tenant.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
        name: '张三',
        phone: '13800138000',
        account: null,
      });

      const res = await request(app)
        .post('/api/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '张三', phone: '13800138000' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('tenant-1');
      expect(res.body.data.name).toBe('张三');
      expect(res.body.data.phone).toBe('13800138000');
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phone: '13800138000',
            organizationId: 'org-1',
          }),
        })
      );
      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '张三',
            phone: '13800138000',
            organizationId: 'org-1',
          }),
          include: { account: true },
        })
      );
    });

    it('should return 409 if phone already exists', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
        phone: '13800138000',
      });

      const res = await request(app)
        .post('/api/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '张三', phone: '13800138000' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('该手机号已存在');
    });
  });

  describe('GET /api/tenants/search', () => {
    it('should search tenants by phone', async () => {
      (prisma.tenant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'tenant-1', name: '张三', phone: '13800138000' },
      ]);

      const res = await request(app)
        .get('/api/tenants/search')
        .query({ phone: '1380013' })
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].phone).toBe('13800138000');
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            deletedAt: null,
            phone: { contains: '1380013' },
          }),
          select: { id: true, name: true, phone: true, idCard: true },
          take: 10,
        })
      );
    });

    it('should search tenants by name', async () => {
      (prisma.tenant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'tenant-1', name: '张三', phone: '13800138000' },
      ]);

      const res = await request(app)
        .get('/api/tenants/search')
        .query({ name: '张三' })
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data[0].name).toBe('张三');
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            deletedAt: null,
            name: { contains: '张三' },
          }),
          select: { id: true, name: true, phone: true, idCard: true },
          take: 10,
        })
      );
    });
  });

  describe('GET /api/tenants/:id', () => {
    it('should return tenant detail', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
        name: '张三',
        phone: '13800138000',
        account: { id: 'acc-1', netBalance: 0 },
        leases: [
          {
            id: 'lease-1',
            room: {
              id: 'room-1',
              roomNo: '101',
              apartment: { id: 'apt-1', name: '阳光公寓' },
            },
            fees: [],
            deposit: null,
            settlement: null,
          },
        ],
      });

      const res = await request(app)
        .get('/api/tenants/tenant-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('tenant-1');
      expect(res.body.data.name).toBe('张三');
      expect(res.body.data.account).toBeDefined();
      expect(Array.isArray(res.body.data.leases)).toBe(true);
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1', organizationId: 'org-1' },
          include: expect.objectContaining({
            account: true,
            leases: expect.objectContaining({
              include: expect.objectContaining({
                room: expect.objectContaining({
                  include: { apartment: true },
                }),
                fees: true,
                deposit: true,
                settlement: true,
              }),
            }),
          }),
        })
      );
    });

    it('should return 404 for non-existent tenant', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/tenants/tenant-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租客不存在');
    });
  });

  describe('PUT /api/tenants/:id', () => {
    it('should update a tenant', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
      });
      (prisma.tenant.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
        name: '张三(改)',
        phone: '13800138000',
        coResidents: [],
        account: null,
      });

      const res = await request(app)
        .put('/api/tenants/tenant-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '张三(改)' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('张三(改)');
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1' },
          data: { name: '张三(改)' },
          include: { coResidents: true, account: true },
        })
      );
      expect(syncTenantDisplayFields).toHaveBeenCalledWith('tenant-1');
    });

    it('should return 404 for non-existent tenant', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .put('/api/tenants/tenant-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名字' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租客不存在');
    });
  });

  describe('DELETE /api/tenants/:id', () => {
    it('should soft delete a tenant without active leases', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
      });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.tenant.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
        deletedAt: new Date(),
      });

      const res = await request(app)
        .delete('/api/tenants/tenant-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.lease.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', status: 'ACTIVE' },
        })
      );
      expect(prisma.tenant.softDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tenant-1' } })
      );
    });

    it('should reject deleting tenant with active leases', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
      });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const res = await request(app)
        .delete('/api/tenants/tenant-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('租客仍有进行中的租约，无法删除');
    });

    it('should return 404 for non-existent tenant', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .delete('/api/tenants/tenant-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租客不存在');
    });
  });

  describe('GET /api/tenants/:id/account', () => {
    it('should return account balance', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
      });

      const res = await request(app)
        .get('/api/tenants/tenant-1/account')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('netBalance');
      expect(res.body.data).toHaveProperty('prepaidBalance');
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1', organizationId: 'org-1' },
        })
      );
      expect(getAccountBalance).toHaveBeenCalledWith('tenant-1');
    });

    it('should return 404 for non-existent tenant', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/tenants/tenant-1/account')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租客不存在');
    });
  });

  describe('GET /api/tenants/:id/account/transactions', () => {
    it('should return paginated transactions', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
        account: { id: 'acc-1' },
      });
      (
        prisma.accountTransaction.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 'tx-1', amount: 100, type: 'CHARGE' }]);
      (
        prisma.accountTransaction.count as ReturnType<typeof vi.fn>
      ).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/tenants/tenant-1/account/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1', organizationId: 'org-1' },
          include: { account: true },
        })
      );
      expect(prisma.accountTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantAccountId: 'acc-1' },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        })
      );
      expect(prisma.accountTransaction.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantAccountId: 'acc-1' },
        })
      );
    });

    it('should return empty when tenant has no account', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
        account: null,
      });

      const res = await request(app)
        .get('/api/tenants/tenant-1/account/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    it('should return 404 for non-existent tenant', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/tenants/tenant-1/account/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/tenants/:id/account/adjust', () => {
    it('should adjust account balance', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
      });

      const res = await request(app)
        .post('/api/tenants/tenant-1/account/adjust')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 100, note: '调整' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('tx-1');
      expect(res.body.data.type).toBe('ADJUSTMENT');
      expect(res.body.data.amount).toBe(100);
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1', organizationId: 'org-1' },
        })
      );
      expect(adjustAccount).toHaveBeenCalledWith(
        'tenant-1',
        100,
        '调整',
        'user-1'
      );
    });

    it('should return 404 for non-existent tenant', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/tenants/tenant-1/account/adjust')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 100 });

      expect(res.status).toBe(404);
    });
  });
});
