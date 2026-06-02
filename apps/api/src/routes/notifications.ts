import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const notificationRouter = Router();
notificationRouter.use(requireAuth, requireOrg);

notificationRouter.get(
  '/',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const unreadOnly = z
      .enum(['true', 'false'])
      .optional()
      .parse(req.query.unreadOnly);
    const notifications = await prisma.notification.findMany({
      where: {
        organizationId: req.organizationId!,
        userId: req.user!.id,
        ...(unreadOnly === 'true' ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    ok(res, notifications);
  })
);

notificationRouter.get(
  '/unread-count',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({
      where: {
        organizationId: req.organizationId!,
        userId: req.user!.id,
        readAt: null,
      },
    });
    ok(res, { count });
  })
);

notificationRouter.patch(
  '/:id/read',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        userId: req.user!.id,
      },
    });
    if (!notification) {
      return ok(res, { read: false });
    }
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    ok(res, { read: true });
  })
);

notificationRouter.put(
  '/read-all',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: {
        organizationId: req.organizationId!,
        userId: req.user!.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    ok(res, { readAll: true });
  })
);

notificationRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        userId: req.user!.id,
      },
    });
    if (!notification) {
      throw new Error('通知不存在');
    }
    await prisma.notification.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);
