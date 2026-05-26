import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import { PERMISSIONS } from '../services/roles.js';
import {
  getBillMonthLabel,
  getCurrentMonthBillWindow,
} from '../services/billing.js';
import { withLeaseLifecycle } from '../services/leaseLifecycle.js';
import { enforceOrganizationQuota } from '../services/quotas.js';

export const apartmentRouter = Router();
apartmentRouter.use(requireAuth, requireOrg);

const apartmentInput = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  floors: z.coerce.number().int().min(1),
  landArea: z.coerce.number().optional(),
  totalArea: z.coerce.number().optional(),
  landlordName: z.string().optional(),
  landlordPhone: z.string().optional(),
  contractStart: z.coerce.date().optional(),
  contractEnd: z.coerce.date().optional(),
  rentAmount: z.coerce.number().optional(),
});

const ensureApartmentInOrg = async (
  apartmentId: string,
  organizationId: string
) => {
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, organizationId },
    select: { id: true },
  });
  if (!apartment) throw new HttpError(404, '公寓不存在');
};

const ensureRoomInOrg = async (roomId: string, organizationId: string) => {
  const room = await prisma.room.findFirst({
    where: { id: roomId, apartment: { organizationId } },
    select: { id: true },
  });
  if (!room) throw new HttpError(404, '房间不存在');
};

apartmentRouter.get(
  '/',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const currentMonthBillWindow = getCurrentMonthBillWindow();
    const currentMonthBillLabel = getBillMonthLabel(
      currentMonthBillWindow.start
    );
    const apartments = await prisma.apartment.findMany({
      where: { organizationId: req.organizationId! },
      include: {
        rooms: {
          include: {
            leases: {
              where: { status: 'ACTIVE' },
              include: {
                fees: true,
                monthlyBills: {
                  where: {
                    billingDate: {
                      gte: currentMonthBillWindow.start,
                      lt: currentMonthBillWindow.end,
                    },
                  },
                  select: { id: true, status: true },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        expenses: { orderBy: { spentAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(
      res,
      apartments.map((apartment) => ({
        ...apartment,
        rooms: apartment.rooms.map((room) => ({
          ...room,
          leases: room.leases.map(({ monthlyBills, ...lease }) => ({
            ...withLeaseLifecycle(lease),
            currentMonthBillGenerated: monthlyBills.length > 0,
            currentMonthBillSettled: monthlyBills.some(
              (bill) => bill.status === 'PAID'
            ),
            currentMonthBillLabel,
          })),
        })),
      }))
    );
  })
);

apartmentRouter.get(
  '/rooms',
  requirePermission(PERMISSIONS.ROOM_VIEW),
  asyncHandler(async (req, res) => {
    const currentMonthBillWindow = getCurrentMonthBillWindow();
    const currentMonthBillLabel = getBillMonthLabel(
      currentMonthBillWindow.start
    );
    const rooms = await prisma.room.findMany({
      where: { apartment: { organizationId: req.organizationId! } },
      include: {
        apartment: true,
        leases: {
          where: { status: 'ACTIVE' },
          include: {
            fees: true,
            monthlyBills: {
              where: {
                billingDate: {
                  gte: currentMonthBillWindow.start,
                  lt: currentMonthBillWindow.end,
                },
              },
              select: { id: true, status: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ apartment: { createdAt: 'desc' } }, { roomNo: 'asc' }],
    });
    ok(
      res,
      rooms.map((room) => ({
        ...room,
        leases: room.leases.map(({ monthlyBills, ...lease }) => ({
          ...withLeaseLifecycle(lease),
          currentMonthBillGenerated: monthlyBills.length > 0,
          currentMonthBillSettled: monthlyBills.some(
            (bill) => bill.status === 'PAID'
          ),
          currentMonthBillLabel,
        })),
      }))
    );
  })
);

apartmentRouter.post(
  '/',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = apartmentInput.parse(req.body);
    ok(
      res,
      await prisma.$transaction(async (tx) => {
        await enforceOrganizationQuota(
          tx,
          req.organizationId!,
          'apartment',
          async () => {
            const apartmentCount = await tx.apartment.count({
              where: { organizationId: req.organizationId! },
            });
            return apartmentCount + 1;
          }
        );
        return tx.apartment.create({
          data: { ...input, organizationId: req.organizationId! },
        });
      })
    );
  })
);

apartmentRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = apartmentInput.partial().parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    ok(
      res,
      await prisma.apartment.update({
        where: { id: req.params.id },
        data: input,
      })
    );
  })
);

apartmentRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const activeLeaseCount = await prisma.lease.count({
      where: {
        organizationId: req.organizationId!,
        status: 'ACTIVE',
        room: { apartmentId: req.params.id },
      },
    });
    if (activeLeaseCount > 0)
      throw new HttpError(400, '公寓存在活跃租约，无法删除');
    ok(res, await prisma.apartment.delete({ where: { id: req.params.id } }));
  })
);

apartmentRouter.post(
  '/:id/expenses',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1),
        amount: z.coerce.number(),
        spentAt: z.coerce.date(),
        note: z.string().optional(),
      })
      .parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    ok(
      res,
      await prisma.apartmentExpense.create({
        data: { ...input, apartmentId: req.params.id },
      })
    );
  })
);

apartmentRouter.post(
  '/:id/rooms/batch',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        rooms: z.array(
          z.object({
            roomNo: z.string().min(1),
            layout: z.string().min(1),
            area: z.coerce.number().optional(),
            facilities: z.array(z.string()).default([]),
          })
        ),
      })
      .parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    ok(
      res,
      await prisma.$transaction(async (tx) => {
        await enforceOrganizationQuota(
          tx,
          req.organizationId!,
          'room',
          async () => {
            const existingRooms = await tx.room.findMany({
              where: { apartment: { organizationId: req.organizationId! } },
              select: { apartmentId: true, roomNo: true },
            });
            const existingKeys = new Set(
              existingRooms.map((room) => `${room.apartmentId}:${room.roomNo}`)
            );
            const newRoomCount = input.rooms.filter(
              (room) => !existingKeys.has(`${req.params.id}:${room.roomNo}`)
            ).length;
            return existingRooms.length + newRoomCount;
          }
        );
        return tx.room.createMany({
          data: input.rooms.map((room) => ({
            ...room,
            apartmentId: req.params.id,
          })),
          skipDuplicates: true,
        });
      })
    );
  })
);

apartmentRouter.put(
  '/rooms/:roomId',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomNo: z.string().min(1).optional(),
        layout: z.string().min(1).optional(),
        area: z.coerce.number().optional(),
        facilities: z.array(z.string()).optional(),
        status: z
          .enum(['VACANT', 'RESERVED', 'OCCUPIED', 'MAINTENANCE'])
          .optional(),
      })
      .parse(req.body);
    await ensureRoomInOrg(req.params.roomId, req.organizationId!);
    ok(
      res,
      await prisma.room.update({
        where: { id: req.params.roomId },
        data: input,
      })
    );
  })
);

apartmentRouter.get(
  '/rooms/:roomId',
  requirePermission(PERMISSIONS.ROOM_VIEW),
  asyncHandler(async (req, res) => {
    const currentMonthBillWindow = getCurrentMonthBillWindow();
    const currentMonthBillLabel = getBillMonthLabel(
      currentMonthBillWindow.start
    );
    const room = await prisma.room.findFirst({
      where: {
        id: req.params.roomId,
        apartment: { organizationId: req.organizationId! },
      },
      include: {
        apartment: true,
        leases: {
          where: { status: 'ACTIVE' },
          include: {
            fees: true,
            monthlyBills: {
              where: {
                billingDate: {
                  gte: currentMonthBillWindow.start,
                  lt: currentMonthBillWindow.end,
                },
              },
              select: { id: true, status: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!room) throw new HttpError(404, '房间不存在');
    ok(res, {
      ...room,
      leases: room.leases.map(({ monthlyBills, ...lease }) => ({
        ...withLeaseLifecycle(lease),
        currentMonthBillGenerated: monthlyBills.length > 0,
        currentMonthBillSettled: monthlyBills.some(
          (bill) => bill.status === 'PAID'
        ),
        currentMonthBillLabel,
      })),
    });
  })
);

apartmentRouter.delete(
  '/rooms/:roomId',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    await ensureRoomInOrg(req.params.roomId, req.organizationId!);
    const activeLeaseCount = await prisma.lease.count({
      where: {
        roomId: req.params.roomId,
        organizationId: req.organizationId!,
        status: 'ACTIVE',
      },
    });
    if (activeLeaseCount > 0)
      throw new HttpError(400, '房间存在活跃租约，无法删除');
    ok(res, await prisma.room.delete({ where: { id: req.params.roomId } }));
  })
);
