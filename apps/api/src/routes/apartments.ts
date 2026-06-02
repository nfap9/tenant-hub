import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { basePrisma, prisma } from '../prisma/client.js';
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
  status: z
    .enum([
      'PLANNING',
      'RENOVATING',
      'PREPARING',
      'ACTIVE',
      'SUSPENDED',
      'CLOSED',
    ])
    .optional(),
  propertyType: z
    .enum([
      'RESIDENTIAL',
      'COMMERCIAL',
      'INDUSTRIAL_RENOVATED',
      'URBAN_VILLAGE',
      'OTHER',
    ])
    .optional(),
  floors: z.coerce.number().int().min(1),
  landArea: z.coerce.number().optional(),
  totalArea: z.coerce.number().optional(),
  publicAreaRatio: z.coerce.number().optional(),
  buildYear: z.coerce.number().int().optional(),
  elevatorCount: z.coerce.number().int().min(0).optional(),
  propertyRight: z.enum(['OWNED', 'LONG_TERM_LEASE', 'TRUSTEESHIP']).optional(),
  costElectricityPrice: z.coerce.number().optional(),
  costWaterPrice: z.coerce.number().optional(),
  costGasPrice: z.coerce.number().optional(),
  reminderDay: z.coerce.number().int().min(1).max(28).optional(),
  fireRating: z.string().optional(),
  fireExtinguisherCount: z.coerce.number().int().min(0).optional(),
  escapeRouteCount: z.coerce.number().int().min(0).optional(),
});

const contractInput = z.object({
  contractNo: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rentAmount: z.coerce.number().nonnegative(),
  depositAmount: z.coerce.number().nonnegative().default(0),
  paymentMethod: z.string(),
  escalationType: z.string().optional(),
  escalationValue: z.coerce.number().optional(),
  escalationCycle: z.coerce.number().int().optional(),
  freeRentDays: z.coerce.number().int().min(0).default(0),
  freeRentStart: z.coerce.date().optional(),
  freeRentEnd: z.coerce.date().optional(),
  signDate: z.coerce.date().optional(),
  attachmentUrl: z.string().optional(),
  note: z.string().optional(),
});

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function diffInMonths(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

function getIntervalMonths(method: string): number {
  switch (method) {
    case 'MONTHLY':
      return 1;
    case 'QUARTERLY':
      return 3;
    case 'HALF_YEARLY':
      return 6;
    case 'YEARLY':
      return 12;
    default:
      return 1;
  }
}

function cleanContractPayload<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

const ensureApartmentInOrg = async (
  apartmentId: string,
  organizationId: string
) => {
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, organizationId, deletedAt: null },
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
    const { page, pageSize, search, status, propertyType } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        status: z.string().optional(),
        propertyType: z.string().optional(),
      })
      .parse(req.query);

    const currentMonthBillWindow = getCurrentMonthBillWindow();
    const currentMonthBillLabel = getBillMonthLabel(
      currentMonthBillWindow.start
    );

    const where: Record<string, unknown> = {
      organizationId: req.organizationId!,
      deletedAt: null,
    };

    if (status) where.status = status;
    if (propertyType) where.propertyType = propertyType;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [apartments, total] = await Promise.all([
      prisma.apartment.findMany({
        where,
        include: {
          rooms: {
            include: {
              leases: {
                where: { status: 'ACTIVE' },
                include: {
                  fees: true,
                  bills: {
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
          landlordContracts: {
            where: { deletedAt: null, isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.apartment.count({ where }),
    ]);

    ok(res, {
      items: apartments.map((apartment) => ({
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
      })),
      total,
      page,
      pageSize,
    });
  })
);

apartmentRouter.get(
  '/all',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const apartments = await prisma.apartment.findMany({
      where: {
        organizationId: req.organizationId!,
        deletedAt: null,
      },
      include: {
        rooms: true,
        expenses: { orderBy: { spentAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, apartments);
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
            deposit: true,
            bills: {
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
    const contract = req.body.contract
      ? contractInput.parse(req.body.contract)
      : undefined;
    ok(
      res,
      await basePrisma.$transaction(async (tx) => {
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
        const apartment = await tx.apartment.create({
          data: { ...input, organizationId: req.organizationId! },
        });
        if (contract) {
          await tx.landlordContract.create({
            data: { ...contract, apartmentId: apartment.id },
          });
        }
        return apartment;
      })
    );
  })
);

apartmentRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = apartmentInput.partial().parse(req.body);
    const contract = req.body.contract
      ? contractInput.partial().parse(req.body.contract)
      : undefined;
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    ok(
      res,
      await basePrisma.$transaction(async (tx) => {
        const apartment = await tx.apartment.update({
          where: { id: req.params.id },
          data: input,
        });
        if (contract) {
          const existing = await tx.landlordContract.findFirst({
            where: { apartmentId: req.params.id, deletedAt: null },
            orderBy: { createdAt: 'desc' },
          });
          const cleanContract = cleanContractPayload(contract);
          if (existing) {
            await tx.landlordContract.update({
              where: { id: existing.id },
              data: cleanContract as Prisma.LandlordContractUpdateInput,
            });
          } else {
            await tx.landlordContract.create({
              data: {
                ...cleanContract,
                apartmentId: req.params.id,
              } as Prisma.LandlordContractUncheckedCreateInput,
            });
          }
        }
        return apartment;
      })
    );
  })
);

apartmentRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const currentMonthBillWindow = getCurrentMonthBillWindow();
    const currentMonthBillLabel = getBillMonthLabel(
      currentMonthBillWindow.start
    );
    const apartment = await prisma.apartment.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
      include: {
        rooms: {
          include: {
            leases: {
              where: { status: 'ACTIVE' },
              include: {
                fees: true,
                bills: {
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
        expenses: { orderBy: { spentAt: 'desc' }, include: { category: true } },
        landlordContracts: {
          where: { deletedAt: null, isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!apartment) throw new HttpError(404, '公寓不存在');
    ok(res, {
      ...apartment,
      rooms: apartment.rooms.map((room) => ({
        ...room,
        leases: room.leases.map(({ bills, ...lease }) => ({
          ...withLeaseLifecycle(lease),
          currentMonthBillGenerated: bills.length > 0,
          currentMonthBillSettled: bills.some((bill) => bill.status === 'PAID'),
          currentMonthBillLabel,
        })),
      })),
    });
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
    await prisma.apartment.softDelete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
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
        categoryId: z.string().optional(),
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
            floor: z.coerce.number().int().min(1).optional(),
            layout: z.string().min(1),
            area: z.coerce.number().optional(),
            orientation: z
              .enum([
                'NORTH',
                'SOUTH',
                'EAST',
                'WEST',
                'NORTH_EAST',
                'NORTH_WEST',
                'SOUTH_EAST',
                'SOUTH_WEST',
              ])
              .optional(),
            decorationStatus: z
              .enum(['BARE', 'SIMPLE', 'DELUXE', 'LUXURY'])
              .optional(),
            decorationDate: z.coerce.date().optional(),
            facilities: z.array(z.string()).default([]),
          })
        ),
      })
      .parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    ok(
      res,
      await basePrisma.$transaction(async (tx) => {
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
  '/rooms/batch/facilities',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomIds: z.array(z.string()).min(1),
        facilities: z.array(z.string()).min(1),
      })
      .parse(req.body);

    await prisma.room.updateMany({
      where: {
        id: { in: input.roomIds },
        apartment: { organizationId: req.organizationId! },
      },
      data: { facilities: input.facilities },
    });

    ok(res, { updated: input.roomIds.length });
  })
);

apartmentRouter.put(
  '/rooms/batch/rent',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomIds: z.array(z.string()).min(1),
        rentPrice: z.coerce.number().positive(),
      })
      .parse(req.body);

    await prisma.room.updateMany({
      where: {
        id: { in: input.roomIds },
        apartment: { organizationId: req.organizationId! },
      },
      data: { currentRentPrice: input.rentPrice },
    });

    ok(res, { updated: input.roomIds.length });
  })
);

apartmentRouter.put(
  '/rooms/:roomId',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomNo: z.string().min(1).optional(),
        floor: z.coerce.number().int().min(1).optional(),
        layout: z.string().min(1).optional(),
        area: z.coerce.number().optional(),
        orientation: z
          .enum([
            'NORTH',
            'SOUTH',
            'EAST',
            'WEST',
            'NORTH_EAST',
            'NORTH_WEST',
            'SOUTH_EAST',
            'SOUTH_WEST',
          ])
          .optional(),
        decorationStatus: z
          .enum(['BARE', 'SIMPLE', 'DELUXE', 'LUXURY'])
          .optional(),
        facilities: z.array(z.string()).optional(),
        status: z
          .enum([
            'TO_RENOVATE',
            'TO_CONFIGURE',
            'VACANT',
            'RESERVED',
            'OCCUPIED',
            'MAINTENANCE',
            'CHECKOUT_CLEANING',
          ])
          .optional(),
        decorationDate: z.coerce.date().optional(),
        statusReason: z.string().optional(),
        currentRentPrice: z.coerce.number().optional(),
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
            deposit: true,
            bills: {
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
    const activeLeaseCount = await prisma.lease.count({
      where: {
        roomId: req.params.roomId,
        organizationId: req.organizationId!,
        status: 'ACTIVE',
      },
    });
    if (activeLeaseCount > 0)
      throw new HttpError(400, '房间存在活跃租约，无法删除');
    await prisma.room.softDelete({ where: { id: req.params.roomId } });
    ok(res, { deleted: true });
  })
);

// US-102: 公寓状态变更
apartmentRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        status: z.enum([
          'PLANNING',
          'RENOVATING',
          'PREPARING',
          'ACTIVE',
          'SUSPENDED',
          'CLOSED',
        ]),
        reason: z.string().optional(),
      })
      .parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    ok(
      res,
      await prisma.apartment.update({
        where: { id: req.params.id },
        data: {
          status: input.status,
          statusReason: input.reason,
          statusChangedAt: new Date(),
        },
      })
    );
  })
);

apartmentRouter.get(
  '/:id/status-history',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: req.organizationId!,
        tableName: 'Apartment',
        recordId: req.params.id,
        action: 'UPDATE',
        fieldName: 'status',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    ok(res, logs);
  })
);

// US-103: 运营支出分类统计
apartmentRouter.get(
  '/:id/expense-summary',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const { year, month } = z
      .object({
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12).optional(),
      })
      .parse(req.query);

    const startDate = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const endDate = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);

    const expenses = await prisma.apartmentExpense.findMany({
      where: {
        apartmentId: req.params.id,
        spentAt: { gte: startDate, lt: endDate },
        deletedAt: null,
      },
      include: { category: true },
      orderBy: { spentAt: 'desc' },
    });

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      const key = e.category?.name ?? e.name;
      byCategory[key] = (byCategory[key] ?? 0) + Number(e.amount);
    }

    ok(res, { expenses, total, byCategory });
  })
);

// US-104-3: 公寓入住率趋势（最近12个月）
apartmentRouter.get(
  '/:id/occupancy-trend',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const apartment = await prisma.apartment.findUnique({
      where: { id: req.params.id },
      include: { rooms: true },
    });
    if (!apartment) throw new HttpError(404, '公寓不存在');

    const totalRooms = apartment.rooms.length;
    const now = new Date();
    const trends: { month: string; occupancyRate: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

      const occupiedCount = await prisma.lease.count({
        where: {
          room: { apartmentId: req.params.id },
          status: 'ACTIVE',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
      });

      trends.push({
        month: monthLabel,
        occupancyRate:
          totalRooms > 0
            ? Number(((occupiedCount / totalRooms) * 100).toFixed(2))
            : 0,
      });
    }

    ok(res, trends);
  })
);

// US-104-4: 公寓租金单价分布
apartmentRouter.get(
  '/:id/rent-distribution',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const leases = await prisma.lease.findMany({
      where: {
        room: { apartmentId: req.params.id },
        status: 'ACTIVE',
      },
      select: { rentAmount: true },
    });

    const buckets = [
      { min: 0, max: 1000, label: '0-1000元' },
      { min: 1000, max: 2000, label: '1000-2000元' },
      { min: 2000, max: 3000, label: '2000-3000元' },
      { min: 3000, max: 5000, label: '3000-5000元' },
      { min: 5000, max: Infinity, label: '5000元以上' },
    ];

    const result = buckets.map((b) => ({
      range: b.label,
      count: leases.filter((l) => {
        const rent = Number(l.rentAmount);
        return rent >= b.min && (b.max === Infinity || rent < b.max);
      }).length,
    }));

    ok(res, result);
  })
);

// US-104: 公寓可视化看板
apartmentRouter.get(
  '/:id/dashboard',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const apartment = await prisma.apartment.findUnique({
      where: { id: req.params.id },
      include: {
        rooms: {
          include: {
            leases: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
              include: { bills: true },
            },
          },
        },
        expenses: true,
      },
    });
    if (!apartment) throw new HttpError(404, '公寓不存在');

    const totalRooms = apartment.rooms.length;
    const occupiedRooms = apartment.rooms.filter((r) =>
      r.leases.some((l) => l.status === 'ACTIVE')
    ).length;
    const vacantRooms = totalRooms - occupiedRooms;
    const maintenanceRooms = apartment.rooms.filter(
      (r) => r.status === 'MAINTENANCE'
    ).length;

    const currentMonth = new Date();
    const monthStart = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );
    const monthEnd = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    );

    let receivable = 0;
    let received = 0;
    let overdue = 0;
    for (const room of apartment.rooms) {
      for (const lease of room.leases) {
        for (const bill of lease.bills) {
          if (bill.billingDate >= monthStart && bill.billingDate < monthEnd) {
            receivable += Number(bill.totalAmount);
            received += Number(bill.paidAmount);
            if (bill.status === 'OVERDUE')
              overdue += Number(bill.totalAmount) - Number(bill.paidAmount);
          }
        }
      }
    }

    ok(res, {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      maintenanceRooms,
      occupancyRate:
        totalRooms > 0
          ? ((occupiedRooms / totalRooms) * 100).toFixed(2)
          : '0.00',
      currentMonth: {
        receivable,
        received,
        overdue,
      },
    });
  })
);

// ===== 合同子资源（US-101：公寓档案包含房东合同） =====

apartmentRouter.get(
  '/:id/contract',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const contract = await prisma.landlordContract.findFirst({
      where: { apartmentId: req.params.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { payments: { orderBy: { dueDate: 'asc' } } },
    });
    if (!contract) throw new HttpError(404, '该公寓暂无合同信息');
    ok(res, contract);
  })
);

apartmentRouter.put(
  '/:id/contract',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = contractInput.parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const existing = await prisma.landlordContract.findFirst({
      where: { apartmentId: req.params.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      ok(
        res,
        await prisma.landlordContract.update({
          where: { id: existing.id },
          data: input,
        })
      );
    } else {
      ok(
        res,
        await prisma.landlordContract.create({
          data: { ...input, apartmentId: req.params.id },
        })
      );
    }
  })
);

apartmentRouter.post(
  '/:id/payment-plan/generate',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const contract = await prisma.landlordContract.findFirst({
      where: { apartmentId: req.params.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!contract)
      throw new HttpError(404, '该公寓暂无合同信息，无法生成付款计划');

    // 删除该公寓下所有未付款的计划，重新生成
    await prisma.landlordPayment.deleteMany({
      where: {
        apartmentId: req.params.id,
        organizationId: req.organizationId!,
        status: 'PENDING',
      },
    });

    const intervalMonths = getIntervalMonths(contract.paymentMethod);
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    const payments = [];

    let currentDate = new Date(startDate);
    let periodIndex = 0;
    let currentRent = Number(contract.rentAmount);

    while (currentDate < endDate) {
      const periodStart = new Date(currentDate);
      let periodEnd = addMonths(currentDate, intervalMonths);
      if (periodEnd > endDate) {
        periodEnd = new Date(endDate);
      }

      let plannedAmount = currentRent * intervalMonths;
      const actualMonths = diffInMonths(periodStart, periodEnd);
      if (actualMonths !== intervalMonths) {
        plannedAmount = currentRent * actualMonths;
      }

      if (
        contract.freeRentDays > 0 &&
        contract.freeRentStart &&
        contract.freeRentEnd
      ) {
        const frStart = new Date(contract.freeRentStart);
        const frEnd = new Date(contract.freeRentEnd);
        if (periodStart >= frStart && periodEnd <= frEnd) {
          plannedAmount = 0;
        } else if (periodStart < frEnd && periodEnd > frStart) {
          const overlapStart = periodStart > frStart ? periodStart : frStart;
          const overlapEnd = periodEnd < frEnd ? periodEnd : frEnd;
          const overlapDays =
            (overlapEnd.getTime() - overlapStart.getTime()) /
            (1000 * 60 * 60 * 24);
          const periodDays =
            (periodEnd.getTime() - periodStart.getTime()) /
            (1000 * 60 * 60 * 24);
          if (periodDays > 0) {
            plannedAmount = plannedAmount * (1 - overlapDays / periodDays);
          }
        }
      }

      if (
        periodIndex > 0 &&
        contract.escalationType &&
        contract.escalationValue &&
        contract.escalationCycle &&
        contract.escalationCycle > 0
      ) {
        const monthsElapsed = diffInMonths(startDate, periodStart);
        if (
          monthsElapsed > 0 &&
          monthsElapsed % contract.escalationCycle === 0
        ) {
          if (contract.escalationType === 'FIXED_AMOUNT') {
            currentRent += Number(contract.escalationValue);
          } else if (contract.escalationType === 'PERCENTAGE') {
            currentRent *= 1 + Number(contract.escalationValue) / 100;
          }
          plannedAmount = currentRent * actualMonths;
        }
      }

      payments.push({
        organizationId: req.organizationId!,
        landlordContractId: contract.id,
        apartmentId: req.params.id,
        periodStart,
        periodEnd,
        dueDate: periodStart,
        plannedAmount: Math.round(plannedAmount * 100) / 100,
        status: 'PENDING',
      });

      currentDate = periodEnd;
      periodIndex++;
    }

    const created = await prisma.landlordPayment.createMany({ data: payments });
    ok(res, { generated: created.count });
  })
);

apartmentRouter.get(
  '/:id/payments',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const status = z
      .enum(['PENDING', 'PAID', 'OVERDUE'])
      .optional()
      .parse(req.query.status);
    const payments = await prisma.landlordPayment.findMany({
      where: {
        apartmentId: req.params.id,
        organizationId: req.organizationId!,
        ...(status ? { status } : {}),
      },
      include: { expense: { select: { id: true, name: true, amount: true } } },
      orderBy: { dueDate: 'asc' },
    });
    ok(res, payments);
  })
);

apartmentRouter.post(
  '/:id/payments/:paymentId/pay',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        paidAmount: z.coerce.number().positive(),
        paidAt: z.coerce.date(),
        voucherNo: z.string().optional(),
        paymentMethod: z.string().optional(),
        note: z.string().optional(),
        createExpense: z.boolean().optional(),
      })
      .parse(req.body);

    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const payment = await prisma.landlordPayment.findFirst({
      where: {
        id: req.params.paymentId,
        apartmentId: req.params.id,
        organizationId: req.organizationId!,
      },
    });
    if (!payment) throw new HttpError(404, '付款计划不存在');

    let expenseId: string | undefined;
    if (input.createExpense) {
      const expense = await prisma.apartmentExpense.create({
        data: {
          apartmentId: req.params.id,
          name: `房东租金付款 - ${payment.landlordContractId.slice(0, 8)}`,
          amount: input.paidAmount,
          spentAt: input.paidAt,
          note: input.note || input.voucherNo,
          createdById: req.user!.id,
        },
      });
      expenseId = expense.id;
    }

    const updated = await prisma.landlordPayment.update({
      where: { id: req.params.paymentId },
      data: {
        paidAmount: input.paidAmount,
        paidAt: input.paidAt,
        voucherNo: input.voucherNo,
        paymentMethod: input.paymentMethod,
        status: 'PAID',
        note: input.note,
        ...(expenseId ? { expenseId } : {}),
      },
      include: { expense: true },
    });

    ok(res, updated);
  })
);

apartmentRouter.delete(
  '/:id/payments/:paymentId',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const payment = await prisma.landlordPayment.findFirst({
      where: {
        id: req.params.paymentId,
        apartmentId: req.params.id,
        organizationId: req.organizationId!,
      },
    });
    if (!payment) throw new HttpError(404, '付款计划不存在');
    if (payment.status === 'PAID') {
      throw new HttpError(400, '已付款的计划不能删除');
    }
    await prisma.landlordPayment.softDelete({
      where: { id: req.params.paymentId },
    });
    ok(res, { deleted: true });
  })
);
