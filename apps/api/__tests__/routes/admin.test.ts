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
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    plan: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    systemSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    orgQuotaPackage: {
      create: vi.fn(),
    },
    apartment: { count: vi.fn() },
    room: { count: vi.fn() },
    lease: { count: vi.fn() },
    bill: { count: vi.fn() },
    subscription: { findFirst: vi.fn() },
    orgMember: { findUnique: vi.fn() },
  },
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      phone: '13800138000',
      username: '测试用户',
      platformRole: 'SUPER_ADMIN',
    });
  });

  describe('GET /api/admin/users', () => {
    it('should return users list', async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'user-1',
          phone: '13800138000',
          username: '测试用户',
          platformRole: 'SUPER_ADMIN',
          createdAt: new Date(),
          _count: { memberships: 1 },
        },
      ]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/admin/users/:id/platform-role', () => {
    it('should update platform role', async () => {
      (
        prisma.user.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        platformRole: 'SUPER_ADMIN',
      });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-2',
        phone: '13800138001',
        username: '用户2',
        platformRole: 'SUPER_ADMIN',
      });

      const res = await request(app)
        .put('/api/admin/users/user-2/platform-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platformRole: 'SUPER_ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.data.platformRole).toBe('SUPER_ADMIN');
    });

    it('should reject non-super-admin', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        platformRole: 'USER',
      });
      (
        prisma.user.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        platformRole: 'USER',
      });

      const res = await request(app)
        .put('/api/admin/users/user-2/platform-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platformRole: 'SUPER_ADMIN' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/summary', () => {
    it('should return platform summary', async () => {
      (prisma.organization.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        5
      );
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      (prisma.apartment.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        20
      );
      (prisma.room.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(80);
      (prisma.bill.count as ReturnType<typeof vi.fn>).mockResolvedValue(30);

      const res = await request(app)
        .get('/api/admin/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        organizations: 5,
        users: 10,
        apartments: 20,
        rooms: 100,
        activeLeases: 80,
        unpaidBills: 30,
      });
    });
  });

  describe('GET /api/admin/plans', () => {
    it('should return plans', async () => {
      (prisma.plan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'plan-1', name: '基础版' },
      ]);

      const res = await request(app)
        .get('/api/admin/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 'plan-1', name: '基础版' }]);
    });
  });

  describe('POST /api/admin/plans', () => {
    it('should create a plan', async () => {
      (prisma.plan.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'plan-1',
        name: '基础版',
      });

      const res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '基础版',
          apartmentLimit: 1,
          roomLimit: 10,
          memberLimit: 5,
          price: 99,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('基础版');
    });
  });

  describe('PUT /api/admin/plans/:id', () => {
    it('should update a plan', async () => {
      (prisma.plan.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'plan-1',
        name: '高级版',
      });

      const res = await request(app)
        .put('/api/admin/plans/plan-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '高级版' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('高级版');
    });
  });

  describe('GET /api/admin/organizations', () => {
    it('should return organizations', async () => {
      (
        prisma.organization.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 'org-1', name: '测试组织' }]);

      const res = await request(app)
        .get('/api/admin/organizations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PUT /api/admin/organizations/:id/status', () => {
    it('should update organization status', async () => {
      (
        prisma.organization.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'org-1', status: 'SUSPENDED' });

      const res = await request(app)
        .put('/api/admin/organizations/org-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');
    });
  });

  describe('POST /api/admin/organizations/:id/quota-packages', () => {
    it('should create quota package', async () => {
      (
        prisma.orgQuotaPackage.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'qp-1' });

      const res = await request(app)
        .post('/api/admin/organizations/org-1/quota-packages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ apartmentQuota: 5, roomQuota: 20, memberQuota: 10 });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/roles', () => {
    it('should return roles', async () => {
      (prisma.role.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'role-1', code: 'owner' },
      ]);

      const res = await request(app)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/admin/roles', () => {
    it('should create a custom role', async () => {
      (prisma.role.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'role-2',
        code: 'custom',
        name: '自定义',
      });

      const res = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'custom', name: '自定义', permissions: ['LEASE_VIEW'] });

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe('custom');
    });

    it('should reject invalid code format', async () => {
      const res = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '123invalid', name: '自定义' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/admin/roles/:id', () => {
    it('should update a role', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'role-2', system: false, code: 'custom' });
      (prisma.role.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'role-2',
        name: '新名称',
      });

      const res = await request(app)
        .put('/api/admin/roles/role-2')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '新名称' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/admin/roles/:id', () => {
    it('should delete a custom role', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'role-2',
        system: false,
        _count: { members: 0 },
      });
      (prisma.role.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'role-2',
      });

      const res = await request(app)
        .delete('/api/admin/roles/role-2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject deleting system role', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'role-1',
        system: true,
        _count: { members: 0 },
      });

      const res = await request(app)
        .delete('/api/admin/roles/role-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/settings', () => {
    it('should return settings', async () => {
      (
        prisma.systemSetting.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ key: 'a', value: 1 }]);

      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/settings/:key', () => {
    it('should return a setting', async () => {
      (
        prisma.systemSetting.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ key: 'x', value: 1 });

      const res = await request(app)
        .get('/api/admin/settings/x')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.key).toBe('x');
    });

    it('should return 404 for missing setting', async () => {
      (
        prisma.systemSetting.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/admin/settings/missing')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/admin/settings/:key', () => {
    it('should upsert a setting', async () => {
      (
        prisma.systemSetting.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ key: 'x', value: 2 });

      const res = await request(app)
        .put('/api/admin/settings/x')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ value: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.value).toBe(2);
    });
  });
});
