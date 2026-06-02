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
    bill: {
      findMany: vi.fn(),
    },
    apartmentExpense: {
      findMany: vi.fn(),
    },
    apartment: {
      findMany: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
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
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('reports routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/reports/receivables', () => {
    it('should return receivables report', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'bill-1',
          totalAmount: 1000,
          paidAmount: 500,
          status: 'PARTIAL_PAID',
          dueDate: new Date(),
          lease: {
            id: 'lease-1',
            tenantName: '张三',
            room: {
              id: 'room-1',
              roomNo: '101',
              apartment: { id: 'apt-1', name: '阳光公寓' },
            },
            tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
          },
          items: [{ id: 'item-1', type: 'RENT', amount: 1000 }],
        },
      ]);

      const res = await request(app)
        .get('/api/reports/receivables')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('bills');
      expect(res.body.data).toHaveProperty('summary');
      expect(Array.isArray(res.body.data.bills)).toBe(true);
      expect(res.body.data.bills[0].id).toBe('bill-1');
      expect(res.body.data.summary.totalReceivable).toBe(1000);
      expect(res.body.data.summary.totalReceived).toBe(500);
      expect(res.body.data.summary.totalUnpaid).toBe(500);
    });

    it('should filter by apartmentId and status', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/reports/receivables')
        .query({ apartmentId: 'apt-1', status: 'OVERDUE' })
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalReceivable).toBe(0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/reports/receivables');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/income-expense', () => {
    it('should return income/expense report for a month', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'bill-1',
          status: 'PAID',
          totalAmount: 2000,
          paidAmount: 2000,
          lease: { room: { apartment: { id: 'apt-1', name: '阳光公寓' } } },
          items: [
            { id: 'i-1', name: '租金', amount: 1500 },
            { id: 'i-2', name: '水费', amount: 200 },
          ],
        },
      ]);
      (
        prisma.apartmentExpense.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'exp-1',
          name: '维修费',
          amount: 300,
          apartment: { id: 'apt-1', name: '阳光公寓' },
          category: { name: '维修' },
        },
      ]);

      const res = await request(app)
        .get('/api/reports/income-expense')
        .query({ year: 2026, month: 7 })
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('period');
      expect(res.body.data).toHaveProperty('income');
      expect(res.body.data).toHaveProperty('expense');
      expect(res.body.data).toHaveProperty('grossProfit');
      expect(res.body.data.income.total).toBe(1700);
      expect(res.body.data.expense.total).toBe(300);
      expect(res.body.data.grossProfit).toBe(1400);
    });

    it('should return income/expense for a year without month', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (
        prisma.apartmentExpense.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/reports/income-expense')
        .query({ year: 2026 })
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.income.total).toBe(0);
      expect(res.body.data.expense.total).toBe(0);
    });
  });

  describe('GET /api/reports/collection-rate', () => {
    it('should return collection rate for a month', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'bill-1',
          totalAmount: 1000,
          paidAmount: 800,
          status: 'PARTIAL_PAID',
          lease: {
            id: 'lease-1',
            tenantName: '张三',
            room: {
              id: 'room-1',
              roomNo: '101',
              apartment: { id: 'apt-1', name: '阳光公寓' },
            },
            tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
          },
        },
        {
          id: 'bill-2',
          totalAmount: 500,
          paidAmount: 500,
          status: 'PAID',
          lease: {
            id: 'lease-2',
            tenantName: '李四',
            room: {
              id: 'room-2',
              roomNo: '102',
              apartment: { id: 'apt-1', name: '阳光公寓' },
            },
            tenant: { id: 'tenant-2', name: '李四', phone: '13900139000' },
          },
        },
      ]);

      const res = await request(app)
        .get('/api/reports/collection-rate')
        .query({ year: 2026, month: 7 })
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('period');
      expect(res.body.data).toHaveProperty('totalReceivable');
      expect(res.body.data).toHaveProperty('totalReceived');
      expect(res.body.data).toHaveProperty('collectionRate');
      expect(res.body.data).toHaveProperty('overdueTenants');
      expect(res.body.data.totalReceivable).toBe(1500);
      expect(res.body.data.totalReceived).toBe(1300);
      expect(res.body.data.collectionRate).toBe(86.67);
      expect(Array.isArray(res.body.data.overdueTenants)).toBe(true);
      expect(res.body.data.overdueTenants).toHaveLength(1);
    });

    it('should return zero collection rate when no bills', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/reports/collection-rate')
        .query({ year: 2026, month: 7 })
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.collectionRate).toBe(0);
    });
  });

  describe('GET /api/reports/occupancy', () => {
    it('should return occupancy report', async () => {
      (prisma.apartment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [
          {
            id: 'apt-1',
            name: '阳光公寓',
            rooms: [
              {
                id: 'room-1',
                roomNo: '101',
                leases: [{ id: 'lease-1', status: 'ACTIVE' }],
              },
              {
                id: 'room-2',
                roomNo: '102',
                leases: [],
              },
            ],
          },
        ]
      );

      const res = await request(app)
        .get('/api/reports/occupancy')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalRooms');
      expect(res.body.data).toHaveProperty('occupiedRooms');
      expect(res.body.data).toHaveProperty('vacantRooms');
      expect(res.body.data).toHaveProperty('overallOccupancyRate');
      expect(res.body.data).toHaveProperty('byApartment');
      expect(res.body.data.totalRooms).toBe(2);
      expect(res.body.data.occupiedRooms).toBe(1);
      expect(res.body.data.vacantRooms).toBe(1);
      expect(res.body.data.overallOccupancyRate).toBe(50);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/reports/occupancy');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/occupancy-trend', () => {
    it('should return last 12 months occupancy trend', async () => {
      (prisma.room.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'room-1' },
        { id: 'room-2' },
      ]);
      (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { roomId: 'room-1' },
      ]);

      const res = await request(app)
        .get('/api/reports/occupancy-trend')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('months');
      expect(Array.isArray(res.body.data.months)).toBe(true);
      expect(res.body.data.months).toHaveLength(12);
      expect(res.body.data.months[0]).toHaveProperty('month');
      expect(res.body.data.months[0]).toHaveProperty('occupancyRate');
      expect(res.body.data.months[0].occupancyRate).toBe(50);
    });
  });

  describe('GET /api/reports/income-expense-trend', () => {
    it('should return last 6 months income/expense trend', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { paidAmount: 2000 },
      ]);
      (
        prisma.apartmentExpense.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ amount: 500 }]);

      const res = await request(app)
        .get('/api/reports/income-expense-trend')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('months');
      expect(Array.isArray(res.body.data.months)).toBe(true);
      expect(res.body.data.months).toHaveLength(6);
      expect(res.body.data.months[0]).toHaveProperty('month');
      expect(res.body.data.months[0]).toHaveProperty('income');
      expect(res.body.data.months[0]).toHaveProperty('expense');
      expect(res.body.data.months[0].income).toBe(2000);
      expect(res.body.data.months[0].expense).toBe(500);
    });
  });

  describe('GET /api/reports/collection-rate-trend', () => {
    it('should return last 12 months collection rate trend', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { totalAmount: 1000, paidAmount: 800 },
      ]);

      const res = await request(app)
        .get('/api/reports/collection-rate-trend')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('months');
      expect(Array.isArray(res.body.data.months)).toBe(true);
      expect(res.body.data.months).toHaveLength(12);
      expect(res.body.data.months[0]).toHaveProperty('month');
      expect(res.body.data.months[0]).toHaveProperty('collectionRate');
      expect(res.body.data.months[0].collectionRate).toBe(80);
    });
  });
});
