import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../src/services/deposit.js', () => ({
  refreshDepositStatus: vi.fn(async () => {}),
}));

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    bill: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
    deposit: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import {
  refreshBillTotals,
  recordBillPayment,
} from '../../src/services/billing.js';
import { prisma } from '../../src/prisma/client.js';
import { refreshDepositStatus } from '../../src/services/deposit.js';

describe('billing settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('refreshBillTotals', () => {
    it('should skip settlement bills', async () => {
      (prisma.bill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-settlement',
        type: 'SETTLEMENT',
        note: 'LEASE_SETTLEMENT',
        items: [{ amount: new Prisma.Decimal(100) }],
        payments: [],
      });

      await refreshBillTotals('bill-settlement');

      expect(prisma.bill.update).not.toHaveBeenCalled();
    });

    it('should calculate totals for normal bills', async () => {
      (prisma.bill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-normal',
        note: null,
        items: [
          { amount: new Prisma.Decimal(100), status: 'UNPAID' },
          { amount: new Prisma.Decimal(50), status: 'UNPAID' },
        ],
        payments: [{ amount: new Prisma.Decimal(150) }],
      });

      await refreshBillTotals('bill-normal');

      expect(prisma.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-normal' },
        data: {
          totalAmount: new Prisma.Decimal(150),
          paidAmount: new Prisma.Decimal(150),
          status: 'PAID',
        },
      });
    });

    it('should mark partial paid bills correctly', async () => {
      (prisma.bill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-partial',
        note: null,
        items: [{ amount: new Prisma.Decimal(100), status: 'UNPAID' }],
        payments: [{ amount: new Prisma.Decimal(40) }],
      });

      await refreshBillTotals('bill-partial');

      expect(prisma.bill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PARTIAL_PAID' }),
        })
      );
    });
  });

  describe('recordBillPayment', () => {
    it('should call refreshBillTotals for normal bills', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-normal',
        mode: 'PREPAID',
        note: null,
        status: 'UNPAID',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
      });
      (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'payment-1',
      });

      await recordBillPayment({
        billId: 'bill-normal',
        organizationId: 'org-1',
        userId: 'user-1',
        amount: 60,
        method: '现金',
      });

      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.bill.findUnique).toHaveBeenCalled();
      expect(prisma.bill.update).toHaveBeenCalled();
    });

    it('should manually manage status for settlement bills', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-settlement',
        mode: 'DEPOSIT',
        type: 'SETTLEMENT',
        note: 'LEASE_SETTLEMENT',
        status: 'UNPAID',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
      });
      (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'payment-1',
      });
      (prisma.bill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-settlement',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
      });

      await recordBillPayment({
        billId: 'bill-settlement',
        organizationId: 'org-1',
        userId: 'user-1',
        amount: 60,
        method: '现金',
      });

      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-settlement' },
        data: {
          paidAmount: new Prisma.Decimal(60),
          status: 'PARTIAL_PAID',
        },
      });
    });

    it('should mark settlement bill as PAID when fully paid', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-settlement',
        mode: 'DEPOSIT',
        type: 'SETTLEMENT',
        note: 'LEASE_SETTLEMENT',
        status: 'UNPAID',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
      });
      (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'payment-1',
      });
      (prisma.bill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-settlement',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
      });

      await recordBillPayment({
        billId: 'bill-settlement',
        organizationId: 'org-1',
        userId: 'user-1',
        amount: 100,
        method: '现金',
      });

      expect(prisma.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-settlement' },
        data: {
          paidAmount: new Prisma.Decimal(100),
          status: 'PAID',
        },
      });
    });

    it('should update deposit status for deposit bill payments', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-deposit',
        mode: 'DEPOSIT',
        note: null,
        status: 'UNPAID',
        totalAmount: new Prisma.Decimal(1000),
        paidAmount: new Prisma.Decimal(0),
      });
      (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'payment-1',
      });
      (prisma.bill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'bill-deposit',
        note: null,
        items: [{ amount: new Prisma.Decimal(1000), status: 'UNPAID' }],
        payments: [{ amount: new Prisma.Decimal(1000) }],
      });
      (prisma.deposit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: 'deposit-1',
          paidAmount: new Prisma.Decimal(0),
        }
      );

      await recordBillPayment({
        billId: 'bill-deposit',
        organizationId: 'org-1',
        userId: 'user-1',
        amount: 1000,
        method: '现金',
      });

      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'deposit-1' },
        data: { paidAmount: new Prisma.Decimal(1000) },
      });
      expect(refreshDepositStatus).toHaveBeenCalledWith('deposit-1');
    });

    it('should throw for non-existent bill', async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(
        recordBillPayment({
          billId: 'bill-missing',
          organizationId: 'org-1',
          userId: 'user-1',
          amount: 100,
          method: '现金',
        })
      ).rejects.toThrow(/账单不存在/);
    });
  });
});
