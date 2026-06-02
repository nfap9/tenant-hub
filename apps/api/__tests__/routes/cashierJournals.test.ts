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
    cashierJournal: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    incomeExpenseCategory: {
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

describe('cashierJournals routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/cashier-journals', () => {
    it('should return paginated journals with aggregate totals', async () => {
      (
        prisma.cashierJournal.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'j-1',
          date: '2026-05-01T00:00:00.000Z',
          type: 'INCOME',
          amount: 5000,
          paymentMethod: 'CASH',
          summary: '房租收入',
          operator: { id: 'user-1', username: '测试用户' },
        },
      ]);
      (
        prisma.cashierJournal.count as ReturnType<typeof vi.fn>
      ).mockResolvedValue(1);
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 1000 } });

      const res = await request(app)
        .get('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.incomeTotal).toBe(5000);
      expect(res.body.data.expenseTotal).toBe(1000);
      expect(prisma.cashierJournal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { date: 'desc' },
        })
      );
    });

    it('should filter by type', async () => {
      (
        prisma.cashierJournal.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (
        prisma.cashierJournal.count as ReturnType<typeof vi.fn>
      ).mockResolvedValue(0);
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const res = await request(app)
        .get('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ type: 'INCOME' });

      expect(res.status).toBe(200);
      expect(prisma.cashierJournal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            type: 'INCOME',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      (
        prisma.cashierJournal.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (
        prisma.cashierJournal.count as ReturnType<typeof vi.fn>
      ).mockResolvedValue(0);
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const res = await request(app)
        .get('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({
          startDate: '2026-05-01',
          endDate: '2026-05-31',
        });

      expect(res.status).toBe(200);
      expect(prisma.cashierJournal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should filter by accountType', async () => {
      (
        prisma.cashierJournal.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (
        prisma.cashierJournal.count as ReturnType<typeof vi.fn>
      ).mockResolvedValue(0);
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const res = await request(app)
        .get('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ accountType: 'BANK' });

      expect(res.status).toBe(200);
      expect(prisma.cashierJournal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountType: 'BANK',
          }),
        })
      );
    });

    it('should paginate correctly', async () => {
      (
        prisma.cashierJournal.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (
        prisma.cashierJournal.count as ReturnType<typeof vi.fn>
      ).mockResolvedValue(0);
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const res = await request(app)
        .get('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ page: 2, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(prisma.cashierJournal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should call aggregate with correct type-specific where clauses', async () => {
      (
        prisma.cashierJournal.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (
        prisma.cashierJournal.count as ReturnType<typeof vi.fn>
      ).mockResolvedValue(0);
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 8000 } })
        .mockResolvedValueOnce({ _sum: { amount: 3000 } });

      await request(app)
        .get('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(prisma.cashierJournal.aggregate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({ type: 'INCOME' }),
          _sum: { amount: true },
        })
      );
      expect(prisma.cashierJournal.aggregate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({ type: 'EXPENSE' }),
          _sum: { amount: true },
        })
      );
    });
  });

  describe('POST /api/cashier-journals', () => {
    it('should create a journal entry with operator id', async () => {
      (
        prisma.cashierJournal.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'j-new',
        date: '2026-05-15T00:00:00.000Z',
        type: 'INCOME',
        amount: 5000,
        paymentMethod: 'CASH',
        summary: '5月房租',
        operator: { id: 'user-1', username: '测试用户' },
      });

      const res = await request(app)
        .post('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          date: '2026-05-15',
          type: 'INCOME',
          amount: 5000,
          paymentMethod: 'CASH',
          summary: '5月房租',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBe('5月房租');
      expect(prisma.cashierJournal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            operatorId: 'user-1',
            type: 'INCOME',
            amount: 5000,
            summary: '5月房租',
          }),
        })
      );
    });

    it('should set operatorId from authenticated user', async () => {
      (
        prisma.cashierJournal.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'j-op',
        operator: { id: 'user-1', username: '测试用户' },
      });

      await request(app)
        .post('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          date: '2026-05-15',
          type: 'EXPENSE',
          amount: 1000,
          paymentMethod: 'BANK',
          summary: '办公用品',
        });

      expect(prisma.cashierJournal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            operatorId: 'user-1',
          }),
        })
      );
    });

    it('should reject journal with no summary', async () => {
      const res = await request(app)
        .post('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          date: '2026-05-15',
          type: 'INCOME',
          amount: 5000,
          paymentMethod: 'CASH',
          summary: '',
        });

      expect(res.status).toBe(400);
      expect(prisma.cashierJournal.create).not.toHaveBeenCalled();
    });

    it('should reject journal with negative amount', async () => {
      const res = await request(app)
        .post('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          date: '2026-05-15',
          type: 'INCOME',
          amount: -100,
          paymentMethod: 'CASH',
          summary: '无效金额',
        });

      expect(res.status).toBe(400);
      expect(prisma.cashierJournal.create).not.toHaveBeenCalled();
    });

    it('should create journal with counterparty info', async () => {
      (
        prisma.cashierJournal.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'j-cp',
        counterparty: '张三',
        counterpartyId: 'tenant-1',
      });

      await request(app)
        .post('/api/cashier-journals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          date: '2026-05-15',
          type: 'INCOME',
          amount: 3000,
          paymentMethod: 'WECHAT',
          counterparty: '张三',
          counterpartyId: 'tenant-1',
          summary: '租金',
        });

      expect(prisma.cashierJournal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            counterparty: '张三',
            counterpartyId: 'tenant-1',
          }),
        })
      );
    });
  });

  describe('GET /api/cashier-journals/categories', () => {
    it('should return all categories', async () => {
      (
        prisma.incomeExpenseCategory.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        { id: 'cat-1', name: '房租收入', type: 'INCOME' },
        { id: 'cat-2', name: '维修支出', type: 'EXPENSE' },
      ]);

      const res = await request(app)
        .get('/api/cashier-journals/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.categories).toHaveLength(2);
      expect(prisma.incomeExpenseCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { name: 'asc' },
        })
      );
    });

    it('should filter categories by type', async () => {
      (
        prisma.incomeExpenseCategory.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 'cat-1', name: '房租收入', type: 'INCOME' }]);

      const res = await request(app)
        .get('/api/cashier-journals/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ type: 'INCOME' });

      expect(res.status).toBe(200);
      expect(res.body.data.categories).toHaveLength(1);
      expect(prisma.incomeExpenseCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', type: 'INCOME' },
        })
      );
    });
  });

  describe('GET /api/cashier-journals/daily-report', () => {
    it('should return daily report with opening and closing balance', async () => {
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 1000 } })
        .mockResolvedValueOnce({ _sum: { amount: 20000 } });

      const res = await request(app)
        .get('/api/cashier-journals/daily-report')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ date: '2026-05-15' });

      expect(res.status).toBe(200);
      expect(res.body.data.income).toBe(5000);
      expect(res.body.data.expense).toBe(1000);
      expect(res.body.data.openingBalance).toBe(20000);
      expect(res.body.data.closingBalance).toBe(24000);
      expect(res.body.data.date).toBeDefined();
    });

    it('should default to today when no date provided', async () => {
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const res = await request(app)
        .get('/api/cashier-journals/daily-report')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.income).toBe(0);
      expect(res.body.data.expense).toBe(0);
      expect(res.body.data.date).toBeDefined();
    });

    it('should handle null aggregate amounts', async () => {
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const res = await request(app)
        .get('/api/cashier-journals/daily-report')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ date: '2026-05-15' });

      expect(res.status).toBe(200);
      expect(res.body.data.income).toBe(0);
      expect(res.body.data.expense).toBe(0);
      expect(res.body.data.openingBalance).toBe(0);
      expect(res.body.data.closingBalance).toBe(0);
    });

    it('should calculate correct closing balance for mixed transactions', async () => {
      (prisma.cashierJournal.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ _sum: { amount: 8000 } })
        .mockResolvedValueOnce({ _sum: { amount: 3000 } })
        .mockResolvedValueOnce({ _sum: { amount: 15000 } });

      const res = await request(app)
        .get('/api/cashier-journals/daily-report')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ date: '2026-05-15' });

      expect(res.status).toBe(200);
      expect(res.body.data.closingBalance).toBe(20000);
    });
  });

  describe('authentication', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/cashier-journals');
      expect(res.status).toBe(401);
    });
  });
});
