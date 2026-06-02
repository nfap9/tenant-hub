import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExpiringSoonLease = { id: 'lease-expiring' };
const mockExpiredLease = {
  id: 'lease-expired',
  roomId: 'room-1',
  room: { id: 'room-1' },
};

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    lease: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    room: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { processLeaseExpirations } from '../../src/services/leaseExpiration.js';
import { prisma } from '../../src/prisma/client.js';

describe('leaseExpiration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark ACTIVE leases ending within 30 days as EXPIRING_SOON', async () => {
    (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mockExpiringSoonLease,
    ]);
    (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      []
    );
    (prisma.lease.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockExpiringSoonLease
    );

    const result = await processLeaseExpirations();

    expect(result.expiringSoonCount).toBe(1);
    expect(result.expiredCount).toBe(0);
    expect(prisma.lease.update).toHaveBeenCalledWith({
      where: { id: 'lease-expiring' },
      data: { status: 'EXPIRING_SOON' },
    });
  });

  it('should mark past-end leases as EXPIRED and update room status', async () => {
    (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      []
    );
    (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mockExpiredLease,
    ]);
    (prisma.lease.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.room.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (calls: any) => Promise.resolve(calls)
    );

    const result = await processLeaseExpirations();

    expect(result.expiringSoonCount).toBe(0);
    expect(result.expiredCount).toBe(1);
    expect(prisma.lease.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } })
    );
    expect(prisma.room.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CHECKOUT_CLEANING' } })
    );
  });

  it('should handle both expiring and expired leases', async () => {
    (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mockExpiringSoonLease,
      { id: 'lease-expiring-2' },
    ]);
    (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mockExpiredLease,
    ]);
    (prisma.lease.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.room.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (calls: any) => Promise.resolve(calls)
    );

    const result = await processLeaseExpirations();

    expect(result.expiringSoonCount).toBe(2);
    expect(result.expiredCount).toBe(1);
    expect(prisma.lease.update).toHaveBeenCalledTimes(3);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should return zero counts when no leases need updating', async () => {
    (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      []
    );
    (prisma.lease.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      []
    );

    const result = await processLeaseExpirations();

    expect(result).toEqual({ expiringSoonCount: 0, expiredCount: 0 });
    expect(prisma.lease.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
