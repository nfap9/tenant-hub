import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/http.js";
import { PERMISSIONS } from "../services/roles.js";

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
  waterUnitPrice: z.coerce.number().default(0),
  powerUnitPrice: z.coerce.number().default(0)
});

apartmentRouter.get(
  "/",
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const apartments = await prisma.apartment.findMany({
      where: { organizationId: req.organizationId! },
      include: { rooms: true, feeItems: true },
      orderBy: { createdAt: "desc" }
    });
    ok(res, apartments);
  })
);

apartmentRouter.post(
  "/",
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = apartmentInput.parse(req.body);
    ok(res, await prisma.apartment.create({ data: { ...input, organizationId: req.organizationId! } }));
  })
);

apartmentRouter.put(
  "/:id",
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = apartmentInput.partial().parse(req.body);
    ok(res, await prisma.apartment.update({ where: { id: req.params.id }, data: input }));
  })
);

apartmentRouter.delete(
  "/:id",
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    ok(res, await prisma.apartment.delete({ where: { id: req.params.id } }));
  })
);

apartmentRouter.post(
  "/:id/expenses",
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({ name: z.string().min(1), amount: z.coerce.number(), spentAt: z.coerce.date(), note: z.string().optional() })
      .parse(req.body);
    ok(res, await prisma.apartmentExpense.create({ data: { ...input, apartmentId: req.params.id } }));
  })
);

apartmentRouter.post(
  "/:id/fees",
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({ name: z.string().min(1), spec: z.string().optional(), amount: z.coerce.number(), enabled: z.boolean().default(true) })
      .parse(req.body);
    ok(res, await prisma.apartmentFeeItem.create({ data: { ...input, apartmentId: req.params.id } }));
  })
);

apartmentRouter.put(
  "/fees/:feeId",
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({ name: z.string().min(1).optional(), spec: z.string().optional(), amount: z.coerce.number().optional(), enabled: z.boolean().optional() })
      .parse(req.body);
    ok(res, await prisma.apartmentFeeItem.update({ where: { id: req.params.feeId }, data: input }));
  })
);

apartmentRouter.post(
  "/:id/rooms/batch",
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        rooms: z.array(
          z.object({
            roomNo: z.string().min(1),
            layout: z.string().min(1),
            area: z.coerce.number().optional(),
            facilities: z.array(z.string()).default([])
          })
        )
      })
      .parse(req.body);
    const result = await prisma.room.createMany({
      data: input.rooms.map((room) => ({ ...room, apartmentId: req.params.id })),
      skipDuplicates: true
    });
    ok(res, result);
  })
);

apartmentRouter.put(
  "/rooms/:roomId",
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomNo: z.string().min(1).optional(),
        layout: z.string().min(1).optional(),
        area: z.coerce.number().optional(),
        facilities: z.array(z.string()).optional(),
        status: z.enum(["VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE"]).optional()
      })
      .parse(req.body);
    ok(res, await prisma.room.update({ where: { id: req.params.roomId }, data: input }));
  })
);

apartmentRouter.delete(
  "/rooms/:roomId",
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    ok(res, await prisma.room.delete({ where: { id: req.params.roomId } }));
  })
);
