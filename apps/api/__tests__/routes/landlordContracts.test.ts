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
    landlordContract: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(async ({ where }: any) => {
        return { id: where.id, deletedAt: new Date() };
      }),
    },
    apartment: {
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
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('landlord contracts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/landlord-contracts', () => {
    it('should list contracts', async () => {
      (
        prisma.landlordContract.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'contract-1',
          contractNo: 'LC-001',
          rentAmount: 5000,
          apartment: { id: 'apt-1', name: '阳光公寓' },
        },
      ]);

      const res = await request(app)
        .get('/api/landlord-contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('contract-1');
      expect(res.body.data[0].contractNo).toBe('LC-001');
      expect(res.body.data[0].apartment).toBeDefined();
      expect(res.body.data[0].apartment.name).toBe('阳光公寓');
      expect(prisma.landlordContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            apartment: { organizationId: 'org-1' },
            deletedAt: null,
          },
          include: { apartment: true },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter by apartmentId', async () => {
      (
        prisma.landlordContract.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/landlord-contracts?apartmentId=apt-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.landlordContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            apartment: { organizationId: 'org-1' },
            deletedAt: null,
            apartmentId: 'apt-1',
          },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/landlord-contracts');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/landlord-contracts', () => {
    it('should create a contract', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'apt-1',
      });
      (
        prisma.landlordContract.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'contract-1',
        contractNo: 'LC-001',
        rentAmount: 5000,
        depositAmount: 10000,
        paymentMethod: '银行转账',
        apartment: { id: 'apt-1', name: '阳光公寓' },
      });

      const res = await request(app)
        .post('/api/landlord-contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          apartmentId: 'apt-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          rentAmount: 5000,
          depositAmount: 10000,
          paymentMethod: '银行转账',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('contract-1');
      expect(res.body.data.rentAmount).toBe(5000);
      expect(res.body.data.apartment.name).toBe('阳光公寓');
      expect(prisma.apartment.findFirst).toHaveBeenCalledWith({
        where: { id: 'apt-1', organizationId: 'org-1' },
      });
      expect(prisma.landlordContract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            apartmentId: 'apt-1',
            rentAmount: 5000,
            depositAmount: 10000,
            paymentMethod: '银行转账',
          }),
          include: { apartment: true },
        })
      );
    });

    it('should return 404 if apartment not found', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/landlord-contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          apartmentId: 'nonexistent',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          rentAmount: 5000,
          paymentMethod: '银行转账',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('公寓不存在');
    });
  });

  describe('GET /api/landlord-contracts/:id', () => {
    it('should return contract detail', async () => {
      (
        prisma.landlordContract.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'contract-1',
        contractNo: 'LC-001',
        rentAmount: 5000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        apartment: { id: 'apt-1', name: '阳光公寓' },
      });

      const res = await request(app)
        .get('/api/landlord-contracts/contract-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('contract-1');
      expect(res.body.data.contractNo).toBe('LC-001');
      expect(res.body.data.apartment.name).toBe('阳光公寓');
      expect(prisma.landlordContract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'contract-1',
            apartment: { organizationId: 'org-1' },
            deletedAt: null,
          },
          include: { apartment: true },
        })
      );
    });

    it('should return 404 for non-existent contract', async () => {
      (
        prisma.landlordContract.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/landlord-contracts/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('合同不存在');
    });
  });

  describe('PUT /api/landlord-contracts/:id', () => {
    it('should update a contract', async () => {
      (
        prisma.landlordContract.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'contract-1',
      });
      (
        prisma.landlordContract.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'contract-1',
        rentAmount: 6000,
        apartment: { id: 'apt-1', name: '阳光公寓' },
      });

      const res = await request(app)
        .put('/api/landlord-contracts/contract-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ rentAmount: 6000 });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('contract-1');
      expect(res.body.data.rentAmount).toBe(6000);
      expect(prisma.landlordContract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'contract-1',
            apartment: { organizationId: 'org-1' },
            deletedAt: null,
          },
        })
      );
      expect(prisma.landlordContract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-1' },
          data: { rentAmount: 6000 },
          include: { apartment: true },
        })
      );
    });

    it('should return 404 for non-existent contract', async () => {
      (
        prisma.landlordContract.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/landlord-contracts/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ rentAmount: 6000 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('合同不存在');
    });
  });

  describe('DELETE /api/landlord-contracts/:id', () => {
    it('should soft delete a contract', async () => {
      (
        prisma.landlordContract.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'contract-1',
      });

      const res = await request(app)
        .delete('/api/landlord-contracts/contract-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(prisma.landlordContract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'contract-1',
            apartment: { organizationId: 'org-1' },
            deletedAt: null,
          },
        })
      );
      expect(prisma.landlordContract.softDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'contract-1' } })
      );
    });

    it('should return 404 for non-existent contract', async () => {
      (
        prisma.landlordContract.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/landlord-contracts/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('合同不存在');
    });
  });
});
