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
  batchCreateRooms,
  updateRoom,
  getRoomStatus,
  countActiveLeasesInRoom,
  deleteRoom,
} from '../services/apartment.js';

export const apartmentRouter = Router();
apartmentRouter.use(requireAuth, requireOrg);

export const apartmentInput = z.object({
  name: z.string().min(1).describe('公寓名称'),
  address: z.string().min(1).describe('公寓地址'),
  rentAmount: z.coerce.number().nonnegative().optional().describe('上游租金'),
  landlordName: z.string().optional().describe('房东姓名'),
  landlordPhone: z.string().optional().describe('房东联系方式'),
  contractStart: z.coerce.date().optional().describe('合同开始日期'),
  contractEnd: z.coerce.date().optional().describe('合同结束日期'),
  floors: z.coerce.number().int().min(1).optional().describe('楼层数'),
});

export const batchCreateRoomsInput = z.object({
  rooms: z
    .array(
      z.object({
        roomNo: z.string().min(1).describe('房号'),
        layout: z.string().min(1).describe('户型'),
        area: z.coerce.number().optional().describe('面积（平方米）'),
        floor: z.coerce.number().int().optional().describe('楼层'),
        furnishings: z.array(z.string()).default([]).describe('配套设施'),
      })
    )
    .describe('房间列表'),
});

export const updateRoomInput = z.object({
  roomNo: z.string().min(1).optional().describe('房号'),
  layout: z.string().min(1).optional().describe('户型'),
  area: z.coerce.number().optional().describe('面积（平方米）'),
  floor: z.coerce.number().int().optional().describe('楼层'),
  furnishings: z.array(z.string()).optional().describe('配套设施'),
  status: z
    .enum(['VACANT', 'OCCUPIED', 'MAINTENANCE', 'SELF_USE'])
    .optional()
    .describe('房间状态'),
});

/**
 * GET /api/apartments
 * 获取当前组织下的公寓列表（含房间、租约及本月账单状态）
 */
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

/**
 * GET /api/apartments/rooms
 * 获取当前组织下的房间列表（含活跃租约及本月账单状态）
 */
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

/**
 * POST /api/apartments
 * 在当前组织下创建新公寓
 */
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

/**
 * POST /api/apartments/:id/update
 * 更新指定公寓的基本信息
 */
apartmentRouter.post(
  '/:id/update',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = apartmentInput.partial().parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    ok(res, await updateApartment(req.params.id, req.organizationId!, input));
  })
);

/**
 * POST /api/apartments/:id/delete
 * 删除指定公寓（存在活跃租约时禁止删除）
 */
apartmentRouter.post(
  '/:id/delete',
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

/**
 * POST /api/apartments/:id/rooms/batch
 * 批量为指定公寓创建房间（自动去重）
 */
apartmentRouter.post(
  '/:id/rooms/batch',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = batchCreateRoomsInput.parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    ok(
      res,
      await batchCreateRooms(req.params.id, req.organizationId!, input.rooms)
    );
  })
);

/**
 * POST /api/apartments/rooms/:roomId/update
 * 更新指定房间的信息和状态
 */
apartmentRouter.post(
  '/rooms/:roomId/update',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateRoomInput.parse(req.body);
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

/**
 * GET /api/apartments/rooms/:roomId
 * 获取指定房间的详细信息
 */
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

/**
 * POST /api/apartments/rooms/:roomId/delete
 * 删除指定房间（存在活跃租约时禁止删除）
 */
apartmentRouter.post(
  '/rooms/:roomId/delete',
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
