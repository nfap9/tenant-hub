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
    $transaction: vi.fn(async (callback: any) => {
      if (typeof callback === 'function') return callback({});
      for (const p of callback) await p;
    }),
    refund: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(async () => ({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
      })),
    },
    orgMember: { findUnique: vi.fn() },
  },
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

const baseRefund = {
  id: 'refund-1',
  organizationId: 'org-1',
  tenantId: 'tenant-1',
  type: 'DEPOSIT',
  amount: 1000,
  reason: '退押金',
  status: 'PENDING',
  approverId: null,
  approvedAt: null,
  note: null,
  createdById: 'user-1',
  executedAt: null,
  createdAt: new Date('2025-06-01'),
  updatedAt: new Date('2025-06-01'),
};

const baseTenant = {
  id: 'tenant-1',
  name: '张三',
  phone: '13800138000',
};

describe('refunds routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/refunds', () => {
    it('should list refunds with transformed tenant data', async () => {
      (prisma.refund.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          ...baseRefund,
          tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
          approver: null,
        },
        {
          ...baseRefund,
          id: 'refund-2',
          tenant: { id: 'tenant-2', name: '李四', phone: '13900139000' },
          approver: { id: 'user-2', username: '管理员' },
        },
      ]);

      const res = await request(app)
        .get('/api/refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].tenantName).toBe('张三');
      expect(res.body.data[0].tenantPhone).toBe('13800138000');
      expect(res.body.data[0].approver).toBeNull();
      expect(res.body.data[1].tenantName).toBe('李四');
      expect(res.body.data[1].approver).toBe('管理员');
      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
          include: expect.objectContaining({
            tenant: { select: { id: true, name: true, phone: true } },
            approver: { select: { id: true, username: true } },
          }),
        })
      );
    });

    it('should filter refunds by status', async () => {
      (prisma.refund.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          ...baseRefund,
          status: 'APPROVED',
          tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
          approver: { id: 'user-2', username: '管理员' },
        },
      ]);

      const res = await request(app)
        .get('/api/refunds?status=APPROVED')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data[0].status).toBe('APPROVED');
      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', status: 'APPROVED' },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/refunds');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/refunds', () => {
    it('should create a refund', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        baseTenant
      );
      (prisma.refund.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
      });

      const res = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          tenantId: 'tenant-1',
          type: 'DEPOSIT',
          amount: 1000,
          reason: '退押金',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.tenantName).toBe('张三');
      expect(res.body.data.tenantPhone).toBe('13800138000');
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            tenantId: 'tenant-1',
            type: 'DEPOSIT',
            amount: 1000,
            reason: '退押金',
            createdById: 'user-1',
          }),
        })
      );
    });

    it('should return 404 if tenant not found', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          tenantId: 'non-existent',
          type: 'DEPOSIT',
          amount: 1000,
          reason: '退押金',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租客不存在');
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it('should reject empty reason', async () => {
      const res = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          tenantId: 'tenant-1',
          type: 'DEPOSIT',
          amount: 1000,
          reason: '',
        });

      expect(res.status).toBe(400);
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it('should reject negative amount', async () => {
      const res = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          tenantId: 'tenant-1',
          type: 'DEPOSIT',
          amount: -100,
          reason: '退押金',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/refunds/:id', () => {
    it('should return refund with transformed data', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        approver: { id: 'user-2', username: '管理员' },
      });

      const res = await request(app)
        .get('/api/refunds/refund-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('refund-1');
      expect(res.body.data.tenantName).toBe('张三');
      expect(res.body.data.approver).toBe('管理员');
      expect(prisma.refund.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'refund-1', organizationId: 'org-1' },
        })
      );
    });

    it('should return 404 for non-existent refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/refunds/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('退款记录不存在');
    });
  });

  describe('PUT /api/refunds/:id', () => {
    it('should update a PENDING refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'PENDING',
      });
      (prisma.refund.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        amount: 2000,
        reason: '更新退款金额',
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
      });

      const res = await request(app)
        .put('/api/refunds/refund-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 2000, reason: '更新退款金额' });

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(2000);
      expect(res.body.data.tenantName).toBe('张三');
      expect(prisma.refund.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'refund-1' },
          data: { amount: 2000, reason: '更新退款金额' },
        })
      );
    });

    it('should reject updating non-PENDING refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'APPROVED',
      });

      const res = await request(app)
        .put('/api/refunds/refund-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 2000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅待审批状态的退款可申请修改');
      expect(prisma.refund.update).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .put('/api/refunds/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 2000 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('退款记录不存在');
    });
  });

  describe('PATCH /api/refunds/:id/approve', () => {
    it('should approve a PENDING refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'PENDING',
      });
      (prisma.refund.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'APPROVED',
        approverId: 'user-1',
        approvedAt: new Date('2025-06-02'),
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        approver: { id: 'user-1', username: '测试用户' },
      });

      const res = await request(app)
        .patch('/api/refunds/refund-1/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.approver).toBe('测试用户');
      expect(prisma.refund.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'refund-1' },
          data: expect.objectContaining({
            status: 'APPROVED',
            approverId: 'user-1',
            approvedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should reject approving non-PENDING refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'APPROVED',
      });

      const res = await request(app)
        .patch('/api/refunds/refund-1/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅待审批状态的退款可批准');
      expect(prisma.refund.update).not.toHaveBeenCalled();
    });

    it('should return 404 when approving non-existent refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .patch('/api/refunds/non-existent/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/refunds/:id/reject', () => {
    it('should reject a PENDING refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'PENDING',
      });
      (prisma.refund.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'REJECTED',
        approverId: 'user-1',
        approvedAt: new Date('2025-06-02'),
        note: '材料不齐全',
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        approver: { id: 'user-1', username: '测试用户' },
      });

      const res = await request(app)
        .patch('/api/refunds/refund-1/reject')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ note: '材料不齐全' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.approver).toBe('测试用户');
      expect(prisma.refund.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'refund-1' },
          data: expect.objectContaining({
            status: 'REJECTED',
            approverId: 'user-1',
            note: '材料不齐全',
          }),
        })
      );
    });

    it('should require note for rejection', async () => {
      const res = await request(app)
        .patch('/api/refunds/refund-1/reject')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ note: '' });

      expect(res.status).toBe(400);
      expect(prisma.refund.update).not.toHaveBeenCalled();
    });

    it('should reject rejecting non-PENDING refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'COMPLETED',
      });

      const res = await request(app)
        .patch('/api/refunds/refund-1/reject')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ note: '材料不齐全' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅待审批状态的退款可拒绝');
      expect(prisma.refund.update).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/refunds/:id/execute', () => {
    it('should execute an APPROVED refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'APPROVED',
      });
      (prisma.refund.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'COMPLETED',
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        approver: { id: 'user-2', username: '管理员' },
      });

      const res = await request(app)
        .patch('/api/refunds/refund-1/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(prisma.refund.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'refund-1' },
          data: { status: 'COMPLETED' },
        })
      );
    });

    it('should reject executing non-APPROVED refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'PENDING',
      });

      const res = await request(app)
        .patch('/api/refunds/refund-1/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅已批准状态的退款可执行');
      expect(prisma.refund.update).not.toHaveBeenCalled();
    });

    it('should reject executing REJECTED refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseRefund,
        status: 'REJECTED',
      });

      const res = await request(app)
        .patch('/api/refunds/refund-1/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(prisma.refund.update).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent refund', async () => {
      (prisma.refund.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .patch('/api/refunds/non-existent/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
    });
  });
});
