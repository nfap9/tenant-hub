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
    landlordPayment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
    landlordContract: {
      findFirst: vi.fn(),
    },
    apartmentExpense: {
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
  basePrisma: {},
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('landlordPayments routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/landlord-payments', () => {
    it('should list landlord payments for organization', async () => {
      (
        prisma.landlordPayment.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'lp-1',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          dueDate: new Date('2026-01-01'),
          plannedAmount: 5000,
          status: 'PENDING',
          landlordContract: { id: 'lc-1', contractNo: 'HT-2026-001' },
          apartment: { id: 'apt-1', name: '阳光公寓' },
        },
      ]);

      const res = await request(app)
        .get('/api/landlord-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('lp-1');
      expect(res.body.data[0].landlordContract.contractNo).toBe('HT-2026-001');
      expect(res.body.data[0].apartment.name).toBe('阳光公寓');
    });

    it('should filter by contractId', async () => {
      (
        prisma.landlordPayment.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/landlord-payments?contractId=lc-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.landlordPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ landlordContractId: 'lc-1' }),
        })
      );
    });

    it('should filter by apartmentId', async () => {
      (
        prisma.landlordPayment.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/landlord-payments?apartmentId=apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.landlordPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ apartmentId: 'apt-1' }),
        })
      );
    });

    it('should filter by status', async () => {
      (
        prisma.landlordPayment.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'lp-2',
          status: 'PAID',
          plannedAmount: 5000,
          landlordContract: null,
          apartment: null,
        },
      ]);

      const res = await request(app)
        .get('/api/landlord-payments?status=PAID')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data[0].status).toBe('PAID');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/landlord-payments');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/landlord-payments/:id', () => {
    it('should return payment detail', async () => {
      (
        prisma.landlordPayment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lp-1',
        plannedAmount: 5000,
        status: 'PENDING',
        landlordContract: { id: 'lc-1', contractNo: 'HT-2026-001' },
        apartment: { id: 'apt-1', name: '阳光公寓' },
        expense: null,
      });

      const res = await request(app)
        .get('/api/landlord-payments/lp-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('lp-1');
      expect(res.body.data.plannedAmount).toBe(5000);
    });

    it('should return 404 if payment not found', async () => {
      (
        prisma.landlordPayment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/landlord-payments/lp-404')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('付款计划不存在');
    });
  });

  describe('POST /api/landlord-payments/generate', () => {
    it('should generate payment plans from contract', async () => {
      (
        prisma.landlordContract.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lc-1',
        apartmentId: 'apt-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        rentAmount: 5000,
        paymentMethod: 'MONTHLY',
        freeRentDays: 0,
        freeRentStart: null,
        freeRentEnd: null,
        escalationType: null,
        escalationValue: null,
        escalationCycle: null,
      });
      (
        prisma.landlordPayment.deleteMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 0 });
      (
        prisma.landlordPayment.createMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 6 });

      const res = await request(app)
        .post('/api/landlord-payments/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ landlordContractId: 'lc-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.generated).toBe(6);
      expect(prisma.landlordPayment.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            landlordContractId: 'lc-1',
            status: 'PENDING',
          }),
        })
      );
    });

    it('should return 404 if contract not found', async () => {
      (
        prisma.landlordContract.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/landlord-payments/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ landlordContractId: 'lc-404' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('合同不存在');
    });
  });

  describe('POST /api/landlord-payments/:id/pay', () => {
    it('should record payment', async () => {
      (
        prisma.landlordPayment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lp-1',
        apartmentId: 'apt-1',
        landlordContractId: 'lc-1',
      });
      (
        prisma.landlordPayment.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lp-1',
        paidAmount: 5000,
        status: 'PAID',
        landlordContract: { id: 'lc-1', contractNo: 'HT-2026-001' },
        apartment: { id: 'apt-1', name: '阳光公寓' },
        expense: null,
      });

      const res = await request(app)
        .post('/api/landlord-payments/lp-1/pay')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ paidAmount: 5000, paidAt: '2026-01-01' });

      expect(res.status).toBe(200);
      expect(res.body.data.paidAmount).toBe(5000);
      expect(res.body.data.status).toBe('PAID');
    });

    it('should create apartment expense when createExpense is true', async () => {
      (
        prisma.landlordPayment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lp-1',
        apartmentId: 'apt-1',
        landlordContractId: 'lc-1',
      });
      (
        prisma.apartmentExpense.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'exp-1',
        name: '房东租金付款',
        amount: 5000,
      });
      (
        prisma.landlordPayment.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lp-1',
        paidAmount: 5000,
        status: 'PAID',
        expense: { id: 'exp-1', name: '房东租金付款', amount: 5000 },
        landlordContract: { id: 'lc-1', contractNo: 'HT-2026-001' },
        apartment: { id: 'apt-1', name: '阳光公寓' },
      });

      const res = await request(app)
        .post('/api/landlord-payments/lp-1/pay')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ paidAmount: 5000, paidAt: '2026-01-01', createExpense: true });

      expect(res.status).toBe(200);
      expect(res.body.data.expense).toBeDefined();
      expect(res.body.data.expense.amount).toBe(5000);
      expect(prisma.apartmentExpense.create).toHaveBeenCalled();
    });

    it('should return 404 if payment not found', async () => {
      (
        prisma.landlordPayment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/landlord-payments/lp-404/pay')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ paidAmount: 5000, paidAt: '2026-01-01' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('付款计划不存在');
    });
  });

  describe('DELETE /api/landlord-payments/:id', () => {
    it('should soft delete a pending payment', async () => {
      (
        prisma.landlordPayment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lp-1',
        status: 'PENDING',
      });
      (
        prisma.landlordPayment.softDelete as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lp-1',
        deletedAt: new Date(),
      });

      const res = await request(app)
        .delete('/api/landlord-payments/lp-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('should reject deleting paid payment', async () => {
      (
        prisma.landlordPayment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'lp-2',
        status: 'PAID',
      });

      const res = await request(app)
        .delete('/api/landlord-payments/lp-2')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('已付款的计划不能删除');
    });

    it('should return 404 if payment not found', async () => {
      (
        prisma.landlordPayment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/landlord-payments/lp-404')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('付款计划不存在');
    });
  });
});
