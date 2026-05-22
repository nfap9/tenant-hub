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

vi.mock('../../src/config/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: any) =>
      callback({
        leaseFee: { deleteMany: vi.fn(), createMany: vi.fn() },
        lease: { update: vi.fn() },
      })
    ),
    lease: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    room: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    leaseFee: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    leaseSettlement: {
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
}));

vi.mock('../../src/services/billing.js', () => ({
  generateLeaseBills: vi.fn(async () => ['bill-1']),
}));

vi.mock('../../src/services/leaseLifecycle.js', () => ({
  assertExpiredTerminationAllowed: vi.fn(),
  startOfLeaseDay: vi.fn((d: Date) => ({ isBefore: vi.fn(() => false) })),
  withLeaseLifecycle: vi.fn((lease: any) => lease),
}));

vi.mock('../../src/services/leaseSettlement.js', () => ({
  createLeaseSettlement: vi.fn(async () => ({ id: 'settlement-1' })),
  getLeaseSettlementPreview: vi.fn(async () => ({ amount: 100 })),
  recordSettlementPayment: vi.fn(async () => ({ id: 'payment-1' })),
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('leases routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/leases', () => {
    it('should return leases for organization', async () => {
      (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'lease-1' },
      ]);

      const res = await request(app)
        .get('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/leases');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/leases', () => {
    it('should create a lease', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        status: 'VACANT',
      });
      (prisma.lease.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
        roomId: 'room-1',
      });
      (prisma.room.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          roomId: 'room-1',
          tenantName: '张三',
          tenantPhone: '13800138000',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          cycle: 'MONTHLY',
          rentAmount: 1000,
          waterUnitPrice: 4,
          powerUnitPrice: 0.8,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('lease-1');
    });

    it('should reject non-vacant room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        status: 'OCCUPIED',
      });

      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          roomId: 'room-1',
          tenantName: '张三',
          tenantPhone: '13800138000',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          cycle: 'MONTHLY',
          rentAmount: 1000,
          waterUnitPrice: 4,
          powerUnitPrice: 0.8,
        });

      expect(res.status).toBe(400);
    });

    it('should reject endDate before startDate', async () => {
      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          roomId: 'room-1',
          tenantName: '张三',
          tenantPhone: '13800138000',
          startDate: '2026-12-31',
          endDate: '2026-01-01',
          cycle: 'MONTHLY',
          rentAmount: 1000,
          waterUnitPrice: 4,
          powerUnitPrice: 0.8,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/leases/:id', () => {
    it('should update a lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
        status: 'ACTIVE',
        fees: [],
      });
      (prisma.lease.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
        rentAmount: 1200,
      });

      const res = await request(app)
        .put('/api/leases/lease-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ rentAmount: 1200 });

      expect(res.status).toBe(200);
    });

    it('should reject updating non-active lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
        status: 'TERMINATED',
        fees: [],
      });

      const res = await request(app)
        .put('/api/leases/lease-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ rentAmount: 1200 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/leases/:id/terminate', () => {
    it('should terminate a lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
        endDate: new Date(),
      });

      const res = await request(app)
        .post('/api/leases/lease-1/terminate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          type: 'NEGOTIATED',
          currentWater: 100,
          currentPower: 200,
        });

      expect(res.status).toBe(200);
    });

    it('should return 404 for missing lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/leases/lease-1/terminate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          type: 'NEGOTIATED',
          currentWater: 100,
          currentPower: 200,
        });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/leases/:id/settlement-preview', () => {
    it('should return preview', async () => {
      const res = await request(app)
        .get('/api/leases/lease-1/settlement-preview')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(100);
    });
  });

  describe('GET /api/leases/settlements', () => {
    it('should return settlements', async () => {
      (
        prisma.leaseSettlement.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 's-1' }]);

      const res = await request(app)
        .get('/api/leases/settlements')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/leases/settlements/:id/payments', () => {
    it('should record settlement payment', async () => {
      const res = await request(app)
        .post('/api/leases/settlements/s-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ direction: 'RECEIVE', amount: 500, method: '现金' });

      expect(res.status).toBe(200);
    });
  });
});
