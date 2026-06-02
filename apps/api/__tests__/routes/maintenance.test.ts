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
      if (typeof callback === 'function') return callback({});
      for (const p of callback) await p;
    }),
    maintenanceOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(async ({ where }: any) => ({
        id: where.id,
        deletedAt: new Date(),
      })),
    },
    maintenanceOrderItem: {
      findMany: vi.fn(),
    },
    notification: {
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

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('maintenance routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/maintenance', () => {
    it('should list maintenance orders', async () => {
      (
        prisma.maintenanceOrder.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'order-1',
          status: 'PENDING',
          title: '水龙头漏水',
          apartment: { id: 'apt-1', name: '阳光公寓' },
          room: { id: 'room-1', roomNo: '101' },
          items: [],
          createdBy: { id: 'user-1', username: '测试用户' },
        },
      ]);

      const res = await request(app)
        .get('/api/maintenance')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('order-1');
      expect(res.body.data[0].status).toBe('PENDING');
      expect(res.body.data[0].title).toBe('水龙头漏水');
      expect(res.body.data[0].apartment).toBeDefined();
      expect(res.body.data[0].room).toBeDefined();
      expect(Array.isArray(res.body.data[0].items)).toBe(true);
      expect(res.body.data[0].createdBy).toBeDefined();
      expect(prisma.maintenanceOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', deletedAt: null },
          include: {
            apartment: true,
            room: true,
            items: true,
            createdBy: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter by status', async () => {
      (
        prisma.maintenanceOrder.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/maintenance?status=COMPLETED')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.maintenanceOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
            organizationId: 'org-1',
            deletedAt: null,
          }),
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/maintenance');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/maintenance', () => {
    it('should create a maintenance order and call notification', async () => {
      (
        prisma.maintenanceOrder.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
        type: 'WATER_ELECTRIC',
        priority: 'NORMAL',
        title: '水龙头漏水',
        description: '厨房水龙头漏水',
        apartment: { id: 'apt-1' },
        room: { id: 'room-1' },
        items: [],
      });

      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          type: 'WATER_ELECTRIC',
          title: '水龙头漏水',
          description: '厨房水龙头漏水',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('order-1');
      expect(res.body.data.title).toBe('水龙头漏水');
      expect(prisma.maintenanceOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'WATER_ELECTRIC',
            title: '水龙头漏水',
            description: '厨房水龙头漏水',
            organizationId: 'org-1',
            createdById: 'user-1',
          }),
          include: { apartment: true, room: true, items: true },
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            userId: 'user-1',
            type: 'MAINTENANCE_CREATED',
            title: '新维修工单',
            content: '工单「水龙头漏水」已创建',
            link: '/maintenance/order-1',
          }),
        })
      );
    });
  });

  describe('GET /api/maintenance/:id', () => {
    it('should return order detail', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
        status: 'PENDING',
        title: '水龙头漏水',
        apartment: { id: 'apt-1', name: '阳光公寓' },
        room: { id: 'room-1', roomNo: '101' },
        items: [],
        createdBy: { id: 'user-1', username: '测试用户' },
      });

      const res = await request(app)
        .get('/api/maintenance/order-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('order-1');
      expect(res.body.data.title).toBe('水龙头漏水');
      expect(prisma.maintenanceOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'order-1',
            organizationId: 'org-1',
            deletedAt: null,
          },
          include: {
            apartment: true,
            room: true,
            items: true,
            createdBy: { select: { id: true, username: true } },
          },
        })
      );
    });

    it('should return 404 for non-existent order', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/maintenance/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('工单不存在');
    });
  });

  describe('PUT /api/maintenance/:id', () => {
    it('should update an order', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
      });
      (
        prisma.maintenanceOrder.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
        title: '更新标题',
        apartment: { id: 'apt-1' },
        room: { id: 'room-1' },
        items: [],
      });

      const res = await request(app)
        .put('/api/maintenance/order-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ title: '更新标题' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('order-1');
      expect(res.body.data.title).toBe('更新标题');
      expect(prisma.maintenanceOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'order-1',
            organizationId: 'org-1',
            deletedAt: null,
          },
        })
      );
      expect(prisma.maintenanceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: { title: '更新标题' },
          include: { apartment: true, room: true, items: true },
        })
      );
    });

    it('should return 404 for non-existent order', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/maintenance/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ title: '更新标题' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('工单不存在');
    });
  });

  describe('PATCH /api/maintenance/:id/status', () => {
    it('should change status', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
        title: '水龙头漏水',
        createdById: 'user-1',
      });
      (
        prisma.maintenanceOrder.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
        status: 'IN_PROGRESS',
        apartment: { id: 'apt-1' },
        room: { id: 'room-1' },
        items: [],
      });

      const res = await request(app)
        .patch('/api/maintenance/order-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(prisma.maintenanceOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'order-1',
            organizationId: 'org-1',
            deletedAt: null,
          },
        })
      );
      expect(prisma.maintenanceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: { status: 'IN_PROGRESS' },
          include: { apartment: true, room: true, items: true },
        })
      );
    });

    it('should call notification when COMPLETED', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
        title: '水龙头漏水',
        createdById: 'user-1',
      });
      (
        prisma.maintenanceOrder.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
        status: 'COMPLETED',
        apartment: { id: 'apt-1' },
        room: { id: 'room-1' },
        items: [],
      });

      const res = await request(app)
        .patch('/api/maintenance/order-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          status: 'COMPLETED',
          materialCost: 100,
          laborCost: 50,
          isTenantFault: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(prisma.maintenanceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            completedDate: expect.any(Date),
            materialCost: 100,
            laborCost: 50,
            isTenantFault: false,
          }),
          include: { apartment: true, room: true, items: true },
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            userId: 'user-1',
            type: 'MAINTENANCE_COMPLETED',
            title: '维修工单已完成',
            content: '工单「水龙头漏水」已完成',
            link: '/maintenance/order-1',
          }),
        })
      );
    });

    it('should return 404 for non-existent order', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/maintenance/nonexistent/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('工单不存在');
    });
  });

  describe('DELETE /api/maintenance/:id', () => {
    it('should soft delete an order', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'order-1',
      });

      const res = await request(app)
        .delete('/api/maintenance/order-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(prisma.maintenanceOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'order-1',
            organizationId: 'org-1',
            deletedAt: null,
          },
        })
      );
      expect(prisma.maintenanceOrder.softDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-1' } })
      );
    });

    it('should return 404 for non-existent order', async () => {
      (
        prisma.maintenanceOrder.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/maintenance/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('工单不存在');
    });
  });
});
