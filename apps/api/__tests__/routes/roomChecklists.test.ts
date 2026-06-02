import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockTxRoomChecklistItemDeleteMany = vi.fn();
const mockTxRoomChecklistItemCreateMany = vi.fn();
const mockTxRoomChecklistUpdate = vi.fn();

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
          roomChecklistItem: {
            deleteMany: mockTxRoomChecklistItemDeleteMany,
            createMany: mockTxRoomChecklistItemCreateMany,
          },
          roomChecklist: {
            update: mockTxRoomChecklistUpdate,
          },
        });
      }
      for (const p of callback) await p;
    }),
    roomChecklist: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(async ({ where }: any) => {
        return { id: where.id, deletedAt: new Date() };
      }),
    },
    roomChecklistItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
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

describe('roomChecklists routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/room-checklists', () => {
    it('should return checklists with filters', async () => {
      (
        prisma.roomChecklist.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'cl-1',
          checkType: 'CHECKIN',
          checkDate: new Date(),
          lease: {
            id: 'lease-1',
            room: {
              id: 'room-1',
              roomNo: '101',
              apartment: { id: 'apt-1', name: '阳光公寓' },
            },
          },
          room: { id: 'room-1', roomNo: '101' },
          items: [
            {
              id: 'item-1',
              category: '门窗',
              itemName: '大门',
              status: '完好',
            },
          ],
        },
      ]);

      const res = await request(app)
        .get('/api/room-checklists')
        .query({ leaseId: 'lease-1', roomId: 'room-1', checkType: 'CHECKIN' })
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('cl-1');
      expect(res.body.data[0].checkType).toBe('CHECKIN');
      expect(res.body.data[0].lease).toBeDefined();
      expect(res.body.data[0].room).toBeDefined();
      expect(Array.isArray(res.body.data[0].items)).toBe(true);
      expect(prisma.roomChecklist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            leaseId: 'lease-1',
            roomId: 'room-1',
            checkType: 'CHECKIN',
          }),
          include: expect.objectContaining({
            lease: expect.objectContaining({
              include: expect.objectContaining({
                room: expect.objectContaining({
                  include: expect.objectContaining({ apartment: true }),
                }),
              }),
            }),
            room: true,
            items: true,
          }),
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/room-checklists');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/room-checklists', () => {
    it('should create a checklist with items', async () => {
      (
        prisma.roomChecklist.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cl-1',
        leaseId: 'lease-1',
        roomId: 'room-1',
        checkType: 'CHECKIN',
        checkDate: new Date('2026-07-01'),
        lease: {
          id: 'lease-1',
          room: {
            id: 'room-1',
            roomNo: '101',
            apartment: { id: 'apt-1', name: '阳光公寓' },
          },
        },
        room: { id: 'room-1', roomNo: '101' },
        items: [
          { id: 'item-1', category: '门窗', itemName: '大门', status: '完好' },
        ],
      });

      const res = await request(app)
        .post('/api/room-checklists')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          leaseId: 'lease-1',
          roomId: 'room-1',
          checkType: 'CHECKIN',
          checkDate: '2026-07-01',
          items: [{ category: '门窗', itemName: '大门', status: '完好' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('cl-1');
      expect(res.body.data.checkType).toBe('CHECKIN');
      expect(res.body.data.lease).toBeDefined();
      expect(res.body.data.room).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(prisma.roomChecklist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leaseId: 'lease-1',
            roomId: 'room-1',
            checkType: 'CHECKIN',
            checkDate: expect.any(Date),
            organizationId: 'org-1',
            checkedById: 'user-1',
            items: {
              create: [{ category: '门窗', itemName: '大门', status: '完好' }],
            },
          }),
          include: expect.objectContaining({
            lease: expect.objectContaining({
              include: expect.objectContaining({
                room: expect.objectContaining({
                  include: expect.objectContaining({ apartment: true }),
                }),
              }),
            }),
            room: true,
            items: true,
          }),
        })
      );
    });

    it('should create a checklist without items', async () => {
      (
        prisma.roomChecklist.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cl-2',
        leaseId: 'lease-1',
        roomId: 'room-1',
        checkType: 'CHECKOUT',
        checkDate: new Date('2026-07-01'),
        lease: {
          id: 'lease-1',
          room: {
            id: 'room-1',
            roomNo: '101',
            apartment: { id: 'apt-1', name: '阳光公寓' },
          },
        },
        room: { id: 'room-1', roomNo: '101' },
        items: [],
      });

      const res = await request(app)
        .post('/api/room-checklists')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          leaseId: 'lease-1',
          roomId: 'room-1',
          checkType: 'CHECKOUT',
          checkDate: '2026-07-01',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('cl-2');
      expect(res.body.data.checkType).toBe('CHECKOUT');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(prisma.roomChecklist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: { create: [] },
          }),
        })
      );
    });
  });

  describe('GET /api/room-checklists/:id', () => {
    it('should return checklist detail', async () => {
      (
        prisma.roomChecklist.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cl-1',
        checkType: 'CHECKIN',
        lease: {
          id: 'lease-1',
          room: {
            id: 'room-1',
            roomNo: '101',
            apartment: { id: 'apt-1', name: '阳光公寓' },
          },
        },
        room: { id: 'room-1', roomNo: '101' },
        items: [],
      });

      const res = await request(app)
        .get('/api/room-checklists/cl-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('cl-1');
      expect(res.body.data.lease).toBeDefined();
      expect(res.body.data.room).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(prisma.roomChecklist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cl-1', organizationId: 'org-1' },
          include: expect.objectContaining({
            lease: expect.objectContaining({
              include: expect.objectContaining({
                room: expect.objectContaining({
                  include: expect.objectContaining({ apartment: true }),
                }),
              }),
            }),
            room: true,
            items: true,
          }),
        })
      );
    });

    it('should return 404 for non-existent checklist', async () => {
      (
        prisma.roomChecklist.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/room-checklists/cl-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('检查清单不存在');
      expect(prisma.roomChecklist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cl-1', organizationId: 'org-1' },
        })
      );
    });
  });

  describe('PUT /api/room-checklists/:id', () => {
    it('should update checklist and replace items', async () => {
      (
        prisma.roomChecklist.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cl-1',
        items: [
          { id: 'item-1', category: '门窗', itemName: '大门', status: '完好' },
        ],
      });
      mockTxRoomChecklistItemDeleteMany.mockResolvedValue({ count: 1 });
      mockTxRoomChecklistItemCreateMany.mockResolvedValue({ count: 1 });
      mockTxRoomChecklistUpdate.mockResolvedValue({
        id: 'cl-1',
        checkDate: new Date('2026-07-02'),
        note: '已更新',
        lease: {
          id: 'lease-1',
          room: {
            id: 'room-1',
            roomNo: '101',
            apartment: { id: 'apt-1', name: '阳光公寓' },
          },
        },
        room: { id: 'room-1', roomNo: '101' },
        items: [
          {
            id: 'item-2',
            category: '门窗',
            itemName: '大门',
            status: '损坏',
          },
        ],
      });

      const res = await request(app)
        .put('/api/room-checklists/cl-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          checkDate: '2026-07-02',
          note: '已更新',
          items: [{ category: '门窗', itemName: '大门', status: '损坏' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('cl-1');
      expect(res.body.data.note).toBe('已更新');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(prisma.roomChecklist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cl-1', organizationId: 'org-1' },
          include: { items: true },
        })
      );
      expect(mockTxRoomChecklistItemDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { checklistId: 'cl-1' } })
      );
      expect(mockTxRoomChecklistItemCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              category: '门窗',
              itemName: '大门',
              status: '损坏',
              checklistId: 'cl-1',
            }),
          ]),
        })
      );
      expect(mockTxRoomChecklistUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cl-1' },
          data: expect.objectContaining({
            checkDate: expect.any(Date),
            note: '已更新',
          }),
          include: expect.objectContaining({
            lease: expect.objectContaining({
              include: expect.objectContaining({
                room: expect.objectContaining({
                  include: expect.objectContaining({ apartment: true }),
                }),
              }),
            }),
            room: true,
            items: true,
          }),
        })
      );
    });

    it('should update checklist metadata without items', async () => {
      (
        prisma.roomChecklist.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cl-1',
        items: [],
      });
      mockTxRoomChecklistUpdate.mockResolvedValue({
        id: 'cl-1',
        note: '仅更新备注',
        lease: {
          id: 'lease-1',
          room: {
            id: 'room-1',
            roomNo: '101',
            apartment: { id: 'apt-1', name: '阳光公寓' },
          },
        },
        room: { id: 'room-1', roomNo: '101' },
        items: [],
      });

      const res = await request(app)
        .put('/api/room-checklists/cl-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ note: '仅更新备注' });

      expect(res.status).toBe(200);
      expect(res.body.data.note).toBe('仅更新备注');
      expect(mockTxRoomChecklistItemDeleteMany).not.toHaveBeenCalled();
      expect(mockTxRoomChecklistItemCreateMany).not.toHaveBeenCalled();
      expect(mockTxRoomChecklistUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cl-1' },
          data: expect.objectContaining({ note: '仅更新备注' }),
          include: expect.objectContaining({
            items: true,
          }),
        })
      );
    });

    it('should return 404 for non-existent checklist', async () => {
      (
        prisma.roomChecklist.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/room-checklists/cl-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ note: '测试' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('检查清单不存在');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/room-checklists/:id', () => {
    it('should soft delete a checklist', async () => {
      (
        prisma.roomChecklist.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cl-1',
      });
      (
        prisma.roomChecklist.softDelete as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cl-1',
        deletedAt: new Date(),
      });

      const res = await request(app)
        .delete('/api/room-checklists/cl-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(prisma.roomChecklist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cl-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.roomChecklist.softDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cl-1' } })
      );
    });

    it('should return 404 for non-existent checklist', async () => {
      (
        prisma.roomChecklist.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/room-checklists/cl-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('检查清单不存在');
      expect(prisma.roomChecklist.softDelete).not.toHaveBeenCalled();
    });
  });
});
