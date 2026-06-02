import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

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
      findUnique: vi.fn(async () => ({
        id: 'user-1',
        phone: '13800138000',
        username: '测试用户',
        passwordChangedAt: null,
      })),
    },
  },
}));

import { app } from '../../src/app.js';

const authToken = jwt.sign(
  { id: 'user-1', phone: '13800138000', username: '测试用户' },
  'test-jwt-secret-123456789'
);

const uploadsDir = path.resolve('uploads');

describe('uploads routes', () => {
  beforeAll(() => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/uploads', () => {
    it('should upload a file', async () => {
      const res = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test file content'), 'test.jpg');

      expect(res.status).toBe(200);
      expect(res.body.data.url).toMatch(/^\/uploads\//);
      expect(res.body.data.originalName).toBe('test.jpg');
      expect(res.body.data.size).toBeGreaterThan(0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/uploads')
        .attach('file', Buffer.from('test'), 'test.jpg');

      expect(res.status).toBe(401);
    });
  });
});
