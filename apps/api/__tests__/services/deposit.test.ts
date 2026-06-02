import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const mockDeposit = {
  id: 'deposit-1',
  organizationId: 'org-1',
  leaseId: 'lease-1',
  billId: 'bill-1',
  amount: new Prisma.Decimal(2000),
  paidAmount: new Prisma.Decimal(2000),
  refundedAmount: new Prisma.Decimal(0),
  deductedAmount: new Prisma.Decimal(0),
  status: 'PAID',
};

const mockPayment = {
  id: 'payment-1',
  billId: 'bill-1',
  type: 'RECEIVE',
  amount: new Prisma.Decimal(2000),
  method: '现金',
  status: 'COMPLETED',
};

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    deposit: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  refreshDepositStatus,
  recordDepositPayment,
  getDepositSummary,
} from '../../src/services/deposit.js';
import { prisma } from '../../src/prisma/client.js';

describe('deposit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('refreshDepositStatus', () => {
    it('should mark as UNPAID when paidAmount is zero', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          ...mockDeposit,
          paidAmount: new Prisma.Decimal(0),
          refundedAmount: new Prisma.Decimal(0),
          deductedAmount: new Prisma.Decimal(0),
        }
      );

      await refreshDepositStatus('deposit-1');

      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'deposit-1' },
        data: { status: 'UNPAID' },
      });
    });

    it('should mark as PAID when fully paid but no refunds', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDeposit
      );

      await refreshDepositStatus('deposit-1');

      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'deposit-1' },
        data: { status: 'PAID' },
      });
    });

    it('should mark as PARTIAL_REFUNDED when partially refunded', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          ...mockDeposit,
          refundedAmount: new Prisma.Decimal(1000),
        }
      );

      await refreshDepositStatus('deposit-1');

      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'deposit-1' },
        data: { status: 'PARTIAL_REFUNDED' },
      });
    });

    it('should mark as FULLY_REFUNDED when fully refunded', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          ...mockDeposit,
          refundedAmount: new Prisma.Decimal(2000),
        }
      );

      await refreshDepositStatus('deposit-1');

      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'deposit-1' },
        data: { status: 'FULLY_REFUNDED' },
      });
    });

    it('should mark as DEDUCTED when deducted equals paid', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          ...mockDeposit,
          paidAmount: new Prisma.Decimal(2000),
          deductedAmount: new Prisma.Decimal(2000),
          refundedAmount: new Prisma.Decimal(0),
        }
      );

      await refreshDepositStatus('deposit-1');

      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'deposit-1' },
        data: { status: 'DEDUCTED' },
      });
    });

    it('should do nothing if deposit not found', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await refreshDepositStatus('deposit-missing');

      expect(prisma.deposit.update).not.toHaveBeenCalled();
    });
  });

  describe('recordDepositPayment', () => {
    it('should throw 404 for non-existent deposit', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(
        recordDepositPayment({
          depositId: 'deposit-missing',
          userId: 'user-1',
          type: 'COLLECT',
          amount: 1000,
          method: '现金',
        })
      ).rejects.toThrow(/押金记录不存在/);
    });

    it('should throw 400 for deposit without billId', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          ...mockDeposit,
          billId: null,
        }
      );

      await expect(
        recordDepositPayment({
          depositId: 'deposit-1',
          userId: 'user-1',
          type: 'COLLECT',
          amount: 1000,
          method: '现金',
        })
      ).rejects.toThrow(/押金账单不存在/);
    });

    it('should throw 400 for non-positive amount', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDeposit
      );

      await expect(
        recordDepositPayment({
          depositId: 'deposit-1',
          userId: 'user-1',
          type: 'COLLECT',
          amount: 0,
          method: '现金',
        })
      ).rejects.toThrow(/金额必须大于 0/);
    });

    it('should throw 400 for COLLECT exceeding remaining', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDeposit
      );

      await expect(
        recordDepositPayment({
          depositId: 'deposit-1',
          userId: 'user-1',
          type: 'COLLECT',
          amount: 100,
          method: '现金',
        })
      ).rejects.toThrow(/收款金额不能超过剩余应收/);
    });

    it('should throw 400 for REFUND exceeding refundable', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDeposit
      );

      await expect(
        recordDepositPayment({
          depositId: 'deposit-1',
          userId: 'user-1',
          type: 'REFUND',
          amount: 3000,
          method: '现金',
        })
      ).rejects.toThrow(/退款金额不能超过可退余额/);
    });

    it('should throw 400 for DEDUCT exceeding deductible', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDeposit
      );

      await expect(
        recordDepositPayment({
          depositId: 'deposit-1',
          userId: 'user-1',
          type: 'DEDUCT',
          amount: 3000,
          method: '现金',
        })
      ).rejects.toThrow(/扣款金额不能超过已收押金余额/);
    });

    it('should record COLLECT payment successfully', async () => {
      const unpaidDeposit = {
        ...mockDeposit,
        paidAmount: new Prisma.Decimal(0),
        status: 'UNPAID',
      };
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        unpaidDeposit
      );
      (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPayment
      );
      (prisma.deposit.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...unpaidDeposit,
        paidAmount: new Prisma.Decimal(2000),
      });

      const result = await recordDepositPayment({
        depositId: 'deposit-1',
        userId: 'user-1',
        type: 'COLLECT',
        amount: 2000,
        method: '现金',
      });

      expect(result).toEqual(mockPayment);
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billId: 'bill-1',
            type: 'RECEIVE',
            amount: new Prisma.Decimal(2000),
          }),
        })
      );
    });

    it('should record REFUND payment successfully', async () => {
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDeposit
      );
      (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPayment,
        type: 'REFUND',
      });
      (prisma.deposit.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDeposit
      );
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDeposit
      );

      const result = await recordDepositPayment({
        depositId: 'deposit-1',
        userId: 'user-1',
        type: 'REFUND',
        amount: 1000,
        method: '微信',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getDepositSummary', () => {
    it('should aggregate deposit data correctly', async () => {
      const deposits = [
        {
          ...mockDeposit,
          amount: new Prisma.Decimal(2000),
          paidAmount: new Prisma.Decimal(2000),
          refundedAmount: new Prisma.Decimal(1000),
          deductedAmount: new Prisma.Decimal(0),
          status: 'PARTIAL_REFUNDED',
          lease: { status: 'ACTIVE' },
        },
        {
          ...mockDeposit,
          id: 'deposit-2',
          amount: new Prisma.Decimal(1000),
          paidAmount: new Prisma.Decimal(1000),
          refundedAmount: new Prisma.Decimal(1000),
          deductedAmount: new Prisma.Decimal(0),
          status: 'FULLY_REFUNDED',
          lease: { status: 'TERMINATED' },
        },
        {
          ...mockDeposit,
          id: 'deposit-3',
          amount: new Prisma.Decimal(1500),
          paidAmount: new Prisma.Decimal(0),
          refundedAmount: new Prisma.Decimal(0),
          deductedAmount: new Prisma.Decimal(0),
          status: 'UNPAID',
          lease: { status: 'TERMINATED' },
        },
      ];
      (prisma.deposit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        deposits
      );

      const result = await getDepositSummary('org-1');

      expect(result.count).toBe(3);
      expect(result.totalAmount.toNumber()).toBe(4500);
      expect(result.paidAmount.toNumber()).toBe(3000);
      expect(result.refundedAmount.toNumber()).toBe(2000);
      expect(result.deductedAmount.toNumber()).toBe(0);
      expect(result.heldAmount.toNumber()).toBe(1000);
      expect(prisma.deposit.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        include: { lease: true },
      });
    });

    it('should calculate pending refund for terminated leases', async () => {
      const deposits = [
        {
          ...mockDeposit,
          amount: new Prisma.Decimal(2000),
          paidAmount: new Prisma.Decimal(2000),
          refundedAmount: new Prisma.Decimal(500),
          deductedAmount: new Prisma.Decimal(0),
          status: 'PARTIAL_REFUNDED',
          lease: { status: 'TERMINATED' },
        },
      ];
      (prisma.deposit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        deposits
      );

      const result = await getDepositSummary('org-1');

      expect(result.pendingRefundAmount.toNumber()).toBe(1500);
    });

    it('should return zeros for empty organization', async () => {
      (prisma.deposit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      const result = await getDepositSummary('org-empty');

      expect(result.count).toBe(0);
      expect(result.totalAmount.toNumber()).toBe(0);
      expect(result.paidAmount.toNumber()).toBe(0);
      expect(result.refundedAmount.toNumber()).toBe(0);
      expect(result.deductedAmount.toNumber()).toBe(0);
      expect(result.heldAmount.toNumber()).toBe(0);
      expect(result.pendingRefundAmount.toNumber()).toBe(0);
    });
  });
});
