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
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
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

describe('audit logs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/audit-logs', () => {
    it('should return paginated audit logs', async () => {
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'log-1',
          tableName: 'lease',
          action: 'CREATE',
          user: { id: 'user-1', username: '测试用户', phone: '13800138000' },
        },
      ]);
      (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
    });

    it('should filter by tableName', async () => {
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/audit-logs?tableName=lease')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tableName: 'lease' }),
        })
      );
    });

    it('should filter by date range', async () => {
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/audit-logs?startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: expect.any(Date), lte: expect.any(Date) },
          }),
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/audit-logs');
      expect(res.status).toBe(401);
    });
  });
});
