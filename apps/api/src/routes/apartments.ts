import { Router } from 'express';
import { z } from 'zod';
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
import { createTransaction } from '../services/transaction.js';
import { withLeaseLifecycle } from '../services/leaseLifecycle.js';
import {
  ensureApartmentInOrg,
  ensureRoomInOrg,
  listApartments,
  listRooms,
  getRoomById,
  createApartment,
  updateApartment,
  deleteApartment,
  countActiveLeasesInApartment,
  createApartmentExpense,
  getApartmentName,
  batchCreateRooms,
  updateRoom,
  getRoomStatus,
  countActiveLeasesInRoom,
  deleteRoom,
} from '../services/apartment.js';

export const apartmentRouter = Router();
apartmentRouter.use(requireAuth, requireOrg);

const apartmentInput = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
});

apartmentRouter.get(
  '/',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const currentMonthBillWindow = getCurrentMonthBillWindow();
    const currentMonthBillLabel = getBillMonthLabel(
      currentMonthBillWindow.start
    );
    const apartments = await listApartments(req.organizationId!);
    ok(
      res,
      apartments.map((apartment) => ({
        ...apartment,
        rooms: apartment.rooms.map((room) => ({
          ...room,
          leases: room.leases.map(({ bills, ...lease }) => ({
            ...withLeaseLifecycle(lease),
            currentMonthBillGenerated: bills.length > 0,
            currentMonthBillSettled: bills.some(
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
    const rooms = await listRooms(req.organizationId!);
    ok(
      res,
      rooms.map((room) => ({
        ...room,
        leases: room.leases.map(({ bills, ...lease }) => ({
          ...withLeaseLifecycle(lease),
          currentMonthBillGenerated: bills.length > 0,
          currentMonthBillSettled: bills.some((bill) => bill.status === 'PAID'),
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
      await createApartment({
        ...input,
        organizationId: req.organizationId!,
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
    ok(res, await updateApartment(req.params.id, input));
  })
);

apartmentRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const activeLeaseCount = await countActiveLeasesInApartment(
      req.params.id,
      req.organizationId!
    );
    if (activeLeaseCount > 0)
      throw new HttpError(400, '公寓存在活跃租约，无法删除');
    ok(res, await deleteApartment(req.params.id));
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

    const expense = await createApartmentExpense({
      ...input,
      apartmentId: req.params.id,
    });

    const apartmentName = await getApartmentName(req.params.id);
    await createTransaction({
      organizationId: req.organizationId!,
      type: 'EXPENSE',
      category: 'OTHER_EXPENSE',
      amount: input.amount,
      method: '现金',
      description: `${apartmentName || '公寓'} - ${input.name}`,
      note: input.note,
      operatorId: req.user!.id,
      sourceType: 'APARTMENT_EXPENSE',
      sourceId: expense.id,
      apartmentId: req.params.id,
    });

    ok(res, expense);
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
      await batchCreateRooms(req.params.id, req.organizationId!, input.rooms)
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

    if (input.status) {
      const roomStatus = await getRoomStatus(req.params.roomId);
      if (roomStatus === 'OCCUPIED' && input.status === 'VACANT') {
        throw new HttpError(
          400,
          '不能将已出租房间直接设为空闲，请通过退租流程操作'
        );
      }
    }

    ok(res, await updateRoom(req.params.roomId, input));
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
    const room = await getRoomById(req.params.roomId, req.organizationId!);
    if (!room) throw new HttpError(404, '房间不存在');
    ok(res, {
      ...room,
      leases: room.leases.map(({ bills, ...lease }) => ({
        ...withLeaseLifecycle(lease),
        currentMonthBillGenerated: bills.length > 0,
        currentMonthBillSettled: bills.some((bill) => bill.status === 'PAID'),
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
    const activeLeaseCount = await countActiveLeasesInRoom(
      req.params.roomId,
      req.organizationId!
    );
    if (activeLeaseCount > 0)
      throw new HttpError(400, '房间存在活跃租约，无法删除');
    ok(res, await deleteRoom(req.params.roomId));
  })
);
