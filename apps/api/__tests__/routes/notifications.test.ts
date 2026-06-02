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
    notification: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
  },
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('notifications routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/notifications', () => {
    it('should list notifications (max 50)', async () => {
      (
        prisma.notification.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 'notif-1', title: '新工单', readAt: null }]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('notif-1');
      expect(res.body.data[0].title).toBe('新工单');
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it('should filter unread only', async () => {
      (
        prisma.notification.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ readAt: null }),
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      (prisma.notification.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        5
      );

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(5);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      (
        prisma.notification.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'notif-1',
      });

      const res = await request(app)
        .patch('/api/notifications/notif-1/read')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.read).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1' },
          data: expect.objectContaining({ readAt: expect.any(Date) }),
        })
      );
    });

    it('should return read false for non-existent notification', async () => {
      (
        prisma.notification.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/notifications/nonexistent/read')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.read).toBe(false);
    });
  });

  describe('POST /api/notifications/read-all', () => {
    it('should mark all as read', async () => {
      (
        prisma.notification.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 3 });

      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.readAll).toBe(true);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { readAt: null, organizationId: 'org-1', userId: 'user-1' },
        })
      );
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete a notification', async () => {
      (
        prisma.notification.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'notif-1',
      });

      const res = await request(app)
        .delete('/api/notifications/notif-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('should return error for non-existent notification', async () => {
      (
        prisma.notification.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/notifications/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(500);
    });
  });
});
