import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockTxApartment = {
  create: vi.fn(),
  count: vi.fn(),
};
const mockTxRoom = {
  createMany: vi.fn(),
  findMany: vi.fn(),
};

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
    apartment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      count: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      softDelete: vi.fn(),
    },
    lease: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    apartmentExpense: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
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
  basePrisma: {
    $transaction: vi.fn(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback({
          apartment: mockTxApartment,
          room: mockTxRoom,
        });
      }
      for (const p of callback) await p;
    }),
  },
}));

vi.mock('../../src/services/billing.js', () => ({
  getCurrentMonthBillWindow: vi.fn(() => ({
    start: new Date('2026-05-01'),
    end: new Date('2026-06-01'),
  })),
  getBillMonthLabel: vi.fn(() => '2026年5月'),
}));

vi.mock('../../src/services/leaseLifecycle.js', () => ({
  withLeaseLifecycle: vi.fn((lease: any) => ({
    ...lease,
    isAutoRenewalPeriod: false,
  })),
}));

vi.mock('../../src/services/quotas.js', () => ({
  enforceOrganizationQuota: vi.fn(async () => {}),
}));

import { app } from '../../src/app.js';
import { prisma, basePrisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('apartments routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/apartments', () => {
    it('should return paginated apartment list with billing info', async () => {
      (prisma.apartment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [
          {
            id: 'apt-1',
            name: '阳光公寓',
            status: 'ACTIVE',
            rooms: [
              {
                id: 'room-1',
                roomNo: '101',
                leases: [
                  {
                    id: 'lease-1',
                    status: 'ACTIVE',
                    fees: [],
                    bills: [{ id: 'bill-1', status: 'UNPAID' }],
                  },
                ],
              },
            ],
            expenses: [],
          },
        ]
      );
      (prisma.apartment.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/apartments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.page).toBe(1);
      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter by status and propertyType', async () => {
      (prisma.apartment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (prisma.apartment.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/apartments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ status: 'ACTIVE', propertyType: 'RESIDENTIAL' });

      expect(res.status).toBe(200);
      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            propertyType: 'RESIDENTIAL',
          }),
        })
      );
    });

    it('should filter by search keyword', async () => {
      (prisma.apartment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (prisma.apartment.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/apartments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ search: '阳光' });

      expect(res.status).toBe(200);
      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: '阳光', mode: 'insensitive' } },
              { location: { contains: '阳光', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });

  describe('GET /api/apartments/all', () => {
    it('should return all apartments', async () => {
      (prisma.apartment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [
          {
            id: 'apt-1',
            name: '阳光公寓',
            rooms: [],
            expenses: [],
          },
        ]
      );

      const res = await request(app)
        .get('/api/apartments/all')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', deletedAt: null },
        })
      );
    });
  });

  describe('POST /api/apartments', () => {
    it('should create an apartment', async () => {
      mockTxApartment.create.mockResolvedValue({
        id: 'apt-new',
        name: '新公寓',
        location: '北京市',
        floors: 6,
      });
      (prisma.apartment.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const res = await request(app)
        .post('/api/apartments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新公寓', location: '北京市', floors: 6 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('新公寓');
      expect(basePrisma.$transaction).toHaveBeenCalled();
      expect(mockTxApartment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '新公寓',
            location: '北京市',
            floors: 6,
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should reject apartment with no name', async () => {
      const res = await request(app)
        .post('/api/apartments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '', location: '上海市', floors: 1 });

      expect(res.status).toBe(400);
      expect(basePrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/apartments/:id', () => {
    it('should return a single apartment', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'apt-1',
        name: '阳光公寓',
        rooms: [],
        expenses: [],
        landlordContracts: [],
      });

      const res = await request(app)
        .get('/api/apartments/apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('阳光公寓');
      expect(prisma.apartment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'apt-1',
            organizationId: 'org-1',
            deletedAt: null,
          },
        })
      );
    });

    it('should return 404 for non-existent apartment', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/apartments/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('公寓不存在');
    });
  });

  describe('PUT /api/apartments/:id', () => {
    it('should update an apartment', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.apartment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'apt-1',
        name: '新名称',
        location: '新地址',
      });

      const res = await request(app)
        .put('/api/apartments/apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名称', location: '新地址' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('新名称');
      expect(prisma.apartment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apt-1', organizationId: 'org-1', deletedAt: null },
        })
      );
      expect(prisma.apartment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apt-1' },
          data: expect.objectContaining({ name: '新名称' }),
        })
      );
    });

    it('should return 404 for non-existent apartment', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/apartments/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名称' });

      expect(res.status).toBe(404);
      expect(prisma.apartment.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/apartments/:id', () => {
    it('should delete an apartment with no active leases', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (
        prisma.apartment.softDelete as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      const res = await request(app)
        .delete('/api/apartments/apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(prisma.apartment.softDelete).toHaveBeenCalledWith({
        where: { id: 'apt-1' },
      });
    });

    it('should reject deleting apartment with active leases', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const res = await request(app)
        .delete('/api/apartments/apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('公寓存在活跃租约，无法删除');
      expect(prisma.apartment.softDelete).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent apartment', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/apartments/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(prisma.apartment.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/apartments/rooms', () => {
    it('should return all rooms across apartments', async () => {
      (prisma.room.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'room-1',
          roomNo: '101',
          apartment: { id: 'apt-1', name: '阳光公寓' },
          leases: [],
        },
      ]);

      const res = await request(app)
        .get('/api/apartments/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { apartment: { organizationId: 'org-1' } },
        })
      );
    });
  });

  describe('POST /api/apartments/:id/rooms/batch', () => {
    it('should batch create rooms', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      mockTxRoom.createMany.mockResolvedValue({ count: 2 });

      const res = await request(app)
        .post('/api/apartments/apt-1/rooms/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          rooms: [
            { roomNo: '101', layout: '一室一厅' },
            { roomNo: '102', layout: '一室一厅' },
          ],
        });

      expect(res.status).toBe(200);
      expect(basePrisma.$transaction).toHaveBeenCalled();
      expect(mockTxRoom.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              roomNo: '101',
              apartmentId: 'apt-1',
            }),
          ]),
          skipDuplicates: true,
        })
      );
    });
  });

  describe('POST /api/apartments/:id/expenses', () => {
    it('should create an apartment expense', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (
        prisma.apartmentExpense.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'exp-1',
        name: '维修费',
        amount: 500,
        apartmentId: 'apt-1',
      });

      const res = await request(app)
        .post('/api/apartments/apt-1/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          name: '维修费',
          amount: 500,
          spentAt: '2026-05-15T00:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('维修费');
      expect(prisma.apartmentExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '维修费',
            amount: 500,
            apartmentId: 'apt-1',
          }),
        })
      );
    });
  });

  describe('PUT /api/apartments/rooms/:roomId', () => {
    it('should update a room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
      });
      (prisma.room.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        roomNo: '101',
        status: 'VACANT',
      });

      const res = await request(app)
        .put('/api/apartments/rooms/room-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'VACANT' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VACANT');
      expect(prisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: { status: 'VACANT' },
        })
      );
    });

    it('should return 404 for non-existent room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .put('/api/apartments/rooms/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'VACANT' });

      expect(res.status).toBe(404);
      expect(prisma.room.update).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/apartments/rooms/:roomId', () => {
    it('should return a single room with billing enrichment', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        roomNo: '101',
        apartment: { id: 'apt-1', name: '阳光公寓' },
        leases: [],
      });

      const res = await request(app)
        .get('/api/apartments/rooms/room-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.roomNo).toBe('101');
    });

    it('should return 404 for non-existent room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/apartments/rooms/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/apartments/rooms/:roomId', () => {
    it('should delete a room with no active leases', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
      });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.room.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );

      const res = await request(app)
        .delete('/api/apartments/rooms/room-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(prisma.room.softDelete).toHaveBeenCalledWith({
        where: { id: 'room-1' },
      });
    });

    it('should reject deleting room with active leases', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
      });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const res = await request(app)
        .delete('/api/apartments/rooms/room-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('房间存在活跃租约，无法删除');
      expect(prisma.room.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/apartments/rooms/batch/facilities', () => {
    it('should batch update room facilities', async () => {
      (prisma.room.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 2,
      });

      const res = await request(app)
        .put('/api/apartments/rooms/batch/facilities')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          roomIds: ['room-1', 'room-2'],
          facilities: ['空调', '洗衣机'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2);
      expect(prisma.room.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['room-1', 'room-2'] },
            apartment: { organizationId: 'org-1' },
          },
          data: { facilities: ['空调', '洗衣机'] },
        })
      );
    });
  });

  describe('PUT /api/apartments/rooms/batch/rent', () => {
    it('should batch update room rent prices', async () => {
      (prisma.room.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 3,
      });

      const res = await request(app)
        .put('/api/apartments/rooms/batch/rent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ roomIds: ['room-1', 'room-2', 'room-3'], rentPrice: 2500 });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(3);
      expect(prisma.room.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['room-1', 'room-2', 'room-3'] },
            apartment: { organizationId: 'org-1' },
          },
          data: { currentRentPrice: 2500 },
        })
      );
    });
  });

  describe('PATCH /api/apartments/:id/status', () => {
    it('should update apartment status', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.apartment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'apt-1',
        status: 'ACTIVE',
      });

      const res = await request(app)
        .patch('/api/apartments/apt-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'ACTIVE', reason: '装修完成' });

      expect(res.status).toBe(200);
      expect(prisma.apartment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apt-1' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            statusReason: '装修完成',
          }),
        })
      );
    });
  });

  describe('GET /api/apartments/:id/status-history', () => {
    it('should return status change history', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'log-1',
          tableName: 'Apartment',
          recordId: 'apt-1',
          action: 'UPDATE',
          fieldName: 'status',
        },
      ]);

      const res = await request(app)
        .get('/api/apartments/apt-1/status-history')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            tableName: 'Apartment',
            recordId: 'apt-1',
            action: 'UPDATE',
            fieldName: 'status',
          },
        })
      );
    });
  });

  describe('GET /api/apartments/:id/expense-summary', () => {
    it('should return expense summary grouped by category', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (
        prisma.apartmentExpense.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'exp-1',
          name: '维修费',
          amount: 500,
          category: { name: '维修' },
        },
        {
          id: 'exp-2',
          name: '清洁费',
          amount: 200,
          category: { name: '清洁' },
        },
      ]);

      const res = await request(app)
        .get('/api/apartments/apt-1/expense-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .query({ year: 2026 });

      expect(res.status).toBe(200);
      expect(res.body.data.expenses).toHaveLength(2);
      expect(res.body.data.total).toBe(700);
      expect(res.body.data.byCategory).toBeDefined();
    });
  });

  describe('GET /api/apartments/:id/occupancy-trend', () => {
    it('should return 12-month occupancy trend', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (
        prisma.apartment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'apt-1',
        rooms: [{ id: 'room-1' }, { id: 'room-2' }],
      });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/apartments/apt-1/occupancy-trend')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(12);
      res.body.data.forEach((item: any) => {
        expect(item).toHaveProperty('month');
        expect(item).toHaveProperty('occupancyRate');
      });
    });
  });

  describe('GET /api/apartments/:id/rent-distribution', () => {
    it('should return rent distribution buckets', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { rentAmount: 1500 },
        { rentAmount: 2500 },
      ]);

      const res = await request(app)
        .get('/api/apartments/apt-1/rent-distribution')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((item: any) => {
        expect(item).toHaveProperty('range');
        expect(item).toHaveProperty('count');
      });
    });
  });

  describe('GET /api/apartments/:id/dashboard', () => {
    it('should return apartment dashboard', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (
        prisma.apartment.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'apt-1',
        rooms: [
          {
            id: 'room-1',
            status: 'OCCUPIED',
            leases: [
              {
                id: 'lease-1',
                status: 'ACTIVE',
                bills: [
                  {
                    billingDate: new Date('2026-05-15'),
                    totalAmount: 2000,
                    paidAmount: 1500,
                    status: 'PARTIAL_PAID',
                  },
                ],
              },
            ],
          },
          {
            id: 'room-2',
            status: 'VACANT',
            leases: [],
          },
        ],
        expenses: [],
      });

      const res = await request(app)
        .get('/api/apartments/apt-1/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalRooms');
      expect(res.body.data).toHaveProperty('occupiedRooms');
      expect(res.body.data).toHaveProperty('vacantRooms');
      expect(res.body.data).toHaveProperty('occupancyRate');
      expect(res.body.data.currentMonth).toHaveProperty('receivable');
      expect(res.body.data.currentMonth).toHaveProperty('received');
    });
  });

  describe('authentication', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/apartments');
      expect(res.status).toBe(401);
    });
  });
});
