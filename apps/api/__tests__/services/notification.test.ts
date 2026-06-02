import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNotification = {
  id: 'notif-1',
  organizationId: 'org-1',
  userId: 'user-1',
  type: 'LEASE_EXPIRING',
  title: '租约即将到期',
  content: '租约 lease-1 将于 3 天后到期',
  link: '/leases/lease-1',
  readAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
    },
  },
}));

import { createNotification } from '../../src/services/notification.js';
import { prisma } from '../../src/prisma/client.js';

describe('notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a notification with all fields', async () => {
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockNotification
    );

    const result = await createNotification({
      organizationId: 'org-1',
      userId: 'user-1',
      type: 'LEASE_EXPIRING',
      title: '租约即将到期',
      content: '租约 lease-1 将于 3 天后到期',
      link: '/leases/lease-1',
    });

    expect(result).toEqual(mockNotification);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'LEASE_EXPIRING',
        title: '租约即将到期',
        content: '租约 lease-1 将于 3 天后到期',
        link: '/leases/lease-1',
      },
    });
  });

  it('should create a notification without link', async () => {
    const noLinkNotif = { ...mockNotification, link: undefined };
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      noLinkNotif
    );

    const result = await createNotification({
      organizationId: 'org-1',
      userId: 'user-1',
      type: 'BILL_OVERDUE',
      title: '账单逾期',
      content: '账单 bill-1 已逾期',
    });

    expect(result).toEqual(noLinkNotif);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'BILL_OVERDUE',
        title: '账单逾期',
        content: '账单 bill-1 已逾期',
        link: undefined,
      },
    });
  });

  it('should create notification with minimal fields', async () => {
    const minimal = {
      ...mockNotification,
      type: 'INFO',
      title: 'test',
      content: 'test',
      link: undefined,
    };
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      minimal
    );

    const result = await createNotification({
      organizationId: 'org-1',
      userId: 'user-1',
      type: 'INFO',
      title: 'test',
      content: 'test',
    });

    expect(result).toBeDefined();
  });
});
