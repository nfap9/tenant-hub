import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-123456789',
    JWT_EXPIRES_IN: '7d',
    BCRYPT_OTP_SALT_ROUNDS: 10,
    BCRYPT_PASSWORD_SALT_ROUNDS: 12,
    OTP_EXPIRES_IN_MINUTES: 5,
    NODE_ENV: 'test',
  },
  corsOrigins: ['http://localhost:5173'],
}));

vi.mock('../../src/services/smsService.js', () => ({
  sendSms: vi.fn(async () => undefined),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-value'),
    compare: vi.fn(
      async (plain: string, hash: string) =>
        plain === hash.replace('hashed-', '')
    ),
    genSalt: vi.fn(async () => 'salt'),
  },
}));

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    otpCode: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    orgMember: {
      findMany: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
    },
  },
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/prisma/client.js';

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/otp', () => {
    it('should create OTP and return success', async () => {
      (prisma.otpCode.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'otp-1',
      });
      (
        prisma.systemSetting.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/otp')
        .send({ phone: '13800138000', purpose: 'REGISTER' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('验证码已发送');
      expect(prisma.otpCode.create).toHaveBeenCalled();
    });

    it('should reject invalid phone', async () => {
      const res = await request(app)
        .post('/api/auth/otp')
        .send({ phone: '123', purpose: 'REGISTER' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (prisma.otpCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'otp-1',
        codeHash: 'hashed-123456',
        usedAt: null,
      });
      (prisma.otpCode.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        platformRole: 'SUPER_ADMIN',
      });

      const res = await request(app).post('/api/auth/register').send({
        phone: '13800138000',
        username: '测试用户',
        password: 'password123',
        confirmPassword: 'password123',
        code: '123456',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({
        id: 'user-1',
        phone: '13800138000',
        platformRole: 'SUPER_ADMIN',
      });
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject duplicate phone', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
      });

      const res = await request(app).post('/api/auth/register').send({
        phone: '13800138000',
        username: '测试用户',
        password: 'password123',
        confirmPassword: 'password123',
        code: '123456',
      });

      expect(res.status).toBe(409);
    });

    it('should reject mismatched passwords', async () => {
      const res = await request(app).post('/api/auth/register').send({
        phone: '13800138000',
        username: '测试用户',
        password: 'password123',
        confirmPassword: 'different',
        code: '123456',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login/password', () => {
    it('should login with correct password', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordHash: 'hashed-password123',
      });

      const res = await request(app)
        .post('/api/auth/login/password')
        .send({ phone: '13800138000', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({ id: 'user-1' });
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject wrong password', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordHash: 'hashed-password123',
      });

      const res = await request(app)
        .post('/api/auth/login/password')
        .send({ phone: '13800138000', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/auth/login/password')
        .send({ phone: '13800138000', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/login/otp', () => {
    it('should login with valid OTP', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
      });
      (prisma.otpCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'otp-1',
        codeHash: 'hashed-123456',
        usedAt: null,
      });
      (prisma.otpCode.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/login/otp')
        .send({ phone: '13800138000', code: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject non-existent user', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .post('/api/auth/login/otp')
        .send({ phone: '13800138000', code: '123456' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return user info with token', async () => {
      const token = jwt.sign(
        { id: 'user-1', phone: '13800138000', username: '测试用户' },
        'test-jwt-secret-123456789'
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
      });
      (
        prisma.user.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        platformRole: 'USER',
      });
      (prisma.orgMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe('user-1');
      expect(res.body.data.user.platformRole).toBe('USER');
      expect(res.body.data.memberships).toEqual([]);
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).put('/api/auth/password').send({
        currentPassword: 'old',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      });

      expect(res.status).toBe(401);
    });

    it('should update password with correct current password', async () => {
      const token = jwt.sign(
        { id: 'user-1', phone: '13800138000', username: '测试用户' },
        'test-jwt-secret-123456789'
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
      });
      (
        prisma.user.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-oldpassword',
      });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('密码已更新');
    });

    it('should reject wrong current password', async () => {
      const token = jwt.sign(
        { id: 'user-1', phone: '13800138000', username: '测试用户' },
        'test-jwt-secret-123456789'
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
      });
      (
        prisma.user.findUniqueOrThrow as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-oldpassword',
      });

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        });

      expect(res.status).toBe(400);
    });

    it('should reject same password', async () => {
      const token = jwt.sign(
        { id: 'user-1', phone: '13800138000', username: '测试用户' },
        'test-jwt-secret-123456789'
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
      });

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'password123',
          confirmPassword: 'password123',
        });

      expect(res.status).toBe(400);
    });

    it('should reject mismatched new passwords', async () => {
      const token = jwt.sign(
        { id: 'user-1', phone: '13800138000', username: '测试用户' },
        'test-jwt-secret-123456789'
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
      });

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'different',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login/otp', () => {
    it('should reject invalid OTP code', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
      });
      (prisma.otpCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'otp-1',
        codeHash: 'hashed-999999',
        usedAt: null,
      });

      const res = await request(app)
        .post('/api/auth/login/otp')
        .send({ phone: '13800138000', code: '123456' });

      expect(res.status).toBe(400);
    });
  });
});
