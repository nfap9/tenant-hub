import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const mockAccount = (overrides: Record<string, unknown> = {}) => ({
  id: 'account-1',
  tenantId: 'tenant-1',
  netBalance: new Prisma.Decimal(0),
  totalUnpaid: new Prisma.Decimal(0),
  prepaidBalance: new Prisma.Decimal(0),
  depositBalance: new Prisma.Decimal(1000),
  updatedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    tenantAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    accountTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  getOrCreateAccount,
  chargeAccount,
  creditAccount,
  refundAccount,
  adjustAccount,
  getAccountBalance,
} from '../../src/services/tenantAccount.js';
import { prisma } from '../../src/prisma/client.js';

describe('tenantAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateAccount', () => {
    it('should return existing account if found', async () => {
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockAccount());

      const result = await getOrCreateAccount('tenant-1');

      expect(result.tenantId).toBe('tenant-1');
      expect(prisma.tenantAccount.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
      expect(prisma.tenantAccount.create).not.toHaveBeenCalled();
    });

    it('should create a new account if not found', async () => {
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        prisma.tenantAccount.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockAccount());

      const result = await getOrCreateAccount('tenant-1');

      expect(result.tenantId).toBe('tenant-1');
      expect(prisma.tenantAccount.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1' },
      });
    });
  });

  describe('chargeAccount', () => {
    it('should charge an account and increment netBalance and totalUnpaid', async () => {
      const capturedOps: Array<{ model: string; args: any }> = [];
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        mockAccount({
          netBalance: new Prisma.Decimal(100),
          totalUnpaid: new Prisma.Decimal(50),
        })
      );
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (arg: any) => {
          if (Array.isArray(arg)) {
            const results = [];
            for (const op of arg) {
              results.push(await op);
            }
            return results;
          }
          return arg;
        }
      );
      (
        prisma.accountTransaction.create as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'accountTransaction', args });
        return Promise.resolve({ id: 'tx-1', ...args.data });
      });
      (
        prisma.tenantAccount.update as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'tenantAccount', args });
        return Promise.resolve({ id: 'account-1', ...args.data });
      });

      await chargeAccount(
        'tenant-1',
        30,
        'BILL',
        'bill-1',
        'test charge',
        'user-1'
      );

      expect(capturedOps).toHaveLength(2);

      const txOp = capturedOps[0];
      expect(txOp.model).toBe('accountTransaction');
      expect(txOp.args.data.type).toBe('CHARGE');
      expect(txOp.args.data.amount).toBe(30);
      expect(txOp.args.data.balanceAfter).toBe(130);
      expect(txOp.args.data.referenceType).toBe('BILL');
      expect(txOp.args.data.referenceId).toBe('bill-1');
      expect(txOp.args.data.note).toBe('test charge');
      expect(txOp.args.data.createdById).toBe('user-1');

      const updateOp = capturedOps[1];
      expect(updateOp.model).toBe('tenantAccount');
      expect(updateOp.args.where.id).toBe('account-1');
      expect(updateOp.args.data.netBalance).toBe(130);
      expect(updateOp.args.data.totalUnpaid).toEqual({ increment: 30 });
    });

    it('should accept string amount and parse to number', async () => {
      const capturedOps: Array<{ model: string; args: any }> = [];
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        mockAccount({
          netBalance: new Prisma.Decimal(0),
          totalUnpaid: new Prisma.Decimal(0),
        })
      );
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (arg: any) => {
          if (Array.isArray(arg)) {
            const results = [];
            for (const op of arg) {
              results.push(await op);
            }
            return results;
          }
          return arg;
        }
      );
      (
        prisma.accountTransaction.create as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'accountTransaction', args });
        return Promise.resolve({ id: 'tx-1', ...args.data });
      });
      (
        prisma.tenantAccount.update as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'tenantAccount', args });
        return Promise.resolve({ id: 'account-1', ...args.data });
      });

      await chargeAccount('tenant-1', '50.5', 'BILL', 'bill-1', null);

      expect(capturedOps[0].args.data.amount).toBe(50.5);
      expect(capturedOps[0].args.data.balanceAfter).toBe(50.5);
      expect(capturedOps[1].args.data.netBalance).toBe(50.5);
    });
  });

  describe('creditAccount', () => {
    it('should credit an account and reduce totalUnpaid', async () => {
      const capturedOps: Array<{ model: string; args: any }> = [];
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        mockAccount({
          netBalance: new Prisma.Decimal(1000),
          totalUnpaid: new Prisma.Decimal(600),
          prepaidBalance: new Prisma.Decimal(400),
        })
      );
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (arg: any) => {
          if (Array.isArray(arg)) {
            const results = [];
            for (const op of arg) {
              results.push(await op);
            }
            return results;
          }
          return arg;
        }
      );
      (
        prisma.accountTransaction.create as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'accountTransaction', args });
        return Promise.resolve({ id: 'tx-1', ...args.data });
      });
      (
        prisma.tenantAccount.update as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'tenantAccount', args });
        return Promise.resolve({ id: 'account-1', ...args.data });
      });

      await creditAccount('tenant-1', 500, 'BILL', 'bill-1', 'payment');

      expect(capturedOps).toHaveLength(2);

      const txOp = capturedOps[0];
      expect(txOp.args.data.type).toBe('PAYMENT');
      expect(txOp.args.data.amount).toBe(500);
      expect(txOp.args.data.balanceAfter).toBe(500);

      const updateOp = capturedOps[1];
      expect(updateOp.args.data.netBalance).toBe(500);
      expect(updateOp.args.data.totalUnpaid).toEqual({ decrement: 500 });
      expect(updateOp.args.data.prepaidBalance).toEqual({ increment: 0 });
    });

    it('should overflow to prepaid balance when credit exceeds totalUnpaid', async () => {
      const capturedOps: Array<{ model: string; args: any }> = [];
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        mockAccount({
          netBalance: new Prisma.Decimal(300),
          totalUnpaid: new Prisma.Decimal(100),
          prepaidBalance: new Prisma.Decimal(0),
        })
      );
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (arg: any) => {
          if (Array.isArray(arg)) {
            const results = [];
            for (const op of arg) {
              results.push(await op);
            }
            return results;
          }
          return arg;
        }
      );
      (
        prisma.accountTransaction.create as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'accountTransaction', args });
        return Promise.resolve({ id: 'tx-1', ...args.data });
      });
      (
        prisma.tenantAccount.update as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'tenantAccount', args });
        return Promise.resolve({ id: 'account-1', ...args.data });
      });

      await creditAccount('tenant-1', 200, 'BILL', 'bill-1', 'overpayment');

      const updateOp = capturedOps[1];
      expect(updateOp.args.data.totalUnpaid).toEqual({ decrement: 100 });
      expect(updateOp.args.data.prepaidBalance).toEqual({ increment: 100 });
      expect(updateOp.args.data.netBalance).toBe(100);
    });
  });

  describe('refundAccount', () => {
    it('should refund an account and reduce deposit balance', async () => {
      const capturedOps: Array<{ model: string; args: any }> = [];
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        mockAccount({
          netBalance: new Prisma.Decimal(500),
          depositBalance: new Prisma.Decimal(1000),
        })
      );
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (arg: any) => {
          if (Array.isArray(arg)) {
            const results = [];
            for (const op of arg) {
              results.push(await op);
            }
            return results;
          }
          return arg;
        }
      );
      (
        prisma.accountTransaction.create as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'accountTransaction', args });
        return Promise.resolve({ id: 'tx-1', ...args.data });
      });
      (
        prisma.tenantAccount.update as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'tenantAccount', args });
        return Promise.resolve({ id: 'account-1', ...args.data });
      });

      await refundAccount('tenant-1', 200, 'DEPOSIT', 'deposit-1', 'refund');

      expect(capturedOps).toHaveLength(2);
      expect(capturedOps[0].args.data.type).toBe('REFUND');
      expect(capturedOps[0].args.data.balanceAfter).toBe(300);
      expect(capturedOps[1].args.data.netBalance).toBe(300);
      expect(capturedOps[1].args.data.depositBalance).toEqual({
        decrement: 200,
      });
    });
  });

  describe('adjustAccount', () => {
    it('should adjust account net balance by positive amount', async () => {
      const capturedOps: Array<{ model: string; args: any }> = [];
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockAccount({ netBalance: new Prisma.Decimal(100) }));
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (arg: any) => {
          if (Array.isArray(arg)) {
            const results = [];
            for (const op of arg) {
              results.push(await op);
            }
            return results;
          }
          return arg;
        }
      );
      (
        prisma.accountTransaction.create as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'accountTransaction', args });
        return Promise.resolve({ id: 'tx-1', ...args.data });
      });
      (
        prisma.tenantAccount.update as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'tenantAccount', args });
        return Promise.resolve({ id: 'account-1', ...args.data });
      });

      await adjustAccount('tenant-1', 50, 'positive adjustment', 'user-1');

      expect(capturedOps[0].args.data.type).toBe('ADJUSTMENT');
      expect(capturedOps[0].args.data.amount).toBe(50);
      expect(capturedOps[0].args.data.balanceAfter).toBe(150);
      expect(capturedOps[1].args.data.netBalance).toBe(150);
    });

    it('should adjust account net balance by negative amount', async () => {
      const capturedOps: Array<{ model: string; args: any }> = [];
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockAccount({ netBalance: new Prisma.Decimal(100) }));
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (arg: any) => {
          if (Array.isArray(arg)) {
            const results = [];
            for (const op of arg) {
              results.push(await op);
            }
            return results;
          }
          return arg;
        }
      );
      (
        prisma.accountTransaction.create as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'accountTransaction', args });
        return Promise.resolve({ id: 'tx-1', ...args.data });
      });
      (
        prisma.tenantAccount.update as ReturnType<typeof vi.fn>
      ).mockImplementation((args: any) => {
        capturedOps.push({ model: 'tenantAccount', args });
        return Promise.resolve({ id: 'account-1', ...args.data });
      });

      await adjustAccount('tenant-1', -30, 'negative adjustment', 'user-1');

      expect(capturedOps[0].args.data.amount).toBe(-30);
      expect(capturedOps[0].args.data.balanceAfter).toBe(70);
      expect(capturedOps[1].args.data.netBalance).toBe(70);
    });
  });

  describe('getAccountBalance', () => {
    it('should return balance object from existing account', async () => {
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        mockAccount({
          netBalance: new Prisma.Decimal(500),
          totalUnpaid: new Prisma.Decimal(200),
          prepaidBalance: new Prisma.Decimal(300),
          depositBalance: new Prisma.Decimal(1000),
        })
      );

      const result = await getAccountBalance('tenant-1');

      expect(result.netBalance.toNumber()).toBe(500);
      expect(result.totalUnpaid.toNumber()).toBe(200);
      expect(result.prepaidBalance.toNumber()).toBe(300);
      expect(result.depositBalance.toNumber()).toBe(1000);
    });

    it('should create account if not exists for balance lookup', async () => {
      (
        prisma.tenantAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null);
      (
        prisma.tenantAccount.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockAccount());

      const result = await getAccountBalance('tenant-1');

      expect(result.netBalance).toBeDefined();
      expect(prisma.tenantAccount.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1' },
      });
    });
  });
});
