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

vi.mock('../../src/services/billing.js', () => ({
  getCurrentMonthBillWindow: vi.fn(() => ({
    start: new Date('2026-07-01'),
    end: new Date('2026-08-01'),
  })),
  getBillMonthLabel: vi.fn(() => '2026年7月'),
}));

vi.mock('../../src/services/leaseLifecycle.js', () => ({
  withLeaseLifecycle: vi.fn((lease: any) => lease),
}));

vi.mock('../../src/services/quotas.js', () => ({
  enforceOrganizationQuota: vi.fn(),
}));

vi.mock('../../src/prisma/client.js', () => {
  const tx = {
    systemSetting: { findUnique: vi.fn(async () => null) },
    apartment: {
      count: vi.fn(),
      create: vi.fn(async ({ data }: any) => ({ id: 'apartment-1', ...data })),
    },
    room: { findMany: vi.fn(), createMany: vi.fn() },
    $executeRaw: vi.fn(),
  };

  const mockPrisma = {
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
    ),
    systemSetting: { findUnique: vi.fn(async () => null) },
    apartment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      softDelete: vi.fn(async ({ where }: any) => {
        mockPrisma.apartment.update({ where, data: { deletedAt: new Date() } });
        return { id: where.id, deletedAt: new Date() };
      }),
    },
    room: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMany: vi.fn(),
      softDelete: vi.fn(async ({ where }: any) => {
        mockPrisma.room.update({ where, data: { deletedAt: new Date() } });
        return { id: where.id, deletedAt: new Date() };
      }),
    },
    lease: {
      count: vi.fn(),
    },
    apartmentExpense: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
    __tx: tx,
  };

  return {
    prisma: mockPrisma,
    basePrisma: mockPrisma,
  };
});

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

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
    (
      (prisma as any).__tx.systemSetting.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
  });

  describe('GET /api/apartments', () => {
    it('should return apartments with rooms and leases', async () => {
      (prisma.apartment.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.apartment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [
          {
            id: 'apt-1',
            name: '阳光公寓',
            rooms: [
              {
                id: 'room-1',
                roomNo: '101',
                leases: [
                  {
                    id: 'lease-1',
                    tenantName: '张三',
                    bills: [],
                    fees: [],
                  },
                ],
              },
            ],
            expenses: [],
          },
        ]
      );

      const res = await request(app)
        .get('/api/apartments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.pageSize).toBe(20);

      const apartment = res.body.data.items[0];
      expect(apartment.id).toBe('apt-1');
      expect(apartment.name).toBe('阳光公寓');
      expect(Array.isArray(apartment.rooms)).toBe(true);

      const room = apartment.rooms[0];
      expect(room.id).toBe('room-1');
      expect(room.roomNo).toBe('101');
      expect(Array.isArray(room.leases)).toBe(true);

      const lease = room.leases[0];
      expect(lease.id).toBe('lease-1');
      expect(lease.tenantName).toBe('张三');
      expect(lease.currentMonthBillGenerated).toBe(false);
      expect(lease.currentMonthBillSettled).toBe(false);
      expect(lease.currentMonthBillLabel).toBe('2026年7月');
    });
  });

  describe('GET /api/apartments/rooms', () => {
    it('should return rooms across apartments', async () => {
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
      expect(res.body.data[0].id).toBe('room-1');
      expect(res.body.data[0].apartment.name).toBe('阳光公寓');
    });
  });

  describe('POST /api/apartments', () => {
    it('should not persist utility unit prices on apartments', async () => {
      const res = await request(app)
        .post('/api/apartments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          name: '阳光公寓',
          location: '城南',
          floors: 6,
          waterUnitPrice: 4,
          powerUnitPrice: 1.2,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('apartment-1');
      expect(res.body.data.name).toBe('阳光公寓');
      expect((prisma as any).__tx.apartment.create).toHaveBeenCalledWith({
        data: {
          name: '阳光公寓',
          location: '城南',
          floors: 6,
          organizationId: 'org-1',
        },
      });
    });
  });

  describe('PUT /api/apartments/:id', () => {
    it('should update an apartment', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.apartment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'apt-1',
        name: '新名字',
      });

      const res = await request(app)
        .put('/api/apartments/apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名字', location: '城北', floors: 8 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('新名字');
    });

    it('should return 404 for non-existent apartment', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/apartments/apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名字' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/apartments/:id', () => {
    it('should delete an apartment without active leases', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.apartment.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'apt-1',
      });

      const res = await request(app)
        .delete('/api/apartments/apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
    });

    it('should reject deleting apartment with active leases', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const res = await request(app)
        .delete('/api/apartments/apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/apartments/:id/expenses', () => {
    it('should create an expense', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });
      (
        prisma.apartmentExpense.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'exp-1', name: '维修费', amount: 500 });

      const res = await request(app)
        .post('/api/apartments/apt-1/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '维修费', amount: 500, spentAt: '2026-05-01' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('维修费');
    });
  });

  describe('POST /api/apartments/:id/rooms/batch', () => {
    it('should batch create rooms', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'apt-1' });

      const res = await request(app)
        .post('/api/apartments/apt-1/rooms/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          rooms: [
            { roomNo: '101', layout: '一室一厅' },
            { roomNo: '102', layout: '两室一厅', area: 60 },
          ],
        });

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/apartments/rooms/:roomId', () => {
    it('should update a room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
      });
      (prisma.room.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
        roomNo: '101A',
      });

      const res = await request(app)
        .put('/api/apartments/rooms/room-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ roomNo: '101A', layout: '一室一厅' });

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent room', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .put('/api/apartments/rooms/room-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ roomNo: '101A' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/apartments/rooms/:roomId', () => {
    it('should delete a room without active leases', async () => {
      (prisma.room.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
      });
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.room.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'room-1',
      });

      const res = await request(app)
        .delete('/api/apartments/rooms/room-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
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
    });
  });
});
