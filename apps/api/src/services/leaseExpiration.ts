import { prisma } from '../prisma/client.js';

/**
 * US-502: 租约到期状态机
 * 1. 标记即将到期（≤30天）的 ACTIVE 租约为 EXPIRING_SOON
 * 2. 标记已过期（> endDate）的 ACTIVE 租约为 EXPIRED，并更新房间状态为 CHECKOUT_CLEANING
 */
export const processLeaseExpirations = async () => {
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  // 1. EXPIRING_SOON: ACTIVE leases with endDate <= soon
  const expiringSoon = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lte: soon, gte: now },
    },
    select: { id: true },
  });

  let expiringSoonCount = 0;
  for (const lease of expiringSoon) {
    await prisma.lease.update({
      where: { id: lease.id },
      data: { status: 'EXPIRING_SOON' },
    });
    expiringSoonCount++;
  }

  // 2. EXPIRED: ACTIVE/EXPIRING_SOON leases with endDate < now
  const expired = await prisma.lease.findMany({
    where: {
      status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
      endDate: { lt: now },
    },
    include: { room: true },
  });

  let expiredCount = 0;
  for (const lease of expired) {
    await prisma.$transaction([
      prisma.lease.update({
        where: { id: lease.id },
        data: { status: 'EXPIRED' },
      }),
      prisma.room.update({
        where: { id: lease.roomId },
        data: { status: 'CHECKOUT_CLEANING' },
      }),
    ]);
    expiredCount++;
  }

  return { expiringSoonCount, expiredCount };
};
