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
    meter: {
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

vi.mock('../../src/services/meter.js', () => ({
  createMeter: vi.fn(async (data: any) => ({
    id: 'meter-1',
    ...data,
  })),
  replaceMeter: vi.fn(async (id: string, data: any) => ({
    id,
    status: 'ACTIVE',
    ...data,
    oldMeterId: id,
  })),
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

describe('meters routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/meters', () => {
    it('should list meters with filters', async () => {
      (prisma.meter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'meter-1',
          name: '水表1',
          meterType: 'WATER',
          status: 'ACTIVE',
          room: { id: 'room-1', roomNo: '101' },
          apartment: { id: 'apt-1', name: '阳光公寓' },
          parent: null,
          subMeters: [],
          _count: { readings: 5 },
        },
      ]);

      const res = await request(app)
        .get('/api/meters')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('meter-1');
      expect(res.body.data[0].meterType).toBe('WATER');
      expect(res.body.data[0].room).toBeDefined();
      expect(res.body.data[0].room.roomNo).toBe('101');
      expect(res.body.data[0].apartment.name).toBe('阳光公寓');
    });

    it('should apply query filters', async () => {
      (prisma.meter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .get(
          '/api/meters?apartmentId=apt-1&roomId=room-1&meterType=WATER&status=ACTIVE'
        )
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(prisma.meter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            apartmentId: 'apt-1',
            roomId: 'room-1',
            meterType: 'WATER',
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/meters');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/meters', () => {
    it('should create a meter', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'apt-1',
      });

      const res = await request(app)
        .post('/api/meters')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          apartmentId: 'apt-1',
          name: '水表1',
          meterType: 'WATER',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('meter-1');
      expect(res.body.data.name).toBe('水表1');
    });

    it('should return 404 if apartment not found', async () => {
      (
        prisma.apartment.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/meters')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          apartmentId: 'nonexistent',
          name: '水表1',
          meterType: 'WATER',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('公寓不存在');
    });
  });

  describe('GET /api/meters/:id', () => {
    it('should return meter detail with readings', async () => {
      (prisma.meter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'meter-1',
        name: '水表1',
        meterType: 'WATER',
        room: { id: 'room-1', roomNo: '101' },
        apartment: { id: 'apt-1', name: '阳光公寓' },
        parent: null,
        subMeters: [],
        readings: [{ id: 'r-1', value: 100, readingDate: '2026-06-01' }],
      });

      const res = await request(app)
        .get('/api/meters/meter-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('meter-1');
      expect(res.body.data.name).toBe('水表1');
      expect(Array.isArray(res.body.data.readings)).toBe(true);
      expect(res.body.data.readings).toHaveLength(1);
    });

    it('should return 404 for non-existent meter', async () => {
      (prisma.meter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/meters/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('表具不存在');
    });
  });

  describe('PUT /api/meters/:id', () => {
    it('should update a meter', async () => {
      (prisma.meter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'meter-1',
      });
      (prisma.meter.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'meter-1',
        name: '新水表',
      });

      const res = await request(app)
        .put('/api/meters/meter-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新水表' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('meter-1');
      expect(res.body.data.name).toBe('新水表');
    });

    it('should return 404 for non-existent meter', async () => {
      (prisma.meter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .put('/api/meters/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新水表' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('表具不存在');
    });
  });

  describe('POST /api/meters/:id/replace', () => {
    it('should replace a meter', async () => {
      const { replaceMeter } = await import('../../src/services/meter.js');

      const res = await request(app)
        .post('/api/meters/meter-1/replace')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新水表', meterNo: 'MTR-002' });

      expect(res.status).toBe(200);
      expect(replaceMeter).toHaveBeenCalledWith('meter-1', {
        name: '新水表',
        meterNo: 'MTR-002',
      });
      expect(res.body.data.oldMeterId).toBe('meter-1');
    });
  });

  describe('DELETE /api/meters/:id', () => {
    it('should soft delete a meter', async () => {
      (prisma.meter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'meter-1',
      });

      const res = await request(app)
        .delete('/api/meters/meter-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(prisma.meter.softDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'meter-1' } })
      );
    });

    it('should return 404 for non-existent meter', async () => {
      (prisma.meter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .delete('/api/meters/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('表具不存在');
    });
  });
});
