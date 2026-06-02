import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const mockLease = {
  id: 'lease-1',
  graceDays: 3,
  lateFeeRate: new Prisma.Decimal(0.001),
  organizationId: 'org-1',
};

const mockBill = {
  id: 'bill-1',
  leaseId: 'lease-1',
  status: 'OVERDUE',
  dueDate: new Date('2026-05-01'),
  totalAmount: new Prisma.Decimal(1000),
  paidAmount: new Prisma.Decimal(0),
  type: 'RENT',
  deletedAt: null,
  lease: mockLease,
  items: [],
  overduePenalties: [],
};

const mockOverduePenalty = {
  id: 'penalty-1',
  billId: 'bill-1',
  leaseId: 'lease-1',
  amount: new Prisma.Decimal(5),
  baseAmount: new Prisma.Decimal(1000),
  daysOverdue: 5,
  rate: new Prisma.Decimal(0.001),
  calculatedAt: new Date('2026-01-01'),
};

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    bill: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    overduePenalty: {
      create: vi.fn(),
    },
    billItem: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  markOverdueBills,
  calculateOverduePenalties,
} from '../../src/services/overdue.js';
import { prisma } from '../../src/prisma/client.js';

describe('overdue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('markOverdueBills', () => {
    it('should mark UNPAID bills past grace period as OVERDUE', async () => {
      const pastDueBill = {
        ...mockBill,
        status: 'UNPAID',
        dueDate: new Date('2026-04-25'),
        lease: { ...mockLease, graceDays: 3 },
      };
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        pastDueBill,
      ]);
      (prisma.bill.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...pastDueBill,
        status: 'OVERDUE',
      });

      const result = await markOverdueBills();

      expect(result).toBe(1);
      expect(prisma.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: { status: 'OVERDUE' },
      });
    });

    it('should skip bills within grace period', async () => {
      const notYetOverdue = {
        ...mockBill,
        status: 'UNPAID',
        dueDate: new Date(),
        lease: { ...mockLease, graceDays: 7 },
      };
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        notYetOverdue,
      ]);

      const result = await markOverdueBills();

      expect(result).toBe(0);
      expect(prisma.bill.update).not.toHaveBeenCalled();
    });

    it('should handle multiple overdue bills', async () => {
      const bills = [
        {
          ...mockBill,
          id: 'bill-1',
          dueDate: new Date('2026-04-20'),
          lease: { ...mockLease, graceDays: 0 },
        },
        {
          ...mockBill,
          id: 'bill-2',
          dueDate: new Date('2026-04-21'),
          lease: { ...mockLease, graceDays: 0 },
        },
      ];
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        bills
      );
      (prisma.bill.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await markOverdueBills();

      expect(result).toBe(2);
      expect(prisma.bill.update).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no overdue bills exist', async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await markOverdueBills();

      expect(result).toBe(0);
    });
  });

  describe('calculateOverduePenalties', () => {
    it('should calculate late fees for overdue bills', async () => {
      const overdueBill = {
        ...mockBill,
        status: 'OVERDUE',
        dueDate: new Date('2026-04-25'),
        lease: {
          ...mockLease,
          graceDays: 0,
          lateFeeRate: new Prisma.Decimal(0.001),
        },
        items: [],
        overduePenalties: [],
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-01'));

      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        overdueBill,
      ]);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (cb: any) =>
          cb({
            overduePenalty: {
              create: vi.fn().mockResolvedValue(mockOverduePenalty),
            },
            billItem: {
              create: vi.fn().mockResolvedValue({}),
              update: vi.fn(),
            },
          })
      );

      const result = await calculateOverduePenalties();

      expect(result).toBe(1);
      vi.useRealTimers();
    });

    it('should skip bills with zero late fee rate', async () => {
      const noFeeBill = {
        ...mockBill,
        status: 'OVERDUE',
        dueDate: new Date('2026-04-25'),
        lease: { ...mockLease, lateFeeRate: new Prisma.Decimal(0) },
      };
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        noFeeBill,
      ]);

      const result = await calculateOverduePenalties();

      expect(result).toBe(0);
    });

    it('should skip bills not past grace period', async () => {
      const notDue = {
        ...mockBill,
        status: 'OVERDUE',
        dueDate: new Date(),
        lease: { ...mockLease, graceDays: 30 },
      };
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        notDue,
      ]);

      const result = await calculateOverduePenalties();

      expect(result).toBe(0);
    });

    it('should skip fully paid overdue bills', async () => {
      const paidBill = {
        ...mockBill,
        status: 'OVERDUE',
        paidAmount: new Prisma.Decimal(1000),
        dueDate: new Date('2026-04-25'),
        lease: {
          ...mockLease,
          graceDays: 0,
          lateFeeRate: new Prisma.Decimal(0.001),
        },
      };
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        paidBill,
      ]);

      const result = await calculateOverduePenalties();

      expect(result).toBe(0);
    });

    it('should skip if penalty already calculated today', async () => {
      const today = new Date('2026-05-01');
      const alreadyCalculated = {
        ...mockBill,
        status: 'OVERDUE',
        dueDate: new Date('2026-04-25'),
        lease: {
          ...mockLease,
          graceDays: 0,
          lateFeeRate: new Prisma.Decimal(0.001),
        },
        overduePenalties: [{ ...mockOverduePenalty, calculatedAt: today }],
      };

      vi.useFakeTimers();
      vi.setSystemTime(today);

      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        alreadyCalculated,
      ]);

      const result = await calculateOverduePenalties();

      expect(result).toBe(0);
      vi.useRealTimers();
    });

    it('should update existing LATE_FEE item if it exists', async () => {
      const billWithLateFee = {
        ...mockBill,
        status: 'OVERDUE',
        dueDate: new Date('2026-04-25'),
        lease: {
          ...mockLease,
          graceDays: 0,
          lateFeeRate: new Prisma.Decimal(0.001),
        },
        items: [
          { id: 'item-1', type: 'LATE_FEE', amount: new Prisma.Decimal(3) },
        ],
        overduePenalties: [],
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-01'));

      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        billWithLateFee,
      ]);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (cb: any) =>
          cb({
            overduePenalty: {
              create: vi.fn().mockResolvedValue(mockOverduePenalty),
            },
            billItem: { update: vi.fn().mockResolvedValue({}) },
          })
      );

      const result = await calculateOverduePenalties();

      expect(result).toBe(1);
      vi.useRealTimers();
    });
  });
});
