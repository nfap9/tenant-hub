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
      findMany: vi.fn(),
      findUnique: vi.fn(async () => ({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
        platformRole: 'SUPER_ADMIN',
      })),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    organization: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    plan: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    orgQuotaPackage: {
      create: vi.fn(),
    },
    systemSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    apartment: { count: vi.fn() },
    room: { count: vi.fn() },
    lease: { count: vi.fn() },
    bill: { count: vi.fn() },
  },
  basePrisma: {},
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
      passwordChangedAt: null,
      platformRole: 'SUPER_ADMIN',
    });
  });

  describe('GET /api/admin/users', () => {
    it('should return users list', async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'user-1',
          phone: '13800138000',
          username: '张三',
          platformRole: 'SUPER_ADMIN',
          createdAt: '2025-01-01T00:00:00.000Z',
          _count: { memberships: 2 },
        },
      ]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].phone).toBe('13800138000');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          select: expect.objectContaining({
            id: true,
            phone: true,
            platformRole: true,
          }),
        })
      );
    });

    it('should filter users by keyword', async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ keyword: '138' });

      expect(res.status).toBe(200);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { phone: { contains: '138' } },
              { username: { contains: '138', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });

  describe('PUT /api/admin/users/:id/platform-role', () => {
    it('should set user to SUPER_ADMIN', async () => {
      (
        prisma.user.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ platformRole: 'SUPER_ADMIN' });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-2',
        phone: '13900139000',
        username: '李四',
        platformRole: 'SUPER_ADMIN',
      });

      const res = await request(app)
        .put('/api/admin/users/user-2/platform-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platformRole: 'SUPER_ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.data.platformRole).toBe('SUPER_ADMIN');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-2' },
          data: { platformRole: 'SUPER_ADMIN' },
        })
      );
    });

    it('should reject invalid platformRole value', async () => {
      const res = await request(app)
        .put('/api/admin/users/user-2/platform-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platformRole: 'INVALID_ROLE' });

      expect(res.status).toBe(400);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should prevent removing the last super admin', async () => {
      (
        prisma.user.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ platformRole: 'SUPER_ADMIN' });
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const res = await request(app)
        .put('/api/admin/users/user-1/platform-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platformRole: 'USER' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('不能移除最后一个超级管理员权限');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should set user to USER if not the last super admin', async () => {
      (
        prisma.user.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ platformRole: 'SUPER_ADMIN' });
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-3',
        phone: '13700137000',
        username: '王五',
        platformRole: 'USER',
      });

      const res = await request(app)
        .put('/api/admin/users/user-3/platform-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platformRole: 'USER' });

      expect(res.status).toBe(200);
      expect(res.body.data.platformRole).toBe('USER');
    });
  });

  describe('GET /api/admin/summary', () => {
    it('should return platform dashboard stats', async () => {
      (prisma.organization.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        5
      );
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(120);
      (prisma.apartment.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        30
      );
      (prisma.room.count as ReturnType<typeof vi.fn>).mockResolvedValue(500);
      (prisma.lease.count as ReturnType<typeof vi.fn>).mockResolvedValue(80);
      (prisma.bill.count as ReturnType<typeof vi.fn>).mockResolvedValue(25);

      const res = await request(app)
        .get('/api/admin/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        organizations: 5,
        users: 120,
        apartments: 30,
        rooms: 500,
        activeLeases: 80,
        unpaidBills: 25,
      });
      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
      expect(prisma.lease.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
    });
  });

  describe('GET /api/admin/plans', () => {
    it('should return plans list', async () => {
      (prisma.plan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'plan-1', name: '基础版', price: 0 },
      ]);

      const res = await request(app)
        .get('/api/admin/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('POST /api/admin/plans', () => {
    it('should create a plan', async () => {
      (prisma.plan.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'plan-2',
        name: '高级版',
        price: 999,
      });

      const res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '高级版',
          apartmentLimit: 10,
          roomLimit: 100,
          memberLimit: 5,
          price: 999,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('高级版');
      expect(prisma.plan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '高级版',
            apartmentLimit: 10,
            roomLimit: 100,
            memberLimit: 5,
            price: 999,
            enabled: true,
          }),
        })
      );
    });

    it('should reject plan with empty name', async () => {
      const res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
          apartmentLimit: 0,
          roomLimit: 0,
          memberLimit: 0,
          price: 0,
        });

      expect(res.status).toBe(400);
      expect(prisma.plan.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/admin/plans/:id', () => {
    it('should update a plan', async () => {
      (prisma.plan.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'plan-1',
        name: '升级版',
        price: 1499,
      });

      const res = await request(app)
        .put('/api/admin/plans/plan-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '升级版', price: 1499 });

      expect(res.status).toBe(200);
      expect(prisma.plan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1' },
          data: expect.objectContaining({ name: '升级版', price: 1499 }),
        })
      );
    });
  });

  describe('GET /api/admin/organizations', () => {
    it('should return organizations list with relations', async () => {
      (
        prisma.organization.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'org-1',
          name: '测试组织',
          subscriptions: [],
          quotas: [],
          _count: { apartments: 3, members: 2, bills: 10 },
        },
      ]);

      const res = await request(app)
        .get('/api/admin/organizations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            subscriptions: { include: { plan: true } },
            quotas: true,
          }),
          orderBy: { createdAt: 'desc' },
        })
      );
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
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: { status: 'SUSPENDED' },
        })
      );
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .put('/api/admin/organizations/org-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'INVALID' });

      expect(res.status).toBe(400);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/organizations/:id/quota-packages', () => {
    it('should create a quota package', async () => {
      (
        prisma.orgQuotaPackage.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'quota-1',
        apartmentQuota: 5,
        roomQuota: 50,
        memberQuota: 2,
        organizationId: 'org-1',
      });

      const res = await request(app)
        .post('/api/admin/organizations/org-1/quota-packages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ apartmentQuota: 5, roomQuota: 50, memberQuota: 2 });

      expect(res.status).toBe(200);
      expect(prisma.orgQuotaPackage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            apartmentQuota: 5,
            roomQuota: 50,
            memberQuota: 2,
            organizationId: 'org-1',
          }),
        })
      );
    });
  });

  describe('GET /api/admin/roles', () => {
    it('should return roles list', async () => {
      (prisma.role.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'role-1', code: 'owner', name: '所有者', system: true },
      ]);

      const res = await request(app)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.role.findMany).toHaveBeenCalledWith({
        orderBy: [{ system: 'desc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('POST /api/admin/roles', () => {
    it('should create a custom role', async () => {
      (prisma.role.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'role-custom',
        code: 'custom_role',
        name: '自定义角色',
        permissions: ['apartment:view'],
        system: false,
      });

      const res = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'custom_role',
          name: '自定义角色',
          permissions: ['apartment:view'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe('custom_role');
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'custom_role',
            name: '自定义角色',
            system: false,
          }),
        })
      );
    });

    it('should reject invalid role code', async () => {
      const res = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'INVALID', name: '无效角色' });

      expect(res.status).toBe(400);
      expect(prisma.role.create).not.toHaveBeenCalled();
    });

    it('should reject role code that doesnt start with letter', async () => {
      const res = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '123_invalid', name: '无效代码' });

      expect(res.status).toBe(400);
      expect(prisma.role.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/admin/roles/:id', () => {
    it('should update a custom role', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'role-custom',
        code: 'custom_role',
        name: '老名字',
        system: false,
      });
      (prisma.role.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'role-custom',
        code: 'custom_new',
        name: '新名字',
        system: false,
      });

      const res = await request(app)
        .put('/api/admin/roles/role-custom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'custom_new', name: '新名字' });

      expect(res.status).toBe(200);
      expect(prisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'role-custom' },
          data: expect.objectContaining({ code: 'custom_new', name: '新名字' }),
        })
      );
    });

    it('should preserve system role code on update', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'role-owner',
        code: 'owner',
        name: '所有者',
        system: true,
      });
      (prisma.role.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'role-owner',
        code: 'owner',
        name: '新所有者名称',
        system: true,
      });

      const res = await request(app)
        .put('/api/admin/roles/role-owner')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'hacked_code', name: '新所有者名称' });

      expect(res.status).toBe(200);
      expect(prisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'role-owner' },
          data: expect.objectContaining({
            code: 'owner',
            name: '新所有者名称',
          }),
        })
      );
    });
  });

  describe('DELETE /api/admin/roles/:id', () => {
    it('should delete a custom role with no members', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'role-custom',
        code: 'custom_role',
        system: false,
        _count: { members: 0 },
      });
      (prisma.role.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'role-custom',
      });

      const res = await request(app)
        .delete('/api/admin/roles/role-custom')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(prisma.role.delete).toHaveBeenCalledWith({
        where: { id: 'role-custom' },
      });
    });

    it('should reject deleting system role', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'role-owner',
        code: 'owner',
        system: true,
        _count: { members: 0 },
      });

      const res = await request(app)
        .delete('/api/admin/roles/role-owner')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('系统预置角色不可删除');
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('should reject deleting role with members', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'role-custom',
        code: 'custom_role',
        system: false,
        _count: { members: 3 },
      });

      const res = await request(app)
        .delete('/api/admin/roles/role-custom')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('角色正在被成员使用，无法删除');
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/settings', () => {
    it('should return all system settings', async () => {
      (
        prisma.systemSetting.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        { key: 'site_name', value: { text: '租务通' } },
        { key: 'quota_limit_enabled', value: { enabled: true } },
      ]);

      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('GET /api/admin/settings/:key', () => {
    it('should return a specific setting', async () => {
      (
        prisma.systemSetting.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        key: 'site_name',
        value: { text: '租务通' },
      });

      const res = await request(app)
        .get('/api/admin/settings/site_name')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.key).toBe('site_name');
      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'site_name' },
      });
    });

    it('should return 404 for non-existent setting', async () => {
      (
        prisma.systemSetting.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/admin/settings/non_existent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('设置项不存在');
    });
  });

  describe('PUT /api/admin/settings/:key', () => {
    it('should upsert a system setting (create)', async () => {
      (
        prisma.systemSetting.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        key: 'new_key',
        value: { enabled: true },
      });

      const res = await request(app)
        .put('/api/admin/settings/new_key')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ value: { enabled: true }, description: '新设置项' });

      expect(res.status).toBe(200);
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'new_key' },
          create: expect.objectContaining({
            key: 'new_key',
            value: { enabled: true },
            description: '新设置项',
          }),
          update: expect.objectContaining({
            value: { enabled: true },
            description: '新设置项',
          }),
        })
      );
    });

    it('should upsert a system setting (update)', async () => {
      (
        prisma.systemSetting.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        key: 'site_name',
        value: { text: '新名称' },
      });

      const res = await request(app)
        .put('/api/admin/settings/site_name')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ value: { text: '新名称' } });

      expect(res.status).toBe(200);
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'site_name' },
          update: expect.objectContaining({ value: { text: '新名称' } }),
        })
      );
    });

    it('should accept value as null', async () => {
      (
        prisma.systemSetting.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        key: 'site_name',
        value: null,
      });

      const res = await request(app)
        .put('/api/admin/settings/site_name')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ value: null });

      expect(res.status).toBe(200);
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ value: null }),
        })
      );
    });
  });

  describe('authentication and authorization', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('should return 403 for non-super-admin user', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-2',
        phone: '13900139000',
        username: '普通用户',
        passwordChangedAt: null,
        platformRole: 'USER',
      });

      const userToken = jwt.sign(
        { id: 'user-2', phone: '13900139000', username: '普通用户' },
        'test-jwt-secret-123456789'
      );

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});
