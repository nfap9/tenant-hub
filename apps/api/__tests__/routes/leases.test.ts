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
      if (typeof callback === 'function') {
        return callback({
          lease: {
            create: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
          },
          bill: {
            create: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
          },
          deposit: {
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
          },
          leaseFee: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          leaseChangeLog: { create: vi.fn() },
          room: { update: vi.fn() },
          leaseSettlement: { create: vi.fn() },
          meterReading: { createMany: vi.fn() },
          payment: { create: vi.fn() },
          billItem: { updateMany: vi.fn() },
          billQueue: { findUnique: vi.fn() },
        });
      }
      for (const p of callback) await p;
    }),
    lease: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
    room: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    leaseFee: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    leaseChangeLog: { create: vi.fn() },
    bill: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    deposit: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    billQueue: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    leaseSettlement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    settlementPayment: { create: vi.fn() },
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
  basePrisma: {},
}));

vi.mock('../../src/services/billing.js', () => ({
  generateLeaseBills: vi.fn(async () => {}),
  getBillMonthLabel: vi.fn(() => '2025年1月'),
  getCurrentMonthBillWindow: vi.fn(() => ({
    start: new Date('2025-01-01'),
    end: new Date('2025-02-01'),
  })),
}));

vi.mock('../../src/services/billQueue.js', () => ({
  populateBillQueue: vi.fn(async () => {}),
}));

vi.mock('../../src/services/leaseSettlement.js', () => ({
  createLeaseSettlement: vi.fn(),
  getLeaseSettlementPreview: vi.fn(),
  recordSettlementPayment: vi.fn(),
}));

vi.mock('../../src/services/tenant.js', () => ({
  findOrCreateTenant: vi.fn(),
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';
import { generateLeaseBills } from '../../src/services/billing.js';
import { populateBillQueue } from '../../src/services/billQueue.js';
import {
  createLeaseSettlement,
  getLeaseSettlementPreview,
  recordSettlementPayment,
} from '../../src/services/leaseSettlement.js';
import { findOrCreateTenant } from '../../src/services/tenant.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

const baseLease = {
  id: 'lease-1',
  organizationId: 'org-1',
  roomId: 'room-1',
  tenantId: 'tenant-1',
  tenantName: '张三',
  tenantPhone: '13800138000',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31'),
  billDay: 1,
  utilityBillDay: 1,
  paymentDueDays: 7,
  graceDays: 0,
  cycle: 'MONTHLY',
  rentAmount: 2000,
  depositAmount: 2000,
  depositMonths: 1,
  waterUnitPrice: 5,
  powerUnitPrice: 1,
  gasUnitPrice: 3,
  lateFeeRate: 0.0005,
  freeRentDays: 0,
  autoRenew: false,
  status: 'ACTIVE',
  signedBy: null,
  remark: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  parentLeaseId: null,
};

let txLeaseCreate: ReturnType<typeof vi.fn>;
let txLeaseFindUniqueOrThrow: ReturnType<typeof vi.fn>;
let txLeaseUpdate: ReturnType<typeof vi.fn>;
let txBillCreate: ReturnType<typeof vi.fn>;
let txDepositCreate: ReturnType<typeof vi.fn>;
let txDepositFindUnique: ReturnType<typeof vi.fn>;
let txDepositUpdate: ReturnType<typeof vi.fn>;
let txLeaseFeeDeleteMany: ReturnType<typeof vi.fn>;
let txLeaseFeeCreateMany: ReturnType<typeof vi.fn>;
let txLeaseChangeLogCreate: ReturnType<typeof vi.fn>;
let txRoomUpdate: ReturnType<typeof vi.fn>;

describe('leases routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    txLeaseCreate = vi.fn();
    txLeaseFindUniqueOrThrow = vi.fn();
    txLeaseUpdate = vi.fn();
    txBillCreate = vi.fn();
    txDepositCreate = vi.fn();
    txDepositFindUnique = vi.fn();
    txDepositUpdate = vi.fn();
    txLeaseFeeDeleteMany = vi.fn();
    txLeaseFeeCreateMany = vi.fn();
    txLeaseChangeLogCreate = vi.fn();
    txRoomUpdate = vi.fn();

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: any) => {
        if (typeof callback === 'function') {
          return callback({
            lease: {
              create: txLeaseCreate,
              findUniqueOrThrow: txLeaseFindUniqueOrThrow,
              update: txLeaseUpdate,
            },
            bill: {
              create: txBillCreate,
              findMany: vi.fn(),
              update: vi.fn(),
            },
            deposit: {
              create: txDepositCreate,
              findUnique: txDepositFindUnique,
              update: txDepositUpdate,
            },
            leaseFee: {
              deleteMany: txLeaseFeeDeleteMany,
              createMany: txLeaseFeeCreateMany,
            },
            leaseChangeLog: { create: txLeaseChangeLogCreate },
            room: { update: txRoomUpdate },
            leaseSettlement: { create: vi.fn() },
            meterReading: { createMany: vi.fn() },
            payment: { create: vi.fn() },
            billItem: { updateMany: vi.fn() },
            billQueue: { findUnique: vi.fn() },
          });
        }
        for (const p of callback) await p;
      }
    );

    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
    (findOrCreateTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'tenant-1',
      name: '张三',
      phone: '13800138000',
    });
    (generateLeaseBills as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (populateBillQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
  });

  describe('GET /api/leases', () => {
    it('should list leases with lifecycle info', async () => {
      (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          ...baseLease,
          room: { apartment: { id: 'apt-1' } },
          fees: [],
          deposit: null,
        },
      ]);

      const res = await request(app)
        .get('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('lease-1');
      expect(res.body.data[0].isAutoRenewalPeriod).toBeDefined();
      expect(prisma.lease.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/leases');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/leases', () => {
    const validPayload = {
      roomId: 'room-1',
      tenantName: '张三',
      tenantPhone: '13800138000',
      startDate: '2025-06-01',
      endDate: '2026-05-31',
      cycle: 'MONTHLY',
      rentAmount: 2000,
      depositAmount: 2000,
      waterUnitPrice: 5,
      powerUnitPrice: 1,
    };

    it('should create a lease with deposit', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        status: 'VACANT',
      });
      (prisma.room.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        status: 'OCCUPIED',
      });
      txLeaseCreate.mockResolvedValue({
        id: 'lease-1',
        room: { apartment: { id: 'apt-1' } },
        fees: [],
      });
      txBillCreate.mockResolvedValue({ id: 'bill-1' });
      txDepositCreate.mockResolvedValue({ id: 'dep-1' });
      txLeaseFindUniqueOrThrow.mockResolvedValue({
        ...baseLease,
        room: { apartment: { id: 'apt-1' } },
        fees: [],
        deposit: { id: 'dep-1', amount: 2000 },
      });

      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('lease-1');
      expect(prisma.room.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1', apartment: { organizationId: 'org-1' } },
        })
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txLeaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            tenantId: 'tenant-1',
            roomId: 'room-1',
            rentAmount: 2000,
            depositAmount: 2000,
          }),
        })
      );
      expect(txBillCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            leaseId: 'lease-1',
            mode: 'DEPOSIT',
            type: 'DEPOSIT',
            totalAmount: 2000,
          }),
        })
      );
      expect(txDepositCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            leaseId: 'lease-1',
            amount: 2000,
            status: 'UNPAID',
          }),
        })
      );
      expect(prisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: { status: 'OCCUPIED' },
        })
      );
      expect(generateLeaseBills).toHaveBeenCalledWith(
        'lease-1',
        expect.any(Date),
        expect.any(Object)
      );
    });

    it('should create a lease without deposit', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        status: 'VACANT',
      });
      (prisma.lease.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        room: { apartment: { id: 'apt-1' } },
        fees: [],
        deposit: null,
      });
      (prisma.room.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ ...validPayload, depositAmount: 0 });

      expect(res.status).toBe(200);
      expect(prisma.lease.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            depositAmount: 0,
            fees: { create: [] },
          }),
        })
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject non-VACANT room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        status: 'OCCUPIED',
      });

      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send(validPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅空闲房间可以签约');
      expect(prisma.lease.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject endDate before startDate', async () => {
      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          ...validPayload,
          startDate: '2026-06-01',
          endDate: '2025-05-31',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 404 for non-existent room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send(validPayload);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('房间不存在');
    });

    it('should auto-create tenant when tenantId not provided', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        status: 'VACANT',
      });
      (findOrCreateTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-new',
        name: '王五',
        phone: '13900139000',
      });
      (prisma.lease.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        room: { apartment: { id: 'apt-1' } },
        fees: [],
        deposit: null,
      });
      (prisma.room.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await request(app)
        .post('/api/leases')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          ...validPayload,
          tenantId: undefined,
          tenantName: '王五',
          tenantPhone: '13900139000',
          depositAmount: 0,
        });

      expect(res.status).toBe(200);
      expect(findOrCreateTenant).toHaveBeenCalledWith(
        'org-1',
        '王五',
        '13900139000'
      );
    });
  });

  describe('PUT /api/leases/:id', () => {
    it('should update an ACTIVE lease with fees', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        rentAmount: 2000,
        fees: [],
      });
      txLeaseUpdate.mockResolvedValue({
        ...baseLease,
        rentAmount: 2500,
        room: { apartment: { id: 'apt-1' } },
        fees: [
          { id: 'fee-1', type: 'MANAGEMENT', name: '管理费', amount: 100 },
        ],
        deposit: null,
      });

      const res = await request(app)
        .put('/api/leases/lease-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          rentAmount: 2500,
          fees: [{ type: 'MANAGEMENT', name: '管理费', amount: 100 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rentAmount).toBe(2500);
      expect(txLeaseFeeDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { leaseId: 'lease-1' } })
      );
      expect(txLeaseFeeCreateMany).toHaveBeenCalled();
      expect(txLeaseChangeLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leaseId: 'lease-1',
            fieldName: 'rentAmount',
            oldValue: '2000',
            newValue: '2500',
            changedById: 'user-1',
          }),
        })
      );
      expect(txLeaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lease-1' },
          data: expect.objectContaining({ rentAmount: 2500 }),
        })
      );
    });

    it('should reject updating non-ACTIVE lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        status: 'TERMINATED',
        fees: [],
      });

      const res = await request(app)
        .put('/api/leases/lease-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ rentAmount: 2500 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅有效租约可以变更');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .put('/api/leases/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ rentAmount: 2500 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租约不存在');
    });

    it('should update deposit when depositAmount changed and deposit is UNPAID', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        fees: [],
      });
      txDepositFindUnique.mockResolvedValue({
        id: 'dep-1',
        status: 'UNPAID',
        leaseId: 'lease-1',
      });
      txDepositUpdate.mockResolvedValue({ id: 'dep-1', amount: 3000 });
      txLeaseUpdate.mockResolvedValue({
        ...baseLease,
        depositAmount: 3000,
        room: { apartment: { id: 'apt-1' } },
        fees: [],
        deposit: { id: 'dep-1', amount: 3000, status: 'UNPAID' },
      });

      const res = await request(app)
        .put('/api/leases/lease-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ depositAmount: 3000 });

      expect(res.status).toBe(200);
      expect(txDepositUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { leaseId: 'lease-1' },
          data: { amount: 3000 },
        })
      );
    });
  });

  describe('POST /api/leases/:id/terminate', () => {
    it('should terminate a lease with settlement', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
        endDate: new Date('2025-12-31'),
      });
      (createLeaseSettlement as ReturnType<typeof vi.fn>).mockResolvedValue({
        settlement: { id: 'settlement-1' },
        settlementBill: { id: 'bill-1' },
      });

      const res = await request(app)
        .post('/api/leases/lease-1/terminate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          type: 'NEGOTIATED',
          terminatedAt: '2025-06-01',
          currentWater: 100,
          currentPower: 500,
          penaltyAmount: 300,
          penaltyReason: '提前解约',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.settlement.id).toBe('settlement-1');
      expect(createLeaseSettlement).toHaveBeenCalledWith(
        expect.objectContaining({
          leaseId: 'lease-1',
          organizationId: 'org-1',
          userId: 'user-1',
          input: expect.objectContaining({
            type: 'NEGOTIATED',
            penaltyAmount: 300,
          }),
        })
      );
    });

    it('should reject expired termination before original endDate', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
        endDate: new Date('2025-12-31'),
      });

      const res = await request(app)
        .post('/api/leases/lease-1/terminate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          type: 'EXPIRED',
          terminatedAt: '2025-06-01',
          currentWater: 100,
          currentPower: 500,
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/leases/non-existent/terminate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          type: 'NEGOTIATED',
          terminatedAt: '2025-06-01',
          currentWater: 100,
          currentPower: 500,
        });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/leases/:id/renew', () => {
    it('should renew an ACTIVE lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        room: { apartment: { id: 'apt-1' } },
        fees: [],
        deposit: {
          id: 'dep-1',
          amount: 2000,
          paidAmount: 0,
          status: 'UNPAID',
        },
      });
      txLeaseUpdate.mockResolvedValue({ id: 'lease-1', status: 'RENEWED' });
      txLeaseCreate.mockResolvedValue({
        ...baseLease,
        id: 'lease-2',
        parentLeaseId: 'lease-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        room: { apartment: { id: 'apt-1' } },
        fees: [],
      });
      txDepositCreate.mockResolvedValue({ id: 'dep-2' });

      const res = await request(app)
        .post('/api/leases/lease-1/renew')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          rentAmount: 2200,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.parentLeaseId).toBe('lease-1');
      expect(txLeaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lease-1' },
          data: { status: 'RENEWED' },
        })
      );
      expect(txLeaseChangeLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leaseId: 'lease-1',
            fieldName: 'status',
            newValue: 'RENEWED',
            reason: '续租',
          }),
        })
      );
      expect(txLeaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentLeaseId: 'lease-1',
            status: 'ACTIVE',
            rentAmount: 2200,
          }),
        })
      );
      expect(generateLeaseBills).toHaveBeenCalledWith(
        'lease-2',
        expect.any(Date)
      );
    });

    it('should reject renewing non-ACTIVE lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        status: 'TERMINATED',
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        fees: [],
      });

      const res = await request(app)
        .post('/api/leases/lease-1/renew')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅有效租约可以续租');
    });

    it('should reject endDate before startDate on renew', async () => {
      const res = await request(app)
        .post('/api/leases/lease-1/renew')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          startDate: '2026-06-01',
          endDate: '2025-05-31',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/leases/:id/room-change', () => {
    it('should change room for an ACTIVE lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        room: { id: 'room-1', apartment: { id: 'apt-1' } },
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        fees: [],
        deposit: {
          id: 'dep-1',
          amount: 2000,
          paidAmount: 2000,
          status: 'PAID',
        },
      });
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-2',
        status: 'VACANT',
      });
      txLeaseUpdate.mockResolvedValue({ id: 'lease-1' });
      txLeaseCreate.mockResolvedValue({
        ...baseLease,
        id: 'lease-2',
        roomId: 'room-2',
        parentLeaseId: 'lease-1',
        room: { apartment: { id: 'apt-1' } },
        fees: [],
      });
      txRoomUpdate.mockResolvedValue({ id: 'room-1' });
      txDepositUpdate.mockResolvedValue({ id: 'dep-1' });
      txDepositCreate.mockResolvedValue({ id: 'dep-2' });

      const res = await request(app)
        .post('/api/leases/lease-1/room-change')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          newRoomId: 'room-2',
          startDate: '2025-06-01',
          endDate: '2026-05-31',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.roomId).toBe('room-2');
      expect(res.body.data.parentLeaseId).toBe('lease-1');
      expect(txLeaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lease-1' },
          data: expect.objectContaining({
            status: 'TERMINATED',
            terminationType: 'NEGOTIATED',
            terminationReason: '换房',
          }),
        })
      );
      expect(txRoomUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: { status: 'CHECKOUT_CLEANING' },
        })
      );
      expect(generateLeaseBills).toHaveBeenCalledWith(
        'lease-2',
        expect.any(Date)
      );
    });

    it('should reject room-change for non-VACANT target room', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        room: { id: 'room-1', apartment: { id: 'apt-1' } },
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        fees: [],
        deposit: null,
      });
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-2',
        status: 'OCCUPIED',
      });

      const res = await request(app)
        .post('/api/leases/lease-1/room-change')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          newRoomId: 'room-2',
          startDate: '2025-06-01',
          endDate: '2026-05-31',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('目标房间不是空闲状态');
    });

    it('should reject room-change for non-ACTIVE lease', async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...baseLease,
        status: 'TERMINATED',
        tenant: { id: 'tenant-1', name: '张三', phone: '13800138000' },
        fees: [],
      });

      const res = await request(app)
        .post('/api/leases/lease-1/room-change')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          newRoomId: 'room-2',
          startDate: '2025-06-01',
          endDate: '2026-05-31',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('仅有效租约可以换房');
    });
  });

  describe('GET /api/leases/:id/settlement-preview', () => {
    it('should return settlement preview', async () => {
      (getLeaseSettlementPreview as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          previousWater: 50,
          previousPower: 200,
        }
      );

      const res = await request(app)
        .get('/api/leases/lease-1/settlement-preview')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.previousWater).toBe(50);
      expect(res.body.data.previousPower).toBe(200);
      expect(getLeaseSettlementPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          leaseId: 'lease-1',
          organizationId: 'org-1',
        })
      );
    });
  });

  describe('GET /api/leases/settlements', () => {
    it('should list all settlements', async () => {
      (
        prisma.leaseSettlement.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 's-1',
          type: 'NEGOTIATED',
          lease: {
            ...baseLease,
            room: { apartment: { id: 'apt-1' } },
            fees: [],
            deposit: null,
          },
          payments: [],
        },
      ]);

      const res = await request(app)
        .get('/api/leases/settlements')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.leaseSettlement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('POST /api/leases/settlements/:id/payments', () => {
    it('should record settlement payment', async () => {
      (recordSettlementPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'payment-1',
        amount: 500,
        direction: 'RECEIVE',
      });

      const res = await request(app)
        .post('/api/leases/settlements/settlement-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          direction: 'RECEIVE',
          amount: 500,
          method: '微信支付',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('payment-1');
      expect(recordSettlementPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          settlementId: 'settlement-1',
          organizationId: 'org-1',
          userId: 'user-1',
          direction: 'RECEIVE',
          amount: 500,
          method: '微信支付',
        })
      );
    });

    it('should record settlement refund with note', async () => {
      (recordSettlementPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'payment-2',
        amount: 300,
        direction: 'REFUND',
      });

      const res = await request(app)
        .post('/api/leases/settlements/settlement-1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          direction: 'REFUND',
          amount: 300,
          method: '银行转账',
          note: '退还多余押金',
        });

      expect(res.status).toBe(200);
      expect(recordSettlementPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'REFUND',
          amount: 300,
          method: '银行转账',
          note: '退还多余押金',
        })
      );
    });
  });
});
