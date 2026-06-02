import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-123456789',
    JWT_EXPIRES_IN: '7d',
    NODE_ENV: 'test',
    INVITE_EXPIRES_IN_HOURS: 24,
    INVITE_EXPIRES_MAX_HOURS: 168,
  },
  corsOrigins: ['http://localhost:5173'],
}));

vi.mock('../../src/services/quotas.js', () => ({
  enforceOrganizationQuota: vi.fn(),
  isQuotaLimitEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/services/orgInvites.js', () => ({
  normalizeInviteCode: vi.fn((v: string) =>
    v
      .trim()
      .replace(/[\s-]+/g, '')
      .toUpperCase()
  ),
  buildInviteExpiry: vi.fn(() => new Date(Date.now() + 24 * 60 * 60 * 1000)),
  generateInviteCode: vi.fn(() => 'ABC123DEF4'),
  assertInviteJoinable: vi.fn(),
}));

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    organization: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    orgMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    orgInvite: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    plan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    role: {
      findUniqueOrThrow: vi.fn(),
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
    orgQuotaPackage: {
      findMany: vi.fn(),
    },
  },
  basePrisma: {
    $transaction: vi.fn(),
  },
}));

import { app } from '../../src/app.js';
import { prisma, basePrisma } from '../../src/prisma/client.js';
import { assertInviteJoinable } from '../../src/services/orgInvites.js';
import { isQuotaLimitEnabled } from '../../src/services/quotas.js';
import { HttpError } from '../../src/utils/http.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
  async (arg: unknown) => {
    if (Array.isArray(arg)) {
      for (const p of arg) await p;
      return;
    }
    if (typeof arg === 'function') return arg(prisma);
    return arg;
  }
);

(basePrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
  async (arg: unknown) => {
    if (Array.isArray(arg)) {
      for (const p of arg) await p;
      return;
    }
    if (typeof arg === 'function') return arg(prisma);
    return arg;
  }
);

const mockOrg = (overrides: Record<string, unknown> = {}) => ({
  id: 'org-1',
  name: '测试组织',
  code: 'ABCD1234',
  status: 'ACTIVE',
  ownerId: 'user-1',
  description: null,
  ...overrides,
});

const mockMember = (overrides: Record<string, unknown> = {}) => ({
  id: 'member-1',
  userId: 'user-1',
  organizationId: 'org-1',
  status: 'ACTIVE',
  role: { id: 'role-owner', code: 'owner', permissions: ['*'], system: true },
  ...overrides,
});

describe('organizations routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
    ).mockImplementation(async (args: { where: { code: string } }) => {
      if (args.where.code === 'owner')
        return { id: 'role-owner', code: 'owner', permissions: ['*'] };
      if (args.where.code === 'readonly')
        return { id: 'role-readonly', code: 'readonly', permissions: [] };
      if (args.where.code === 'manager')
        return { id: 'role-manager', code: 'manager', permissions: [] };
      throw new Error('role not found');
    });
  });

  describe('GET /api/organizations', () => {
    it('should return user organizations', async () => {
      (prisma.orgMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [
          {
            id: 'member-1',
            userId: 'user-1',
            status: 'ACTIVE',
            role: { id: 'role-owner', code: 'owner', permissions: ['*'] },
            organization: { id: 'org-1', name: '测试组织', code: 'ABCD1234' },
          },
        ]
      );

      const res = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].organization.id).toBe('org-1');
      expect(prisma.orgMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'ACTIVE' },
          include: { organization: true, role: true },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/organizations');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/organizations', () => {
    it('should create an organization', async () => {
      (
        prisma.organization.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        mockOrg({ id: 'org-new', name: '新组织', code: 'XYZ789' })
      );

      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '新组织', description: '描述' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('新组织');
      expect(res.body.data.code).toBe('XYZ789');
      expect(res.body.data.ownerId).toBe('user-1');
      expect(prisma.role.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: 'owner' } })
      );
      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '新组织',
            description: '描述',
            ownerId: 'user-1',
            members: { create: { userId: 'user-1', roleId: 'role-owner' } },
          }),
        })
      );
    });

    it('should reject empty name', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/organizations/join', () => {
    const invite = {
      id: 'invite-1',
      code: 'ABC123DEF4',
      organizationId: 'org-2',
      maxUses: 10,
      usedCount: 0,
      expiresAt: new Date(Date.now() + 86400000),
      organization: { id: 'org-2', name: '目标组织', status: 'ACTIVE' },
    };

    it('should join organization via invite code', async () => {
      (
        prisma.orgInvite.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(invite);
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prisma.orgInvite.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });
      (prisma.orgMember.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMember({ id: 'member-2', organizationId: 'org-2' })
      );

      const res = await request(app)
        .post('/api/organizations/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ inviteCode: 'ABC-123 DEF4' });

      expect(res.status).toBe(200);
      expect(res.body.data.organization.id).toBe('org-2');
      expect(res.body.data.member.id).toBe('member-2');
      expect(prisma.orgInvite.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'ABC123DEF4' },
          include: { organization: true },
        })
      );
      expect(assertInviteJoinable).toHaveBeenCalledWith(
        expect.objectContaining({ invite })
      );
      expect(basePrisma.$transaction).toHaveBeenCalled();
    });

    it('should return 404 when invite code not found', async () => {
      (
        prisma.orgInvite.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/organizations/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ inviteCode: 'NOTEXIST' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('邀请码不存在');
    });

    it('should return 400 when invite is expired', async () => {
      (
        prisma.orgInvite.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(invite);
      (assertInviteJoinable as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new HttpError(400, '邀请码已过期');
        }
      );

      const res = await request(app)
        .post('/api/organizations/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ inviteCode: 'ABC123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('邀请码已过期');
    });
  });

  describe('GET /api/organizations/plans', () => {
    it('should return enabled plans', async () => {
      (prisma.plan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'plan-1', name: '免费版', price: 0, enabled: true },
        { id: 'plan-2', name: '专业版', price: 99, enabled: true },
      ]);

      const res = await request(app)
        .get('/api/organizations/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(prisma.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { enabled: true },
          orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
        })
      );
    });
  });

  describe('GET /api/organizations/:organizationId', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should return organization detail', async () => {
      (
        prisma.organization.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        name: '测试组织',
        code: 'ABCD1234',
        status: 'ACTIVE',
        ownerId: 'user-1',
        _count: { members: 5, apartments: 3, tenants: 10 },
      });

      const res = await request(app)
        .get('/api/organizations/org-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('org-1');
      expect(res.body.data.name).toBe('测试组织');
      expect(prisma.organization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          include: expect.objectContaining({
            _count: expect.objectContaining({
              select: expect.objectContaining({
                members: { where: { status: 'ACTIVE' } },
                apartments: { where: { deletedAt: null } },
                tenants: { where: { deletedAt: null } },
              }),
            }),
          }),
        })
      );
    });

    it('should return 404 for non-existent organization', async () => {
      (
        prisma.organization.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/organizations/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'non-existent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('组织不存在');
    });
  });

  describe('PUT /api/organizations/:organizationId', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should update organization', async () => {
      (
        prisma.organization.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockOrg({ name: '新名称' }));

      const res = await request(app)
        .put('/api/organizations/org-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名称' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('新名称');
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({ name: '新名称' }),
        })
      );
    });
  });

  describe('DELETE /api/organizations/:organizationId', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should delete organization with correct confirmation', async () => {
      (
        prisma.organization.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        name: '测试组织',
        ownerId: 'user-1',
        subscriptions: [],
      });
      (
        prisma.organization.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockOrg({ status: 'DELETED' }));

      const res = await request(app)
        .delete('/api/organizations/org-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ confirmName: '测试组织' });

      expect(res.status).toBe(200);
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: { status: 'DELETED' },
        })
      );
    });

    it('should return 400 when confirmation does not match', async () => {
      (
        prisma.organization.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        name: '测试组织',
        ownerId: 'user-1',
        subscriptions: [],
      });

      const res = await request(app)
        .delete('/api/organizations/org-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ confirmName: '错误名称' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('二次确认不匹配');
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('should return 403 when not owner', async () => {
      (
        prisma.organization.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        name: '测试组织',
        ownerId: 'user-2',
        subscriptions: [],
      });

      const res = await request(app)
        .delete('/api/organizations/org-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ confirmName: '测试组织' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('仅所有者可删除组织');
    });

    it('should return 400 with active subscription', async () => {
      (
        prisma.organization.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        name: '测试组织',
        ownerId: 'user-1',
        subscriptions: [{ id: 'sub-1', active: true }],
      });

      const res = await request(app)
        .delete('/api/organizations/org-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ confirmName: '测试组织' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('组织存在有效订阅，无法删除');
    });
  });

  describe('GET /api/organizations/:organizationId/invites', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should list invites', async () => {
      (prisma.orgInvite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [{ id: 'invite-1', code: 'ABC123' }]
      );

      const res = await request(app)
        .get('/api/organizations/org-1/invites')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.orgInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      );
    });
  });

  describe('POST /api/organizations/:organizationId/invites', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should create invite', async () => {
      (prisma.orgInvite.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'invite-1',
        code: 'ABC123DEF4',
        organizationId: 'org-1',
        createdBy: { id: 'user-1', username: '测试用户', phone: '13800138000' },
      });

      const res = await request(app)
        .post('/api/organizations/org-1/invites')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ expiresInHours: 48 });

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe('ABC123DEF4');
      expect(prisma.orgInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            createdById: 'user-1',
          }),
          include: expect.objectContaining({
            createdBy: { select: { id: true, username: true, phone: true } },
          }),
        })
      );
    });
  });

  describe('GET /api/organizations/:organizationId/subscription', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should return subscription info', async () => {
      (
        prisma.subscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'sub-1',
        active: true,
        plan: { id: 'plan-1', name: '专业版' },
      });
      (
        prisma.organization.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        _count: { apartments: 3, members: 5 },
      });
      (
        prisma.orgQuotaPackage.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        { apartmentQuota: 10, roomQuota: 50, memberQuota: 20 },
      ]);
      (isQuotaLimitEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app)
        .get('/api/organizations/org-1/subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.subscription.id).toBe('sub-1');
      expect(res.body.data.usage.apartments).toBe(3);
      expect(res.body.data.extraQuota.apartmentQuota).toBe(10);
    });
  });

  describe('POST /api/organizations/:organizationId/subscriptions', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should create subscription', async () => {
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'plan-2',
        name: '专业版',
        enabled: true,
      });
      (
        prisma.subscription.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });
      (
        prisma.subscription.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'sub-new',
        planId: 'plan-2',
        active: true,
        plan: { id: 'plan-2', name: '专业版' },
      });

      const res = await request(app)
        .post('/api/organizations/org-1/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ planId: 'plan-2' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('sub-new');
      expect(basePrisma.$transaction).toHaveBeenCalled();
    });

    it('should return 404 for non-existent or disabled plan', async () => {
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/organizations/org-1/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ planId: 'plan-nonexistent' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('套餐不存在或已停用');
    });
  });

  describe('GET /api/organizations/:organizationId/roles', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should list roles', async () => {
      (prisma.role.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'role-owner', code: 'owner', system: true },
        { id: 'role-manager', code: 'manager', system: true },
        { id: 'role-readonly', code: 'readonly', system: true },
      ]);

      const res = await request(app)
        .get('/api/organizations/org-1/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ system: 'desc' }, { createdAt: 'asc' }],
        })
      );
    });
  });

  describe('GET /api/organizations/:organizationId/members', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should list members', async () => {
      (prisma.orgMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [
          {
            id: 'member-1',
            userId: 'user-1',
            status: 'ACTIVE',
            role: { id: 'role-owner', code: 'owner', permissions: ['*'] },
            user: { id: 'user-1', phone: '13800138000', username: '测试用户' },
          },
        ]
      );

      const res = await request(app)
        .get('/api/organizations/org-1/members')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.orgMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          include: {
            user: { select: { id: true, phone: true, username: true } },
            role: true,
          },
        })
      );
    });
  });

  describe('POST /api/organizations/:organizationId/members', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should add a new member', async () => {
      (
        prisma.user.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        id: 'user-2',
        phone: '13900139000',
        username: '新用户',
        passwordChangedAt: null,
      });
      (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          status: 'ACTIVE',
          role: { permissions: ['*'] },
        })
        .mockResolvedValueOnce(null);
      (prisma.orgMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      (prisma.orgMember.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'member-new',
      });

      const res = await request(app)
        .post('/api/organizations/org-1/members')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ phone: '13900139000' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('成员已添加');
    });

    it('should return 404 when user not found', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
        (args: { where: { id?: string; phone?: string } }) => {
          if (args.where.phone) return Promise.resolve(null);
          return Promise.resolve({
            id: 'user-1',
            phone: '13800138000',
            username: '测试用户',
            passwordChangedAt: null,
          });
        }
      );

      const res = await request(app)
        .post('/api/organizations/org-1/members')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ phone: '0000000' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('用户不存在，请先完成注册');
    });

    it('should return 409 when already an active member', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
        (args: { where: { id?: string; phone?: string } }) => {
          if (args.where.phone === '13900139000')
            return Promise.resolve({
              id: 'user-2',
              phone: '13900139000',
              username: '新用户',
              passwordChangedAt: null,
            });
          return Promise.resolve({
            id: 'user-1',
            phone: '13800138000',
            username: '测试用户',
            passwordChangedAt: null,
          });
        }
      );
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'member-existing',
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });

      const res = await request(app)
        .post('/api/organizations/org-1/members')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ phone: '13900139000' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('用户已是组织成员');
    });
  });

  describe('DELETE /api/organizations/:organizationId/members/:memberId', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should remove a member', async () => {
      (
        prisma.orgMember.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'member-2',
        organizationId: 'org-1',
        status: 'ACTIVE',
        role: { code: 'readonly', permissions: [] },
      });
      (prisma.orgMember.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'member-2',
        status: 'DISABLED',
      });

      const res = await request(app)
        .delete('/api/organizations/org-1/members/member-2')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.orgMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'member-2' },
          data: { status: 'DISABLED' },
        })
      );
    });

    it('should reject removing owner', async () => {
      (
        prisma.orgMember.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'member-owner',
        organizationId: 'org-1',
        status: 'ACTIVE',
        role: { code: 'owner', permissions: ['*'] },
      });

      const res = await request(app)
        .delete('/api/organizations/org-1/members/member-owner')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('所有者不可移除');
    });
  });

  describe('PUT /api/organizations/:organizationId/members/:memberId/role', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should change member role', async () => {
      (
        prisma.orgMember.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'member-2',
        roleId: 'role-readonly',
      });
      (prisma.orgMember.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'member-2',
        roleId: 'role-manager',
      });

      const res = await request(app)
        .put('/api/organizations/org-1/members/member-2/role')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ roleId: 'role-manager' });

      expect(res.status).toBe(200);
      expect(prisma.orgMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'member-2' },
          data: { roleId: 'role-manager' },
        })
      );
    });

    it('should reject setting owner role through this route', async () => {
      (
        prisma.orgMember.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'member-2',
        roleId: 'role-readonly',
      });

      const res = await request(app)
        .put('/api/organizations/org-1/members/member-2/role')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ roleId: 'role-owner' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('请使用所有者转移功能');
    });
  });

  describe('POST /api/organizations/:organizationId/transfer-owner', () => {
    beforeEach(() => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
    });

    it('should transfer ownership', async () => {
      (
        prisma.organization.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        ownerId: 'user-1',
      });
      (
        prisma.organization.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        ownerId: 'user-2',
      });
      (prisma.orgMember.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );

      const res = await request(app)
        .post('/api/organizations/org-1/transfer-owner')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ userId: 'user-2' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('所有者已转移');
      expect(basePrisma.$transaction).toHaveBeenCalled();
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: { ownerId: 'user-2' },
        })
      );
    });

    it('should return 403 when not owner', async () => {
      (
        prisma.organization.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        ownerId: 'user-2',
      });

      const res = await request(app)
        .post('/api/organizations/org-1/transfer-owner')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ userId: 'user-3' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('仅所有者可转移所有者身份');
    });
  });
});
