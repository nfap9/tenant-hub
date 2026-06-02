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
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

describe('invoices routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/invoices', () => {
    it('should list invoices for organization', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'inv-1',
          title: '房租发票',
          amount: 2000,
          status: 'PENDING',
          tenant: { id: 'tenant-1', name: '张三' },
          bill: {
            id: 'bill-1',
            lease: { room: { id: 'room-1', roomNo: '101' } },
          },
          createdBy: { id: 'user-1', username: '测试用户' },
        },
      ]);

      const res = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('inv-1');
      expect(res.body.data[0].tenant.name).toBe('张三');
      expect(res.body.data[0].bill.lease.room.roomNo).toBe('101');
      expect(res.body.data[0].createdBy.username).toBe('测试用户');
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
          include: expect.objectContaining({
            tenant: true,
            bill: expect.objectContaining({
              include: expect.objectContaining({
                lease: expect.objectContaining({
                  include: expect.objectContaining({ room: true }),
                }),
              }),
            }),
            createdBy: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                username: true,
              }),
            }),
          }),
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter by status', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'inv-2',
          title: '已开票',
          amount: 1000,
          status: 'ISSUED',
          tenant: null,
          bill: null,
          createdBy: null,
        },
      ]);

      const res = await request(app)
        .get('/api/invoices?status=ISSUED')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data[0].status).toBe('ISSUED');
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            status: 'ISSUED',
          },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/invoices');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/invoices', () => {
    it('should create an invoice', async () => {
      (prisma.invoice.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'inv-1',
        title: '房租发票',
        taxNo: '123456789',
        amount: 2000,
        tenant: { id: 'tenant-1', name: '张三' },
        bill: { id: 'bill-1' },
        createdBy: { id: 'user-1', username: '测试用户' },
      });

      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          tenantId: 'tenant-1',
          billId: 'bill-1',
          title: '房租发票',
          taxNo: '123456789',
          amount: 2000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('inv-1');
      expect(res.body.data.title).toBe('房租发票');
      expect(res.body.data.tenant.name).toBe('张三');
      expect(res.body.data.createdBy.username).toBe('测试用户');
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            createdById: 'user-1',
            tenantId: 'tenant-1',
            billId: 'bill-1',
            title: '房租发票',
            taxNo: '123456789',
            amount: 2000,
          }),
          include: expect.objectContaining({
            tenant: true,
            bill: true,
            createdBy: expect.objectContaining({
              select: { id: true, username: true },
            }),
          }),
        })
      );
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should return invoice detail', async () => {
      (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'inv-1',
        title: '房租发票',
        amount: 2000,
        status: 'PENDING',
        tenant: { id: 'tenant-1', name: '张三' },
        bill: { id: 'bill-1' },
        createdBy: { id: 'user-1', username: '测试用户' },
      });

      const res = await request(app)
        .get('/api/invoices/inv-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('inv-1');
      expect(res.body.data.title).toBe('房租发票');
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1', organizationId: 'org-1' },
          include: expect.objectContaining({
            tenant: true,
            bill: true,
            createdBy: expect.objectContaining({
              select: { id: true, username: true },
            }),
          }),
        })
      );
    });

    it('should return 404 if invoice not found', async () => {
      (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/invoices/inv-404')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('发票不存在');
    });
  });

  describe('PATCH /api/invoices/:id/status', () => {
    it('should update invoice status', async () => {
      (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        issuedAt: null,
        sentAt: null,
        receivedAt: null,
      });
      (prisma.invoice.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'inv-1',
        status: 'ISSUED',
        issuedAt: new Date(),
        tenant: null,
        bill: null,
        createdBy: null,
      });

      const res = await request(app)
        .patch('/api/invoices/inv-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'ISSUED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ISSUED');
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            status: 'ISSUED',
            issuedAt: expect.any(Date),
          }),
          include: expect.objectContaining({
            tenant: true,
            bill: true,
            createdBy: expect.objectContaining({
              select: { id: true, username: true },
            }),
          }),
        })
      );
    });

    it('should auto-set issuedAt when transitioning to ISSUED', async () => {
      (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        issuedAt: null,
        sentAt: null,
        receivedAt: null,
      });
      (prisma.invoice.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'inv-1',
        status: 'ISSUED',
        issuedAt: new Date(),
        tenant: null,
        bill: null,
        createdBy: null,
      });

      const res = await request(app)
        .patch('/api/invoices/inv-1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'ISSUED' });

      expect(res.status).toBe(200);
      expect(res.body.data.issuedAt).toBeDefined();
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ISSUED',
            issuedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should return 404 if invoice not found', async () => {
      (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .patch('/api/invoices/inv-404/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ status: 'ISSUED' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('发票不存在');
    });
  });
});
