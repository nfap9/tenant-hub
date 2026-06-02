import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

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
    deposit: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
    lease: {
      findMany: vi.fn(),
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
  basePrisma: {},
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

const mockDeposit = (overrides: Record<string, unknown> = {}) => ({
  id: 'dep-1',
  organizationId: 'org-1',
  leaseId: 'lease-1',
  billId: 'bill-1',
  amount: new Prisma.Decimal(2000),
  paidAmount: new Prisma.Decimal(1000),
  refundedAmount: new Prisma.Decimal(0),
  deductedAmount: new Prisma.Decimal(0),
  status: 'PAID',
  ...overrides,
});

describe('deposits routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/deposits', () => {
    it('should list deposits for organization', async () => {
      (prisma.deposit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'dep-1',
          status: 'UNPAID',
          amount: new Prisma.Decimal(2000),
          lease: {
            id: 'lease-1',
            room: {
              id: 'room-1',
              roomNo: '101',
              apartment: { id: 'apt-1', name: '阳光公寓' },
            },
          },
        },
      ]);

      const res = await request(app)
        .get('/api/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('dep-1');
      expect(res.body.data[0].lease.room.apartment.name).toBe('阳光公寓');
      expect(prisma.deposit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
          include: expect.objectContaining({
            lease: expect.objectContaining({
              include: expect.objectContaining({
                room: expect.objectContaining({
                  include: expect.objectContaining({ apartment: true }),
                }),
              }),
            }),
          }),
        })
      );
    });

    it('should filter by status', async () => {
      (prisma.deposit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      await request(app)
        .get('/api/deposits?status=PAID')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(prisma.deposit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            status: 'PAID',
          }),
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/deposits');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/deposits/summary', () => {
    it('should return aggregated deposit data', async () => {
      (prisma.deposit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockDeposit({ amount: 2000, paidAmount: 2000, status: 'PAID' }),
        mockDeposit({
          amount: 3000,
          paidAmount: 1500,
          status: 'PARTIAL_REFUNDED',
        }),
      ]);
      (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/deposits/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Number(res.body.data.totalAmount)).toBe(5000);
      expect(Number(res.body.data.paidAmount)).toBe(3500);
      expect(res.body.data.count).toBe(2);
    });
  });

  describe('GET /api/deposits/:id', () => {
    it('should return deposit detail with lease and bills', async () => {
      (prisma.deposit.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'dep-1',
        amount: new Prisma.Decimal(2000),
        lease: {
          id: 'lease-1',
          room: {
            id: 'room-1',
            roomNo: '101',
            apartment: { id: 'apt-1', name: '阳光公寓' },
          },
          bills: [
            {
              id: 'bill-1',
              mode: 'DEPOSIT',
              payments: [
                { id: 'pay-1', user: { id: 'user-1', username: '测试用户' } },
              ],
            },
          ],
        },
        bill: {
          id: 'bill-1',
          payments: [
            { id: 'pay-1', user: { id: 'user-1', username: '测试用户' } },
          ],
        },
      });

      const res = await request(app)
        .get('/api/deposits/dep-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('dep-1');
      expect(res.body.data.lease.bills).toHaveLength(1);
      expect(prisma.deposit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'dep-1',
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should return 404 if deposit not found', async () => {
      (prisma.deposit.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/deposits/dep-404')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('押金记录不存在');
    });
  });

  describe('POST /api/deposits/:id/payments', () => {
    it('should record a COLLECT payment and update deposit', async () => {
      const depositMock = mockDeposit({ paidAmount: new Prisma.Decimal(1000) });
      (prisma.deposit.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        depositMock
      );
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        depositMock
      );
      (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'payment-1',
        amount: 500,
        status: 'COMPLETED',
      });
      (prisma.deposit.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await request(app)
        .post('/api/deposits/dep-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ type: 'COLLECT', amount: 500, method: '银行转账' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billId: 'bill-1',
            type: 'RECEIVE',
            amount: new Prisma.Decimal(500),
            method: '银行转账',
          }),
        })
      );
      expect(prisma.deposit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dep-1' },
          data: expect.objectContaining({
            paidAmount: new Prisma.Decimal(1500),
          }),
        })
      );
    });

    it('should reject COLLECT exceeding remaining amount', async () => {
      const depositMock = mockDeposit({ paidAmount: new Prisma.Decimal(1000) });
      (prisma.deposit.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        depositMock
      );
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        depositMock
      );

      const res = await request(app)
        .post('/api/deposits/dep-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ type: 'COLLECT', amount: 5000, method: '现金' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('不能超过剩余应收');
    });

    it('should return 404 if deposit not found', async () => {
      (prisma.deposit.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/deposits/dep-404/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ type: 'COLLECT', amount: 2000, method: '现金' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('押金记录不存在');
    });

    it('should reject deposit without billId', async () => {
      const depositMock = mockDeposit({ billId: null });
      (prisma.deposit.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        depositMock
      );
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        depositMock
      );

      const res = await request(app)
        .post('/api/deposits/dep-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ type: 'COLLECT', amount: 500, method: '现金' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('押金账单不存在');
    });
  });
});
