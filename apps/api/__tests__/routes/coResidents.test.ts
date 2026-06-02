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
    coResident: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
    },
    lease: {
      findFirst: vi.fn(),
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
  basePrisma: {},
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('coResidents routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/co-residents', () => {
    it('should list co-residents for organization', async () => {
      (
        prisma.coResident.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'cr-1',
          name: '李四',
          relation: '配偶',
          tenant: { id: 'tenant-1', name: '张三' },
          lease: { id: 'lease-1', room: { id: 'room-1', roomNo: '101' } },
        },
      ]);

      const res = await request(app)
        .get('/api/co-residents')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].name).toBe('李四');
      expect(res.body.data[0].tenant.name).toBe('张三');
      expect(res.body.data[0].lease.room.roomNo).toBe('101');
      expect(prisma.coResident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant: { organizationId: 'org-1' },
          },
          include: expect.objectContaining({
            tenant: true,
            lease: expect.objectContaining({
              include: expect.objectContaining({ room: true }),
            }),
          }),
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter by tenantId', async () => {
      (
        prisma.coResident.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'cr-1',
          name: '李四',
          relation: '配偶',
          tenant: null,
          lease: null,
        },
      ]);

      const res = await request(app)
        .get('/api/co-residents?tenantId=tenant-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(prisma.coResident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant: { organizationId: 'org-1' },
            tenantId: 'tenant-1',
          },
        })
      );
    });

    it('should filter by leaseId', async () => {
      (
        prisma.coResident.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/co-residents?leaseId=lease-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(prisma.coResident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant: { organizationId: 'org-1' },
            leaseId: 'lease-1',
          },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/co-residents');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/co-residents', () => {
    it('should create a co-resident', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
      });
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'lease-1',
      });
      (prisma.coResident.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cr-1',
        name: '李四',
        relation: '配偶',
        tenant: { id: 'tenant-1', name: '张三' },
        lease: { id: 'lease-1', room: { id: 'room-1', roomNo: '101' } },
      });

      const res = await request(app)
        .post('/api/co-residents')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          tenantId: 'tenant-1',
          leaseId: 'lease-1',
          name: '李四',
          relation: '配偶',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('cr-1');
      expect(res.body.data.name).toBe('李四');
      expect(res.body.data.relation).toBe('配偶');
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
        where: { id: 'tenant-1', organizationId: 'org-1' },
      });
      expect(prisma.lease.findFirst).toHaveBeenCalledWith({
        where: { id: 'lease-1', organizationId: 'org-1' },
      });
      expect(prisma.coResident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            leaseId: 'lease-1',
            name: '李四',
            relation: '配偶',
          }),
          include: expect.objectContaining({
            tenant: true,
            lease: expect.objectContaining({
              include: expect.objectContaining({ room: true }),
            }),
          }),
        })
      );
    });

    it('should return 404 if tenant not found', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/co-residents')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          tenantId: 'tenant-404',
          leaseId: 'lease-1',
          name: '李四',
          relation: '配偶',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租客不存在');
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
        where: { id: 'tenant-404', organizationId: 'org-1' },
      });
    });

    it('should return 404 if lease not found', async () => {
      (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'tenant-1',
      });
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/co-residents')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          tenantId: 'tenant-1',
          leaseId: 'lease-404',
          name: '李四',
          relation: '配偶',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('租约不存在');
      expect(prisma.lease.findFirst).toHaveBeenCalledWith({
        where: { id: 'lease-404', organizationId: 'org-1' },
      });
    });
  });

  describe('GET /api/co-residents/:id', () => {
    it('should return co-resident detail', async () => {
      (
        prisma.coResident.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cr-1',
        name: '李四',
        relation: '配偶',
        tenant: { id: 'tenant-1', name: '张三' },
        lease: { id: 'lease-1', room: { id: 'room-1', roomNo: '101' } },
      });

      const res = await request(app)
        .get('/api/co-residents/cr-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('cr-1');
      expect(res.body.data.name).toBe('李四');
      expect(prisma.coResident.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'cr-1',
            tenant: { organizationId: 'org-1' },
          },
          include: expect.objectContaining({
            tenant: true,
            lease: expect.objectContaining({
              include: expect.objectContaining({ room: true }),
            }),
          }),
        })
      );
    });

    it('should return 404 if co-resident not found', async () => {
      (
        prisma.coResident.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/co-residents/cr-404')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('同住人不存在');
    });
  });

  describe('PUT /api/co-residents/:id', () => {
    it('should update a co-resident', async () => {
      (
        prisma.coResident.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cr-1',
        name: '李四',
      });
      (prisma.coResident.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cr-1',
        name: '李四',
        relation: '家人',
        tenant: { id: 'tenant-1', name: '张三' },
        lease: { id: 'lease-1', room: { id: 'room-1', roomNo: '101' } },
      });

      const res = await request(app)
        .put('/api/co-residents/cr-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ relation: '家人' });

      expect(res.status).toBe(200);
      expect(res.body.data.relation).toBe('家人');
      expect(prisma.coResident.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'cr-1',
            tenant: { organizationId: 'org-1' },
          },
        })
      );
      expect(prisma.coResident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cr-1' },
          data: { relation: '家人' },
          include: expect.objectContaining({
            tenant: true,
            lease: expect.objectContaining({
              include: expect.objectContaining({ room: true }),
            }),
          }),
        })
      );
    });

    it('should return 404 if co-resident not found', async () => {
      (
        prisma.coResident.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/co-residents/cr-404')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ relation: '家人' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('同住人不存在');
    });
  });

  describe('DELETE /api/co-residents/:id', () => {
    it('should soft delete a co-resident', async () => {
      (
        prisma.coResident.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cr-1',
      });
      (
        prisma.coResident.softDelete as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cr-1',
        deletedAt: new Date(),
      });

      const res = await request(app)
        .delete('/api/co-residents/cr-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(prisma.coResident.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'cr-1',
            tenant: { organizationId: 'org-1' },
          },
        })
      );
      expect(prisma.coResident.softDelete).toHaveBeenCalledWith({
        where: { id: 'cr-1' },
      });
    });

    it('should return 404 if co-resident not found', async () => {
      (
        prisma.coResident.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/co-residents/cr-404')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('同住人不存在');
    });
  });
});
