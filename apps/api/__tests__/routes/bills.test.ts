import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockTxBillItemDeleteMany = vi.fn();
const mockTxOverduePenaltyDeleteMany = vi.fn();

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-123456789',
    JWT_EXPIRES_IN: '7d',
    NODE_ENV: 'test',
  },
  corsOrigins: ['http://localhost:5173'],
}));

vi.mock('../../src/services/billing.js', () => ({
  generateCurrentLeaseBills: vi.fn(),
  generateLeaseBills: vi.fn(),
  recordBillPayment: vi.fn(),
  retryPostpaidBill: vi.fn(),
  refreshBillTotals: vi.fn(),
  calculateUtilityLineAmounts: vi.fn(),
  detectAbnormalUsage: vi.fn().mockResolvedValue(false),
  getCurrentMonthBillWindow: vi.fn(),
  getBillMonthLabel: vi.fn(),
}));

vi.mock('../../src/services/csv.js', () => ({
  toCsv: vi.fn(),
}));

vi.mock('../../src/services/utilityImport.js', () => ({
  parseUtilityImportRows: vi.fn(),
}));

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        for (const p of arg) await p;
        return;
      }
      if (typeof arg === 'function') {
        return arg({
          billItem: { deleteMany: mockTxBillItemDeleteMany },
          overduePenalty: { deleteMany: mockTxOverduePenaltyDeleteMany },
        });
      }
      return arg;
    }),
    bill: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      softDelete: vi.fn(),
      count: vi.fn(),
    },
    billItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    meterReading: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    room: {
      findFirst: vi.fn(),
    },
    apartment: {
      findFirst: vi.fn(),
    },
    lease: {
      findFirst: vi.fn(),
    },
    overduePenalty: {
      deleteMany: vi.fn(),
    },
    auditLog: {
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

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';
import {
  generateCurrentLeaseBills,
  generateLeaseBills,
  recordBillPayment,
  retryPostpaidBill,
  refreshBillTotals,
  calculateUtilityLineAmounts,
  detectAbnormalUsage,
} from '../../src/services/billing.js';
import { toCsv } from '../../src/services/csv.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

const mockBillData = (overrides: Record<string, unknown> = {}) => ({
  id: 'bill-1',
  organizationId: 'org-1',
  leaseId: 'lease-1',
  type: 'MONTHLY',
  mode: 'PREPAID',
  status: 'UNPAID',
  totalAmount: 2000,
  paidAmount: 0,
  billingDate: new Date('2025-06-01'),
  dueDate: new Date('2025-06-05'),
  periodStart: new Date('2025-05-01'),
  periodEnd: new Date('2025-06-01'),
  failureReason: null,
  note: null,
  lease: {
    id: 'lease-1',
    tenantName: '张三',
    room: { id: 'room-1', roomNo: '101', apartmentId: 'apt-1' },
  },
  items: [
    { id: 'item-1', type: 'RENT', name: '房租', amount: 1500 },
    {
      id: 'item-2',
      type: 'WATER',
      name: '水费',
      amount: 0,
      waterUnitPrice: 5,
      previousWater: 0,
      currentWater: 0,
      status: 'BILLING',
    },
    {
      id: 'item-3',
      type: 'POWER',
      name: '电费',
      amount: 0,
      powerUnitPrice: 1.2,
      previousPower: 0,
      currentPower: 0,
      status: 'BILLING',
    },
  ],
  payments: [],
  ...overrides,
});

describe('bills routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
    (detectAbnormalUsage as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  });

  describe('GET /api/bills', () => {
    it('should list bills for organization', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockBillData(),
      ]);

      const res = await request(app)
        .get('/api/bills')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('bill-1');
      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { dueDate: 'asc' },
        })
      );
    });

    it('should filter bills by status', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/bills?status=UNPAID')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', status: 'UNPAID' },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/bills');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/bills/utility', () => {
    it('should list utility bills', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockBillData({ type: 'SETTLEMENT' }),
      ]);

      const res = await request(app)
        .get('/api/bills/utility')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            items: { some: { type: { in: ['WATER', 'POWER', 'GAS'] } } },
          }),
        })
      );
    });
  });

  describe('POST /api/bills/generate', () => {
    it('should generate bills for all leases', async () => {
      (generateCurrentLeaseBills as ReturnType<typeof vi.fn>).mockResolvedValue(
        [{ id: 'bill-1' }, { id: 'bill-2' }]
      );

      const res = await request(app)
        .post('/api/bills/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(generateCurrentLeaseBills).toHaveBeenCalledWith(
        'org-1',
        expect.any(Date)
      );
    });

    it('should generate bills for specific lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
      });
      (generateLeaseBills as ReturnType<typeof vi.fn>).mockResolvedValue([
        'bill-1',
      ]);

      const res = await request(app)
        .post('/api/bills/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ leaseId: 'lease-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.billIds).toEqual(['bill-1']);
      expect(prisma.lease.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lease-1', organizationId: 'org-1' },
          select: { id: true },
        })
      );
      expect(generateLeaseBills).toHaveBeenCalledWith(
        'lease-1',
        expect.any(Date)
      );
    });

    it('should return 404 when lease not found', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/bills/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ leaseId: 'non-existent' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租约不存在');
    });
  });

  describe('GET /api/bills/meter-readings', () => {
    it('should list meter readings', async () => {
      (
        prisma.meterReading.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 'mr-1', value: 100, meterType: 'WATER' }]);

      const res = await request(app)
        .get('/api/bills/meter-readings')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { readingDate: 'desc' },
        })
      );
    });

    it('should filter by roomId', async () => {
      (
        prisma.meterReading.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/bills/meter-readings?roomId=room-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', roomId: 'room-1' },
        })
      );
    });
  });

  describe('POST /api/bills/meter-readings', () => {
    it('should create a meter reading', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        apartmentId: 'apt-1',
        apartment: { organizationId: 'org-1' },
      });
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (
        prisma.meterReading.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prisma.meterReading.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'mr-new',
        roomId: 'room-1',
        meterType: 'WATER',
        value: 150,
        usage: 0,
      });
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .post('/api/bills/meter-readings')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          roomId: 'room-1',
          meterType: 'WATER',
          readingDate: '2025-06-01',
          value: 150,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('mr-new');
      expect(prisma.meterReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            roomId: 'room-1',
            meterType: 'WATER',
            value: 150,
            createdById: 'user-1',
          }),
        })
      );
    });

    it('should return 404 when room not found', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/bills/meter-readings')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          roomId: 'non-existent',
          meterType: 'WATER',
          readingDate: '2025-06-01',
          value: 150,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('房间不存在');
    });
  });

  describe('POST /api/bills/:id/utility-reading', () => {
    it('should apply utility reading to a POSTPAID bill', async () => {
      const bill = mockBillData({ mode: 'POSTPAID', status: 'BILLING' });
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        bill
      );
      (calculateUtilityLineAmounts as ReturnType<typeof vi.fn>).mockReturnValue(
        {
          waterAmount: 25,
          powerAmount: 36,
        }
      );
      (prisma.billItem.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );
      (prisma.bill.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (
        prisma.meterReading.createMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 4 });
      (refreshBillTotals as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );
      (prisma.bill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...bill,
        status: 'UNPAID',
        items: [
          { ...bill.items[0], amount: 1500 },
          {
            ...bill.items[1],
            amount: 25,
            previousWater: 100,
            currentWater: 105,
          },
          {
            ...bill.items[2],
            amount: 36,
            previousPower: 200,
            currentPower: 230,
          },
        ],
      });

      const res = await request(app)
        .post('/api/bills/bill-1/utility-reading')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          previousWater: 100,
          currentWater: 105,
          previousPower: 200,
          currentPower: 230,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('UNPAID');
      expect(calculateUtilityLineAmounts).toHaveBeenCalled();
      expect(prisma.bill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bill-1' },
          data: expect.objectContaining({
            status: 'UNPAID',
            failureReason: null,
          }),
        })
      );
    });

    it('should reject non-POSTPAID bills', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ mode: 'PREPAID' })
      );

      const res = await request(app)
        .post('/api/bills/bill-1/utility-reading')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          previousWater: 100,
          currentWater: 105,
          previousPower: 200,
          currentPower: 230,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅后付费水电账单可以录入读数');
    });
  });

  describe('GET /api/bills/utility/pending-export', () => {
    it('should export pending utility bills as CSV', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockBillData({ mode: 'POSTPAID', status: 'BILLING' }),
      ]);
      (toCsv as ReturnType<typeof vi.fn>).mockReturnValue(
        'billId,房间号\nbill-1,101\n'
      );

      const res = await request(app)
        .get('/api/bills/utility/pending-export')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('billId');
    });
  });

  describe('POST /api/bills/:id/retry-billing', () => {
    it('should retry a POSTPAID bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ mode: 'POSTPAID', status: 'FAILED' })
      );
      (retryPostpaidBill as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-1',
        status: 'UNPAID',
      });

      const res = await request(app)
        .post('/api/bills/bill-1/retry-billing')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('UNPAID');
      expect(retryPostpaidBill).toHaveBeenCalledWith('bill-1');
    });

    it('should reject non-POSTPAID bills', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ mode: 'PREPAID' })
      );

      const res = await request(app)
        .post('/api/bills/bill-1/retry-billing')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅后付费账单需要重新出账');
    });
  });

  describe('GET /api/bills/:id', () => {
    it('should return bill detail', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData()
      );

      const res = await request(app)
        .get('/api/bills/bill-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('bill-1');
      expect(res.body.data.lease).toBeDefined();
      expect(prisma.bill.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bill-1', organizationId: 'org-1' },
          include: expect.objectContaining({
            lease: { include: { room: true } },
            items: true,
            payments: true,
          }),
        })
      );
    });

    it('should return 404 for non-existent bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/bills/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('账单不存在');
    });
  });

  describe('POST /api/bills/:id/payments', () => {
    it('should record a payment', async () => {
      (recordBillPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'pay-1',
        amount: 1000,
        bill: { id: 'bill-1', status: 'PARTIAL_PAID' },
      });

      const res = await request(app)
        .post('/api/bills/bill-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 1000, method: '微信支付' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('pay-1');
      expect(recordBillPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          billId: 'bill-1',
          organizationId: 'org-1',
          userId: 'user-1',
          amount: 1000,
          method: '微信支付',
        })
      );
    });
  });

  describe('DELETE /api/bills/:id', () => {
    it('should soft delete a bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'DRAFT' })
      );
      (prisma.bill.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );

      const res = await request(app)
        .delete('/api/bills/bill-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(prisma.bill.softDelete).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
      });
    });

    it('should reject deleting a PAID bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'PAID' })
      );

      const res = await request(app)
        .delete('/api/bills/bill-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('已结清账单不能删除');
      expect(prisma.bill.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/bills/:id/items/:itemId', () => {
    it('should update a bill item', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'UNPAID' })
      );
      (prisma.billItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: 'item-1',
          name: '房租',
          amount: 1500,
        }
      );
      (prisma.billItem.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'item-1',
        amount: 1800,
      });
      (refreshBillTotals as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const res = await request(app)
        .put('/api/bills/bill-1/items/item-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 1800 });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('子项已更新');
      expect(prisma.billItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({ amount: 1800 }),
        })
      );
      expect(refreshBillTotals).toHaveBeenCalledWith('bill-1');
    });

    it('should reject modifying PAID bill items', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'PAID' })
      );

      const res = await request(app)
        .put('/api/bills/bill-1/items/item-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ amount: 1800 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('已结清账单不可修改');
    });
  });

  describe('PATCH /api/bills/:id/status', () => {
    it('should void a bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'UNPAID' })
      );
      (prisma.bill.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'VOID', note: '重复出账' })
      );

      const res = await request(app)
        .patch('/api/bills/bill-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'VOID', reason: '重复出账' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VOID');
      expect(prisma.bill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bill-1' },
          data: { status: 'VOID', note: '重复出账' },
        })
      );
    });

    it('should reject voiding a PAID bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'PAID' })
      );

      const res = await request(app)
        .patch('/api/bills/bill-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'VOID', reason: '不需要了' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('已结清账单不能作废');
    });
  });

  describe('PATCH /api/bills/:id/write-off', () => {
    it('should write off a bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'UNPAID' })
      );
      (prisma.bill.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'VOID', note: '租客已搬离' })
      );

      const res = await request(app)
        .patch('/api/bills/bill-1/write-off')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ reason: '租客已搬离' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VOID');
      expect(prisma.bill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bill-1' },
          data: { status: 'VOID', note: '租客已搬离' },
        })
      );
    });

    it('should reject writing off a PAID bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'PAID' })
      );

      const res = await request(app)
        .patch('/api/bills/bill-1/write-off')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ reason: '不需要了' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('已结清账单不能核销');
    });
  });

  describe('PATCH /api/bills/:id/waive-late-fee', () => {
    it('should waive late fees', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'OVERDUE' })
      );
      (refreshBillTotals as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const res = await request(app)
        .patch('/api/bills/bill-1/waive-late-fee')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('滞纳金已减免');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(refreshBillTotals).toHaveBeenCalledWith('bill-1');
    });

    it('should reject waiving late fees on PAID bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillData({ status: 'PAID' })
      );

      const res = await request(app)
        .patch('/api/bills/bill-1/waive-late-fee')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('已结清账单无法减免');
    });
  });
});
