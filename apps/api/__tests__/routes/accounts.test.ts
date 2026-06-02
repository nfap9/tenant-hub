import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockTxAccountUpdate = vi.fn();
const mockTxAccountTransferCreate = vi.fn();

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
    $transaction: vi.fn(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback({
          account: { update: mockTxAccountUpdate },
          accountTransfer: { create: mockTxAccountTransferCreate },
        });
      }
      for (const p of callback) await p;
    }),
    account: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    accountTransfer: {
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

describe('accounts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['*'] },
      }
    );
  });

  describe('GET /api/accounts', () => {
    it('should return accounts', async () => {
      (prisma.account.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'acc-1', name: '现金账户', type: 'CASH', balance: 0 },
      ]);

      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('acc-1');
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/accounts');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/accounts', () => {
    it('should create an account', async () => {
      (prisma.account.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
        name: '银行账户',
        type: 'BANK',
        bankName: '工商银行',
        accountNo: '6222****1234',
      });

      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          name: '银行账户',
          type: 'BANK',
          bankName: '工商银行',
          accountNo: '6222****1234',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('银行账户');
      expect(res.body.data.type).toBe('BANK');
      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            name: '银行账户',
            type: 'BANK',
            bankName: '工商银行',
            accountNo: '6222****1234',
          }),
        })
      );
    });

    it('should reject empty name', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '', type: 'CASH' });

      expect(res.status).toBe(400);
      expect(prisma.account.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/accounts/:id', () => {
    it('should return account by id', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
        name: '现金账户',
        type: 'CASH',
        balance: 0,
      });

      const res = await request(app)
        .get('/api/accounts/acc-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('acc-1');
      expect(prisma.account.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1', organizationId: 'org-1' },
        })
      );
    });

    it('should return 404 for non-existent account', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/accounts/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('账户不存在');
      expect(prisma.account.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'non-existent',
            organizationId: 'org-1',
          },
        })
      );
    });
  });

  describe('PUT /api/accounts/:id', () => {
    it('should update an account', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
      });
      (prisma.account.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
        name: '新名称',
      });

      const res = await request(app)
        .put('/api/accounts/acc-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名称' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('新名称');
      expect(prisma.account.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: { name: '新名称' },
        })
      );
    });

    it('should return 404 for non-existent account', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .put('/api/accounts/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ name: '新名称' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('账户不存在');
      expect(prisma.account.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/accounts/:id', () => {
    it('should delete an account with zero balance', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
        balance: 0,
      });
      (prisma.account.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
      });

      const res = await request(app)
        .delete('/api/accounts/acc-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(prisma.account.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.account.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'acc-1' } })
      );
    });

    it('should return 404 for non-existent account', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .delete('/api/accounts/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('账户不存在');
      expect(prisma.account.delete).not.toHaveBeenCalled();
    });

    it('should reject deleting account with non-zero balance', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
        balance: 100,
      });

      const res = await request(app)
        .delete('/api/accounts/acc-1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('账户余额不为零，不能删除');
      expect(prisma.account.delete).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/accounts/transfer', () => {
    it('should transfer between accounts', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'acc-1', balance: 1000 })
        .mockResolvedValueOnce({ id: 'acc-2', balance: 0 });
      mockTxAccountTransferCreate.mockResolvedValueOnce({
        id: 'transfer-1',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-2',
        amount: 500,
      });

      const res = await request(app)
        .post('/api/accounts/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 500 });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('transfer-1');
      expect(res.body.data.amount).toBe(500);
      expect(prisma.account.findFirst).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'acc-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.account.findFirst).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'acc-2', organizationId: 'org-1' },
        })
      );
      expect(mockTxAccountUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: { balance: { decrement: 500 } },
        })
      );
      expect(mockTxAccountUpdate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'acc-2' },
          data: { balance: { increment: 500 } },
        })
      );
      expect(mockTxAccountTransferCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            fromAccountId: 'acc-1',
            toAccountId: 'acc-2',
            amount: 500,
            createdById: 'user-1',
          }),
        })
      );
    });

    it('should transfer with note', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'acc-1', balance: 1000 })
        .mockResolvedValueOnce({ id: 'acc-2', balance: 0 });
      mockTxAccountTransferCreate.mockResolvedValueOnce({
        id: 'transfer-2',
        amount: 300,
      });

      const res = await request(app)
        .post('/api/accounts/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: 300,
          note: '转账备注',
        });

      expect(res.status).toBe(200);
      expect(mockTxAccountTransferCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 300,
            note: '转账备注',
          }),
        })
      );
    });

    it('should return 404 for non-existent from account', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'acc-2', balance: 0 });

      const res = await request(app)
        .post('/api/accounts/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({
          fromAccountId: 'non-existent',
          toAccountId: 'acc-2',
          amount: 500,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('转出账户不存在');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject transferring to same account', async () => {
      const res = await request(app)
        .post('/api/accounts/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ fromAccountId: 'acc-1', toAccountId: 'acc-1', amount: 500 });

      expect(res.status).toBe(400);
      expect(prisma.account.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject transfer with insufficient balance', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'acc-1', balance: 100 })
        .mockResolvedValueOnce({ id: 'acc-2', balance: 0 });

      const res = await request(app)
        .post('/api/accounts/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1')
        .send({ fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 500 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('转出账户余额不足');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/accounts/:id/transfers', () => {
    it('should return transfers for an account', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
      });
      (
        prisma.accountTransfer.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 't-1',
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: 500,
        },
      ]);

      const res = await request(app)
        .get('/api/accounts/acc-1/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.account.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1', organizationId: 'org-1' },
        })
      );
      expect(prisma.accountTransfer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            OR: [{ fromAccountId: 'acc-1' }, { toAccountId: 'acc-1' }],
          }),
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return 404 for non-existent account', async () => {
      (prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await request(app)
        .get('/api/accounts/non-existent/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(404);
      expect(prisma.accountTransfer.findMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/accounts/transfers/all', () => {
    it('should return all transfers for organization', async () => {
      (
        prisma.accountTransfer.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 't-1' }]);

      const res = await request(app)
        .get('/api/accounts/transfers/all')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', 'org-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(prisma.accountTransfer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });
});
