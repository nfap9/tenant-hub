import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLease = {
  id: 'lease-1',
  organizationId: 'org-1',
  status: 'ACTIVE',
  startDate: new Date('2026-01-05'),
  endDate: new Date('2026-12-31'),
  cycle: 'MONTHLY',
  billDay: 5,
};

const mockQueue = {
  id: 'queue-1',
  leaseId: 'lease-1',
  nextBillDate: new Date('2026-02-05'),
  lastBillDate: null,
  lastBillId: null,
  status: 'PENDING',
  errorMsg: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

vi.mock('../../src/services/billing.js', () => ({
  generateLeaseBills: vi.fn(),
}));

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    billQueue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    lease: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  populateBillQueue,
  processBillQueue,
  skipBillQueueEntry,
} from '../../src/services/billQueue.js';
import { prisma } from '../../src/prisma/client.js';
import { generateLeaseBills } from '../../src/services/billing.js';

describe('billQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('populateBillQueue', () => {
    it('should throw 404 if lease not found', async () => {
      (prisma.lease.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(populateBillQueue('lease-missing')).rejects.toThrow(
        '租约不存在'
      );
    });

    it('should return existing queue entry if already populated', async () => {
      (prisma.lease.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLease
      );
      (
        prisma.billQueue.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueue);

      const result = await populateBillQueue('lease-1');

      expect(result).toEqual(mockQueue);
      expect(prisma.billQueue.create).not.toHaveBeenCalled();
    });

    it('should create a new queue entry', async () => {
      (prisma.lease.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLease
      );
      (
        prisma.billQueue.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (prisma.billQueue.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueue
      );

      const result = await populateBillQueue('lease-1');

      expect(result).toEqual(mockQueue);
      expect(prisma.billQueue.create).toHaveBeenCalledWith({
        data: {
          leaseId: 'lease-1',
          nextBillDate: expect.any(Date),
          status: 'PENDING',
        },
      });
    });

    it('should set nextBillDate to null if bill day is past (backdated)', async () => {
      const backdatedLease = {
        ...mockLease,
        startDate: new Date('2025-01-05'),
      };
      (prisma.lease.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        backdatedLease
      );
      (
        prisma.billQueue.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (prisma.billQueue.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueue
      );

      await populateBillQueue('lease-1');

      expect(prisma.billQueue.create).toHaveBeenCalled();
    });
  });

  describe('processBillQueue', () => {
    it('should process pending queues and generate bills', async () => {
      const queue = {
        ...mockQueue,
        nextBillDate: new Date('2026-01-05'),
        lease: mockLease,
      };
      (prisma.billQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [queue]
      );
      (prisma.billQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        queue
      );
      (generateLeaseBills as ReturnType<typeof vi.fn>).mockResolvedValue([
        'bill-1',
        'bill-2',
      ]);

      const result = await processBillQueue('org-1', new Date('2026-01-10'));

      expect(result).toHaveLength(1);
      expect(result[0].queueId).toBe('queue-1');
      expect(result[0].billIds).toEqual(['bill-1', 'bill-2']);
      expect(generateLeaseBills).toHaveBeenCalledWith(
        'lease-1',
        expect.any(Date)
      );
    });

    it('should mark queue as DONE when next date past lease end', async () => {
      const queue = {
        ...mockQueue,
        nextBillDate: new Date('2027-01-05'),
        lease: mockLease,
      };
      (prisma.billQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [queue]
      );
      (prisma.billQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        queue
      );
      (generateLeaseBills as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await processBillQueue('org-1', new Date('2027-02-01'));

      const updateCall = (
        prisma.billQueue.update as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (call: any[]) => call[0].where.id === 'queue-1' && call[0].data.status
      );
      expect(updateCall).toBeTruthy();
    });

    it('should handle errors by marking queue as FAILED', async () => {
      const queue = {
        ...mockQueue,
        nextBillDate: new Date('2026-01-05'),
        lease: mockLease,
      };
      (prisma.billQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [queue]
      );
      (prisma.billQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        queue
      );
      (generateLeaseBills as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('出账失败')
      );

      const result = await processBillQueue('org-1', new Date('2026-01-10'));

      expect(result[0].error).toBe('出账失败');
      expect(result[0].billIds).toEqual([]);
    });

    it('should skip queues not due yet', async () => {
      (prisma.billQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      const result = await processBillQueue('org-1', new Date('2025-01-01'));

      expect(result).toEqual([]);
      expect(generateLeaseBills).not.toHaveBeenCalled();
    });
  });

  describe('skipBillQueueEntry', () => {
    it('should skip a queue entry and advance the date', async () => {
      (
        prisma.billQueue.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueue);
      (prisma.lease.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLease
      );
      (prisma.billQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockQueue,
        status: 'SKIPPED',
      });

      const result = await skipBillQueueEntry('queue-1');

      expect(result).toBeDefined();
      expect(prisma.billQueue.update).toHaveBeenCalled();
    });

    it('should throw 404 if queue not found', async () => {
      (
        prisma.billQueue.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      await expect(skipBillQueueEntry('queue-missing')).rejects.toThrow(
        '出账队列条目不存在'
      );
    });

    it('should throw 404 if associated lease not found', async () => {
      (
        prisma.billQueue.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueue);
      (prisma.lease.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(skipBillQueueEntry('queue-1')).rejects.toThrow(
        '关联租约不存在'
      );
    });
  });
});
