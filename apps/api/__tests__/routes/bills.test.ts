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
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === 'function') {
        return arg({
          billItem: { update: vi.fn() },
          bill: { update: vi.fn() },
          meterReading: { createMany: vi.fn() },
        });
      }
      for (const p of arg) await p;
    }),
    bill: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    monthlyBill: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    billItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    meterReading: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    apartment: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    room: {
      findFirst: vi.fn(),
    },
    lease: {
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
    orgMember: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/billing.js', () => ({
  generateCurrentLeaseBills: vi.fn(async () => ({
    leaseCount: 2,
    billIds: ['bill-1'],
  })),
  generateLeaseBills: vi.fn(async () => ['bill-1']),
  recordBillPayment: vi.fn(async () => ({ id: 'payment-1' })),
  recordMonthlyBillPayment: vi.fn(async () => ({ id: 'payment-1' })),
  retryPostpaidBillAndMonthlyBill: vi.fn(async () => ({})),
  refreshBillTotals: vi.fn(async () => {}),
  refreshMonthlyBillTotals: vi.fn(async () => {}),
  tryCreateMonthlyBill: vi.fn(async () => {}),
  calculateUtilityLineAmounts: vi.fn(() => ({
    waterAmount: 32,
    powerAmount: 48,
  })),
  getCurrentMonthBillWindow: vi.fn(() => ({
    start: new Date(),
    end: new Date(),
  })),
  getBillMonthLabel: vi.fn(() => '2026年7月'),
}));

vi.mock('../../src/services/csv.js', () => ({
  toCsv: vi.fn((rows: string[][]) => rows.map((r) => r.join(',')).join('\n')),
}));

vi.mock('../../src/services/utilityImport.js', () => ({
  parseUtilityImportRows: vi.fn(() => [
    {
      billId: 'bill-1',
      previousWater: 10,
      currentWater: 18,
      previousPower: 100,
      currentPower: 160,
    },
  ]),
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('bills routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/bills', () => {
    it('should return bills for organization', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'bill-1' },
      ]);

      const res = await request(app)
        .get('/api/bills')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 'bill-1' }]);
      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/bills');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/bills/monthly', () => {
    it('should return monthly bills', async () => {
      (
        prisma.monthlyBill.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 'mb-1' }]);

      const res = await request(app)
        .get('/api/bills/monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 'mb-1' }]);
    });
  });

  describe('POST /api/bills/generate', () => {
    it('should generate bills for all current leases', async () => {
      const res = await request(app)
        .post('/api/bills/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.leaseCount).toBe(2);
    });

    it('should generate bills for specific lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
      });

      const res = await request(app)
        .post('/api/bills/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ leaseId: 'lease-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.billIds).toEqual(['bill-1']);
    });
  });

  describe('POST /api/bills/:id/payments', () => {
    it('should record a bill payment', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-1',
      });

      const res = await request(app)
        .post('/api/bills/bill-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 100, method: '现金' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/bills/:id', () => {
    it('should delete a bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-1',
        status: 'UNPAID',
        monthlyBillId: null,
        items: [],
        payments: [],
      });

      const res = await request(app)
        .delete('/api/bills/bill-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('should reject deleting paid bills', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-1',
        status: 'PAID',
        monthlyBillId: null,
        items: [],
        payments: [],
      });

      const res = await request(app)
        .delete('/api/bills/bill-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/bills/utility/pending-export', () => {
    it('should return CSV export', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/bills/utility/pending-export')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  describe('GET /api/bills/meter-readings', () => {
    it('should return meter readings', async () => {
      (
        prisma.meterReading.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 'mr-1' }]);

      const res = await request(app)
        .get('/api/bills/meter-readings')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/bills/meter-readings', () => {
    it('should create a meter reading', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        apartmentId: 'apt-1',
      });
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
      });
      (
        prisma.meterReading.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'mr-1' });
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .post('/api/bills/meter-readings')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          roomId: 'room-1',
          meterType: 'WATER',
          readingDate: '2026-05-01',
          value: 100,
        });

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/bills/meter-readings')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          roomId: 'room-1',
          meterType: 'WATER',
          readingDate: '2026-05-01',
          value: 100,
        });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/bills/monthly/:id/payments', () => {
    it('should record a monthly bill payment', async () => {
      (
        prisma.monthlyBill.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'mb-1' });

      const res = await request(app)
        .post('/api/bills/monthly/mb-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 100, method: '现金' });

      expect(res.status).toBe(200);
    });

    it('should return 404 for missing monthly bill', async () => {
      (
        prisma.monthlyBill.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/bills/monthly/mb-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 100, method: '现金' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/bills/:id/retry-billing', () => {
    it('should retry billing for postpaid bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-1',
        mode: 'POSTPAID',
      });

      const res = await request(app)
        .post('/api/bills/bill-1/retry-billing')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
    });

    it('should reject retry for non-postpaid bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-1',
        mode: 'PREPAID',
      });

      const res = await request(app)
        .post('/api/bills/bill-1/retry-billing')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/bills/:id/items/:itemId', () => {
    it('should update bill item amount', async () => {
      (prisma.billItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: 'item-1',
          billId: 'bill-1',
          amount: 100,
          note: null,
          bill: { status: 'UNPAID' },
        }
      );

      const res = await request(app)
        .put('/api/bills/bill-1/items/item-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 120 });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(true);
    });

    it('should reject updating paid bill item', async () => {
      (prisma.billItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: 'item-1',
          billId: 'bill-1',
          amount: 100,
          note: null,
          bill: { status: 'PAID' },
        }
      );

      const res = await request(app)
        .put('/api/bills/bill-1/items/item-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 120 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/bills/monthly/:id', () => {
    it('should delete a monthly bill', async () => {
      (
        prisma.monthlyBill.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'mb-1',
        status: 'UNPAID',
        bills: [{ id: 'bill-1' }],
        payments: [],
      });

      const res = await request(app)
        .delete('/api/bills/monthly/mb-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('should reject deleting paid monthly bill', async () => {
      (
        prisma.monthlyBill.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'mb-1',
        status: 'PAID',
        bills: [],
        payments: [],
      });

      const res = await request(app)
        .delete('/api/bills/monthly/mb-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/bills/utility/import', () => {
    it('should import utility readings from rows', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-1',
        mode: 'POSTPAID',
        organizationId: 'org-1',
        leaseId: 'lease-1',
        billingDate: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
        lease: {
          roomId: 'room-1',
          room: { apartmentId: 'apt-1' },
        },
        items: [
          { id: 'water-item', type: 'WATER', waterUnitPrice: 4 },
          { id: 'power-item', type: 'POWER', powerUnitPrice: 0.8 },
        ],
      });

      const res = await request(app)
        .post('/api/bills/utility/import')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          rows: [
            {
              billId: 'bill-1',
              previousWater: 10,
              currentWater: 18,
              previousPower: 100,
              currentPower: 160,
            },
          ],
        });

      expect(res.status).toBe(200);
    });
  });
});
