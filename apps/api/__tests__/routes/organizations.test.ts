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

vi.mock('../../src/config/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback({
          orgMember: {
            findUnique: vi.fn(),
            count: vi.fn(),
            upsert: vi.fn(async () => ({ id: 'member-1' })),
          },
          orgInvite: { updateMany: vi.fn(async () => ({ count: 1 })) },
          subscription: { updateMany: vi.fn(), create: vi.fn() },
        });
      }
      for (const p of callback) await p;
    }),
    orgMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
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
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    orgQuotaPackage: {
      findMany: vi.fn(),
    },
    apartment: {
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
  },
}));

vi.mock('../../src/services/quotas.js', () => ({
  enforceOrganizationQuota: vi.fn(),
  isQuotaLimitEnabled: vi.fn(async () => true),
}));

vi.mock('../../src/services/orgInvites.js', () => ({
  assertInviteJoinable: vi.fn(),
  buildInviteExpiry: vi.fn((date: Date, _hours: number) => date),
  generateInviteCode: vi.fn(() => 'ABC123'),
  normalizeInviteCode: vi.fn((code: string) => code.toUpperCase()),
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('organizations routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        organization: { id: 'org-1', name: '测试组织' },
        role: { code: 'owner' },
      },
    ]);
  });

  describe('GET /api/organizations', () => {
    it('should return user organizations', async () => {
      const res = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/organizations');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/organizations', () => {
    it('should create an organization', async () => {
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'role-owner', code: 'owner' });
      (
        prisma.organization.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'org-1', name: '新组织' });

      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '新组织' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('新组织');
    });
  });

  describe('POST /api/organizations/join', () => {
    it('should join by invite code', async () => {
      (
        prisma.orgInvite.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'invite-1',
        code: 'ABC123',
        organizationId: 'org-1',
        maxUses: 10,
        usedCount: 0,
        organization: { id: 'org-1', name: '测试组织' },
      });
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'role-readonly', code: 'readonly' });

      const res = await request(app)
        .post('/api/organizations/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ inviteCode: 'ABC123' });

      expect(res.status).toBe(200);
    });

    it('should return 404 for invalid invite code', async () => {
      (
        prisma.orgInvite.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/organizations/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ inviteCode: 'INVALID' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/organizations/:organizationId/invites', () => {
    it('should return invites', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (prisma.orgInvite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [{ id: 'i-1' }]
      );

      const res = await request(app)
        .get('/api/organizations/org-1/invites')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/organizations/:organizationId/invites', () => {
    it('should create an invite', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (prisma.orgInvite.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'i-1',
        code: 'ABC123',
      });

      const res = await request(app)
        .post('/api/organizations/org-1/invites')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/organizations/plans', () => {
    it('should return enabled plans', async () => {
      (prisma.plan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'plan-1', enabled: true },
      ]);

      const res = await request(app)
        .get('/api/organizations/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/organizations/:organizationId/subscription', () => {
    it('should return subscription info', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (
        prisma.subscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prisma.organization.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        _count: { apartments: 0, members: 0 },
      });
      (
        prisma.orgQuotaPackage.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/organizations/org-1/subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('subscription');
      expect(res.body.data).toHaveProperty('usage');
    });
  });

  describe('POST /api/organizations/:organizationId/subscriptions', () => {
    it('should subscribe to a plan', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'plan-1',
        enabled: true,
      });
      (
        prisma.subscription.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'sub-1', plan: { id: 'plan-1' } });

      const res = await request(app)
        .post('/api/organizations/org-1/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ planId: 'plan-1' });

      expect(res.status).toBe(200);
    });

    it('should reject disabled plan', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (prisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'plan-1',
        enabled: false,
      });

      const res = await request(app)
        .post('/api/organizations/org-1/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ planId: 'plan-1' });

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/organizations/:organizationId', () => {
    it('should update organization', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (
        prisma.organization.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'org-1', name: '新名字' });

      const res = await request(app)
        .put('/api/organizations/org-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名字' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/organizations/:organizationId', () => {
    it('should delete organization with confirmation', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
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
      ).mockResolvedValue({ id: 'org-1', status: 'DELETED' });

      const res = await request(app)
        .delete('/api/organizations/org-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ confirmName: '测试组织' });

      expect(res.status).toBe(200);
    });

    it('should reject wrong confirmation name', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
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
    });
  });

  describe('GET /api/organizations/:organizationId/roles', () => {
    it('should return roles', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (prisma.role.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r-1' },
      ]);

      const res = await request(app)
        .get('/api/organizations/org-1/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/organizations/:organizationId/members', () => {
    it('should return members', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (prisma.orgMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [{ id: 'm-1' }]
      );

      const res = await request(app)
        .get('/api/organizations/org-1/members')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/organizations/:organizationId/members/:memberId', () => {
    it('should remove a member', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (
        prisma.orgMember.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'm-2',
        organizationId: 'org-1',
        role: { code: 'manager' },
      });
      (prisma.orgMember.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'm-2',
        status: 'DISABLED',
      });

      const res = await request(app)
        .delete('/api/organizations/org-1/members/m-2')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
    });

    it('should reject removing owner', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (
        prisma.orgMember.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'm-1',
        organizationId: 'org-1',
        role: { code: 'owner' },
      });

      const res = await request(app)
        .delete('/api/organizations/org-1/members/m-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/organizations/:organizationId/members/:memberId/role', () => {
    it('should change member role', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (
        prisma.orgMember.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'm-2',
        roleId: 'old-role',
      });
      (
        prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'role-owner', code: 'owner' });
      (prisma.orgMember.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'm-2',
        roleId: 'new-role',
      });

      const res = await request(app)
        .put('/api/organizations/org-1/members/m-2/role')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ roleId: 'new-role' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/organizations/:organizationId/transfer-owner', () => {
    it('should transfer ownership', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
      (
        prisma.organization.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'org-1',
        ownerId: 'user-1',
      });
      (prisma.role.findUniqueOrThrow as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'role-owner', code: 'owner' })
        .mockResolvedValueOnce({ id: 'role-manager', code: 'manager' });
      (
        prisma.organization.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});
      (prisma.orgMember.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );

      const res = await request(app)
        .post('/api/organizations/org-1/transfer-owner')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ userId: 'user-2' });

      expect(res.status).toBe(200);
    });

    it('should reject non-owner transfer', async () => {
      (
        prisma.orgMember.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      });
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
    });
  });
});
