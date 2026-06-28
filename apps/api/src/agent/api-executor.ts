import { Prisma } from '@prisma/client';
import type { ApiManifestItem } from './api-manifest.js';
import {
  createApartment,
  batchCreateRooms,
  ensureApartmentInOrg,
  ensureRoomInOrg,
  createApartmentExpense,
  updateRoom,
  getApartmentName,
  updateApartment,
  countActiveLeasesInApartment,
  deleteApartment,
  countActiveLeasesInRoom,
  deleteRoom,
} from '../services/apartment.js';
import {
  createMeterReading,
  findRoomForMeterReading,
  findLeaseForMeterReading,
  findPendingPostpaidBillsByRoom,
  applyUtilityReadingToBill,
  getBillById,
  deleteBillWithPayments,
  findPendingPostpaidBillsForExport,
  getBillForRetry,
} from '../services/bill.js';
import {
  createLeaseWithDeposit,
  createLeaseWithoutDeposit,
} from '../services/lease.js';
import { recordBillPayment, refundBill } from '../services/billing.js';
import { createTransaction } from '../services/transaction.js';
import {
  findRoomForReservation,
  upsertReservation,
  deleteReservation,
  getReservationByRoomId,
} from '../services/reservation.js';
import {
  retryPostpaidBillAndMonthlyBill,
  generateCurrentLeaseBills,
  generateLeaseBills,
  voidBill,
  assertBillOperation,
} from '../services/billing.js';
import {
  createLeaseSettlement,
  recordSettlementPayment,
  getLeaseSettlementPreview,
} from '../services/leaseSettlement.js';
import {
  getLeaseEndDate,
  getLeaseById,
  getLeaseWithFees,
  findRoomById,
  activateLease,
  updateLease,
  updateRoomStatus,
} from '../services/lease.js';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const getBillPeriod = (bill: {
  items: Array<{ periodStart: Date; periodEnd: Date }>;
}) => {
  const firstItem = bill.items[0];
  return {
    periodStart: firstItem ? formatDate(firstItem.periodStart) : '',
    periodEnd: firstItem ? formatDate(firstItem.periodEnd) : '',
  };
};
import { parseUtilityImportRows } from '../services/utilityImport.js';
import {
  listApartmentsRaw,
  listRoomsRaw,
  getRoomByIdRaw,
} from '../services/apartment.js';
import { listBillsRaw, listMeterReadingsRaw } from '../services/bill.js';
import { listLeasesRaw, listLeaseSettlementsRaw } from '../services/lease.js';
import {
  listTransactionsRaw,
  getTransactionSummaryRaw,
  getTransactionById,
  deleteTransaction,
} from '../services/transaction.js';
import { findReservationByRoomIdRaw } from '../services/reservation.js';
import { getCategoryLabel } from '../services/transactionCategories.js';
import { TRANSACTION_CATEGORIES } from '../services/transactionCategories.js';
import { calculateDepositSummary } from '../services/depositUtils.js';
import { recordDepositPayment } from '../services/deposit.js';
import { hasExpired, isAutoRenewalPeriod } from '../services/leaseLifecycle.js';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';

const CHART_COLOR_SCHEME = [
  '#2563eb',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
];

export interface ExecutorContext {
  organizationId: string;
  userId: string;
}

function pathToRegex(manifestPath: string): RegExp {
  const pattern = manifestPath
    .split('/')
    .map((part) =>
      part.startsWith(':')
        ? '[^/]+'
        : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('/');
  return new RegExp(`^${pattern}$`);
}

function parsePathParams(
  manifestPath: string,
  actualPath: string
): Record<string, string> {
  const manifestParts = manifestPath.split('/');
  const actualParts = actualPath.split('/');
  const params: Record<string, string> = {};

  for (let i = 0; i < manifestParts.length; i++) {
    const part = manifestParts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = actualParts[i];
    }
  }

  return params;
}

export async function executeApiAction(
  item: ApiManifestItem,
  actualPath: string,
  body: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<unknown> {
  if (!pathToRegex(item.path).test(actualPath)) {
    throw new HttpError(400, `请求路径与接口模板不匹配：${item.path}`);
  }

  const validatedBody = item.bodySchema
    ? (item.bodySchema.parse(body) as Record<string, unknown>)
    : body;

  const pathParams = parsePathParams(item.path, actualPath);

  switch (item.name) {
    // --- 查询类 ---
    case 'query_apartments': {
      const apartments = await listApartmentsRaw(ctx.organizationId, {
        keyword: validatedBody.keyword as string | undefined,
        limit: validatedBody.limit as number | undefined,
        includeRoomStats: true,
      });
      return apartments.map((a) => ({
        id: a.id,
        name: a.name,
        location: a.location,
        roomCount: a._count.rooms,
        occupiedCount: a.rooms.filter((r) => r.status === 'OCCUPIED').length,
        vacantCount: a.rooms.filter((r) => r.status === 'VACANT').length,
      }));
    }

    case 'query_apartment_contract': {
      const apartment = await prisma.apartment.findFirst({
        where: { id: pathParams.id, organizationId: ctx.organizationId },
        select: { id: true, name: true },
      });
      if (!apartment) return null;
      const contract = await prisma.apartmentContract.findUnique({
        where: { apartmentId: pathParams.id },
      });
      return {
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        contract: contract
          ? {
              landlordName: contract.landlordName,
              landlordPhone: contract.landlordPhone,
              contractStart: contract.contractStart
                ? contract.contractStart.toISOString().split('T')[0]
                : null,
              contractEnd: contract.contractEnd
                ? contract.contractEnd.toISOString().split('T')[0]
                : null,
              rentAmount: contract.rentAmount
                ? Number(contract.rentAmount)
                : null,
              floors: contract.floors,
              landArea: contract.landArea ? Number(contract.landArea) : null,
              totalArea: contract.totalArea ? Number(contract.totalArea) : null,
            }
          : null,
      };
    }

    case 'query_rooms': {
      const rooms = await listRoomsRaw(ctx.organizationId, {
        apartmentId: validatedBody.apartmentId as string | undefined,
        status: validatedBody.status as
          | 'VACANT'
          | 'RESERVED'
          | 'OCCUPIED'
          | 'MAINTENANCE'
          | 'SELF_USE'
          | undefined,
        keyword: validatedBody.keyword as string | undefined,
        limit: validatedBody.limit as number | undefined,
      });
      return rooms.map((r) => ({
        id: r.id,
        roomNo: r.roomNo,
        apartmentName: r.apartment.name,
        layout: r.layout,
        status: r.status,
        area: r.area ? Number(r.area) : null,
        facilities: r.facilities,
      }));
    }

    case 'query_room_detail': {
      const room = await getRoomByIdRaw(pathParams.roomId, ctx.organizationId);
      if (!room) return null;

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const currentBills = await prisma.bill.findMany({
        where: {
          lease: {
            roomId: pathParams.roomId,
            organizationId: ctx.organizationId,
          },
          deletedAt: null,
          billingDate: {
            gte: monthStart,
            lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
          },
        },
        select: { id: true, status: true, totalAmount: true, mode: true },
      });

      const activeLease = room.leases[0];
      return {
        id: room.id,
        roomNo: room.roomNo,
        apartmentName: room.apartment.name,
        apartmentLocation: room.apartment.location,
        layout: room.layout,
        status: room.status,
        area: room.area ? Number(room.area) : null,
        facilities: room.facilities,
        reservation: room.reservation
          ? {
              name: room.reservation.name,
              phone: room.reservation.phone,
              deposit: Number(room.reservation.deposit),
              expectedMoveInDate: room.reservation.expectedMoveInDate
                .toISOString()
                .split('T')[0],
            }
          : null,
        activeLease: activeLease
          ? {
              leaseId: activeLease.id,
              tenantName: activeLease.tenantName,
              tenantPhone: activeLease.tenantPhone,
              startDate: activeLease.startDate.toISOString().split('T')[0],
              endDate: activeLease.endDate.toISOString().split('T')[0],
              rentAmount: Number(activeLease.rentAmount),
              cycle: activeLease.cycle,
              fees: activeLease.fees.map((f) => ({
                type: f.type,
                name: f.name,
                amount: Number(f.amount),
              })),
              deposits: activeLease.deposits.map((d) => ({
                type: d.type,
                amount: Number(d.amount),
                paidAmount: Number(d.paidAmount),
                status: d.status,
              })),
            }
          : null,
        currentMonthBills: currentBills.map((b) => ({
          id: b.id,
          status: b.status,
          totalAmount: Number(b.totalAmount),
          mode: b.mode,
        })),
        recentReadings: room.meterReadings.map((r) => ({
          meterType: r.meterType,
          readingDate: r.readingDate.toISOString().split('T')[0],
          value: Number(r.value),
        })),
      };
    }

    case 'query_leases': {
      const leases = await listLeasesRaw(ctx.organizationId, {
        tenantName: validatedBody.tenantName as string | undefined,
        roomId: validatedBody.roomId as string | undefined,
        status: validatedBody.status as
          | 'ACTIVE'
          | 'TERMINATED'
          | 'EXPIRED'
          | 'DRAFT'
          | undefined,
        limit: validatedBody.limit as number | undefined,
      });
      return leases.map((l) => ({
        id: l.id,
        tenantName: l.tenantName,
        tenantPhone: l.tenantPhone,
        roomNo: l.room.roomNo,
        apartmentName: l.room.apartment.name,
        startDate: l.startDate.toISOString().split('T')[0],
        endDate: l.endDate.toISOString().split('T')[0],
        rentAmount: Number(l.rentAmount),
        depositAmount: Number(l.depositAmount),
        roomDepositAmount: Number(l.roomDepositAmount),
        keyQuantity: l.keyQuantity,
        keyUnitPrice: Number(l.keyUnitPrice),
        waterUnitPrice: Number(l.waterUnitPrice),
        powerUnitPrice: Number(l.powerUnitPrice),
        status: l.status,
        isExpired: hasExpired(l),
        isAutoRenewal: isAutoRenewalPeriod(l),
        cycle: l.cycle,
        autoRenew: l.autoRenew,
        fees: l.fees.map((f) => ({
          type: f.type,
          name: f.name,
          amount: Number(f.amount),
        })),
        deposits: l.deposits.map((d) => ({
          id: d.id,
          type: d.type,
          amount: Number(d.amount),
          paidAmount: Number(d.paidAmount),
          refundedAmount: Number(d.refundedAmount),
          deductedAmount: Number(d.deductedAmount),
          status: d.status,
        })),
      }));
    }

    case 'query_settlements': {
      const settlements = await listLeaseSettlementsRaw(ctx.organizationId, {
        leaseId: validatedBody.leaseId as string | undefined,
        limit: validatedBody.limit as number | undefined,
      });
      return settlements.map((s) => ({
        id: s.id,
        tenantName: s.lease.tenantName,
        roomNo: s.lease.room.roomNo,
        apartmentName: s.lease.room.apartment.name,
        type: s.type,
        reason: s.reason,
        terminatedAt: s.terminatedAt.toISOString().split('T')[0],
        rentAdjustmentAmount: Number(s.rentAdjustmentAmount),
        otherFeeAmount: Number(s.otherFeeAmount),
        penaltyAmount: Number(s.penaltyAmount),
        compensationAmount: Number(s.compensationAmount),
        depositRefundAmount: Number(s.depositRefundAmount ?? 0),
        roomDepositAmount: Number(s.roomDepositAmount ?? 0),
        keyDepositAmount: Number(s.keyDepositAmount ?? 0),
        roomDepositRefundAmount: Number(s.roomDepositRefundAmount ?? 0),
        keyDepositRefundAmount: Number(s.keyDepositRefundAmount ?? 0),
        roomDepositDeductionAmount: Number(s.roomDepositDeductionAmount ?? 0),
        keyDepositDeductionAmount: Number(s.keyDepositDeductionAmount ?? 0),
        depositDeductionReason: s.depositDeductionReason,
        netAmount: Number(s.netAmount ?? 0),
        status: s.status,
        billAmount: s.bill ? Number(s.bill.totalAmount) : null,
        billPaidAmount: s.bill ? Number(s.bill.paidAmount) : null,
        paymentCount: s.payments.length,
        totalPaid: s.payments.reduce((sum, p) => sum + Number(p.amount), 0),
        createdAt: s.createdAt.toISOString().split('T')[0],
      }));
    }

    case 'query_bills': {
      const bills = await listBillsRaw(ctx.organizationId, {
        status: validatedBody.status as
          | 'BILLING'
          | 'UNPAID'
          | 'PAID'
          | 'REFUNDED'
          | 'VOID'
          | undefined,
        tenantName: validatedBody.tenantName as string | undefined,
        mode: validatedBody.mode as
          | 'PREPAID'
          | 'POSTPAID'
          | 'DEPOSIT'
          | undefined,
        limit: validatedBody.limit as number | undefined,
      });
      return bills.map((b) => ({
        id: b.id,
        tenantName: b.lease.tenantName,
        roomNo: b.lease.room.roomNo,
        billingDate: formatDate(b.billingDate),
        ...getBillPeriod(b),
        dueDate: formatDate(b.dueDate),
        totalAmount: Number(b.totalAmount),
        paidAmount: Number(b.paidAmount),
        remainingAmount: Number(
          (Number(b.totalAmount) - Number(b.paidAmount)).toFixed(2)
        ),
        status: b.status,
        mode: b.mode,
        note: b.note,
        failureReason: b.failureReason,
        items: b.items.map((item) => ({
          type: item.type,
          name: item.name,
          amount: Number(item.amount),
          status: item.status,
          previousWater: item.previousWater ? Number(item.previousWater) : null,
          currentWater: item.currentWater ? Number(item.currentWater) : null,
          previousPower: item.previousPower ? Number(item.previousPower) : null,
          currentPower: item.currentPower ? Number(item.currentPower) : null,
        })),
        payments: b.payments.map((p) => ({
          id: p.id,
          type: p.type,
          amount: Number(p.amount),
          method: p.method,
          status: p.status,
          note: p.note,
          recordedBy: p.user.username,
          paidAt: p.paidAt.toISOString().split('T')[0],
        })),
      }));
    }

    case 'query_meter_readings': {
      const readings = await listMeterReadingsRaw(ctx.organizationId, {
        roomId: validatedBody.roomId as string | undefined,
        meterType: validatedBody.meterType as 'WATER' | 'POWER' | undefined,
        limit: validatedBody.limit as number | undefined,
      });
      return readings.map((r) => ({
        id: r.id,
        roomNo: r.room.roomNo,
        apartmentName: r.room.apartment.name,
        meterType: r.meterType,
        readingDate: r.readingDate.toISOString().split('T')[0],
        value: Number(r.value),
        source: r.source,
        status: r.status,
        note: r.note,
        createdBy: r.createdBy?.username ?? null,
      }));
    }

    case 'query_transactions': {
      const result = await listTransactionsRaw({
        organizationId: ctx.organizationId,
        type: validatedBody.type as 'INCOME' | 'EXPENSE' | undefined,
        category: validatedBody.category as string | undefined,
        startDate: validatedBody.startDate as Date | undefined,
        endDate: validatedBody.endDate as Date | undefined,
        sourceType: validatedBody.sourceType as
          | 'BILL_PAYMENT'
          | 'DEPOSIT_PAYMENT'
          | 'SETTLEMENT_PAYMENT'
          | 'APARTMENT_EXPENSE'
          | 'RESERVATION'
          | 'MANUAL'
          | undefined,
        keyword: validatedBody.keyword as string | undefined,
        page: validatedBody.page as number | undefined,
        pageSize: validatedBody.pageSize as number | undefined,
      });
      return {
        ...result,
        items: result.items.map((t) => ({
          id: t.id,
          type: t.type,
          category: t.category,
          categoryLabel: getCategoryLabel(t.category),
          amount: Number(t.amount),
          method: t.method,
          description: t.description,
          sourceType: t.sourceType,
          occurredAt: t.occurredAt.toISOString().split('T')[0],
          note: t.note,
          apartmentName: t.apartment?.name ?? null,
          tenantName: t.lease?.tenantName ?? null,
          roomNo: t.lease?.room?.roomNo ?? null,
          operatorName: t.operator?.username ?? null,
        })),
      };
    }

    case 'query_transaction_summary': {
      const transactions = await getTransactionSummaryRaw({
        organizationId: ctx.organizationId,
        startDate: validatedBody.startDate as Date | undefined,
        endDate: validatedBody.endDate as Date | undefined,
      });
      let totalIncome = 0;
      let totalExpense = 0;
      const byCategory: Record<
        string,
        { label: string; income: number; expense: number }
      > = {};
      for (const t of transactions) {
        const amount = Number(t.amount);
        if (t.type === 'INCOME') {
          totalIncome += amount;
        } else {
          totalExpense += amount;
        }
        if (!byCategory[t.category]) {
          byCategory[t.category] = {
            label: getCategoryLabel(t.category),
            income: 0,
            expense: 0,
          };
        }
        if (t.type === 'INCOME') {
          byCategory[t.category].income += amount;
        } else {
          byCategory[t.category].expense += amount;
        }
      }
      return {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        netIncome: Number((totalIncome - totalExpense).toFixed(2)),
        transactionCount: transactions.length,
        byCategory: Object.entries(byCategory).map(([key, val]) => ({
          category: key,
          label: val.label,
          income: Number(val.income.toFixed(2)),
          expense: Number(val.expense.toFixed(2)),
        })),
      };
    }

    case 'query_deposits': {
      const status = validatedBody.status as
        | 'UNPAID'
        | 'PAID'
        | 'PARTIAL_REFUNDED'
        | 'FULLY_REFUNDED'
        | 'DEDUCTED'
        | undefined;
      const deposits = await prisma.deposit.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(status ? { status } : {}),
        },
        include: {
          lease: {
            include: {
              room: { include: { apartment: { select: { name: true } } } },
            },
          },
        },
        take: (validatedBody.limit as number | undefined) ?? 30,
        orderBy: { createdAt: 'desc' },
      });
      return deposits.map((d) => ({
        id: d.id,
        tenantName: d.lease.tenantName,
        roomNo: d.lease.room.roomNo,
        apartmentName: d.lease.room.apartment.name,
        type: d.type,
        amount: Number(d.amount),
        paidAmount: Number(d.paidAmount),
        refundedAmount: Number(d.refundedAmount),
        deductedAmount: Number(d.deductedAmount),
        status: d.status,
        createdAt: d.createdAt.toISOString().split('T')[0],
      }));
    }

    case 'query_deposit_summary': {
      const deposits = await prisma.deposit.findMany({
        where: { organizationId: ctx.organizationId },
      });
      const summary = calculateDepositSummary(deposits);
      const byStatus: Record<string, number> = {};
      for (const d of deposits) {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      }
      return {
        totalAmount: Number(summary.totalAmount.toFixed(2)),
        paidAmount: Number(summary.paidAmount.toFixed(2)),
        refundedAmount: Number(summary.refundedAmount.toFixed(2)),
        deductedAmount: Number(summary.deductedAmount.toFixed(2)),
        heldAmount: Number(summary.heldAmount.toFixed(2)),
        totalCount: summary.count,
        byStatus,
      };
    }

    case 'query_reservation': {
      const reservation = await findReservationByRoomIdRaw(
        pathParams.roomId,
        ctx.organizationId
      );
      if (!reservation) return { exists: false };
      return {
        exists: true,
        id: reservation.id,
        roomNo: reservation.room.roomNo,
        apartmentName: reservation.room.apartment.name,
        roomStatus: reservation.room.status,
        customerName: reservation.name,
        customerPhone: reservation.phone,
        deposit: Number(reservation.deposit),
        paymentMethod: reservation.paymentMethod,
        expectedMoveInDate: reservation.expectedMoveInDate
          .toISOString()
          .split('T')[0],
        createdAt: reservation.createdAt.toISOString().split('T')[0],
      };
    }

    case 'analytics_summary': {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [apartments, rooms, activeLeases, monthlyBills, allBills] =
        await Promise.all([
          listApartmentsRaw(ctx.organizationId),
          listRoomsRaw(ctx.organizationId),
          prisma.lease.count({
            where: {
              organizationId: ctx.organizationId,
              deletedAt: null,
              status: 'ACTIVE',
            },
          }),
          prisma.bill.groupBy({
            by: ['status'],
            where: {
              organizationId: ctx.organizationId,
              deletedAt: null,
              billingDate: { gte: startOfMonth, lt: endOfMonth },
            },
            _sum: { totalAmount: true, paidAmount: true },
          }),
          prisma.bill.groupBy({
            by: ['status'],
            where: { organizationId: ctx.organizationId, deletedAt: null },
            _sum: { totalAmount: true, paidAmount: true },
          }),
        ]);

      const totalApartments = apartments.length;
      const totalRooms = rooms.length;
      const occupiedRooms = rooms.filter((r) => r.status === 'OCCUPIED').length;
      const vacantRooms = rooms.filter((r) => r.status === 'VACANT').length;
      const monthlyRentIncome =
        monthlyBills
          .filter((b) => b.status === 'PAID')
          .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;
      const totalBilled =
        allBills.reduce((sum, b) => sum + Number(b._sum.totalAmount || 0), 0) ||
        0;
      const totalPaid =
        allBills
          .filter((b) => b.status === 'PAID')
          .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;

      return {
        totalApartments,
        totalRooms,
        occupiedRooms,
        vacantRooms,
        occupancyRate:
          totalRooms > 0
            ? Number(((occupiedRooms / totalRooms) * 100).toFixed(2))
            : 0,
        activeLeases,
        monthlyRentIncome: Number(monthlyRentIncome.toFixed(2)),
        unpaidBillsAmount: Number((totalBilled - totalPaid).toFixed(2)),
        paidBillsAmount: Number(totalPaid.toFixed(2)),
        collectionRate:
          totalBilled > 0
            ? Number(((totalPaid / totalBilled) * 100).toFixed(2))
            : 100,
      };
    }

    case 'generate_chart': {
      return {
        chartType: validatedBody.chartType,
        title: validatedBody.title,
        labels: validatedBody.labels,
        datasets: validatedBody.datasets,
        unit: validatedBody.unit,
        colors: CHART_COLOR_SCHEME,
      };
    }

    // --- 写操作类 ---
    case 'create_apartment': {
      return createApartment({
        name: validatedBody.name as string,
        location: validatedBody.location as string,
        organizationId: ctx.organizationId,
      });
    }

    case 'batch_create_rooms': {
      return batchCreateRooms(
        pathParams.id,
        ctx.organizationId,
        (validatedBody.rooms as Array<{
          roomNo: string;
          layout: string;
          area?: number;
          facilities: string[];
        }>) ?? []
      );
    }

    case 'create_apartment_expense': {
      await ensureApartmentInOrg(pathParams.id, ctx.organizationId);
      const expense = await createApartmentExpense({
        name: validatedBody.name as string,
        amount: Number(validatedBody.amount),
        spentAt: new Date(validatedBody.spentAt as string),
        note: validatedBody.note as string | undefined,
        apartmentId: pathParams.id,
      });

      const apartmentName = await getApartmentName(pathParams.id);
      await createTransaction({
        organizationId: ctx.organizationId,
        type: 'EXPENSE',
        category: 'OTHER_EXPENSE',
        amount: new Prisma.Decimal(Number(validatedBody.amount)),
        method: '现金',
        description: `${apartmentName || '公寓'} - ${validatedBody.name as string}`,
        note: validatedBody.note as string | undefined,
        operatorId: ctx.userId,
        sourceType: 'APARTMENT_EXPENSE',
        sourceId: expense.id,
        apartmentId: pathParams.id,
      });

      return expense;
    }

    case 'update_room': {
      await ensureRoomInOrg(pathParams.roomId, ctx.organizationId);
      const updateData: {
        roomNo?: string;
        layout?: string;
        area?: number;
        facilities?: string[];
        status?:
          | 'VACANT'
          | 'RESERVED'
          | 'OCCUPIED'
          | 'MAINTENANCE'
          | 'SELF_USE';
      } = {};
      if (validatedBody.roomNo !== undefined) {
        updateData.roomNo = validatedBody.roomNo as string;
      }
      if (validatedBody.layout !== undefined) {
        updateData.layout = validatedBody.layout as string;
      }
      if (validatedBody.area !== undefined) {
        updateData.area = Number(validatedBody.area);
      }
      if (validatedBody.facilities !== undefined) {
        updateData.facilities = validatedBody.facilities as string[];
      }
      if (validatedBody.status !== undefined) {
        updateData.status = validatedBody.status as
          | 'VACANT'
          | 'RESERVED'
          | 'OCCUPIED'
          | 'MAINTENANCE'
          | 'SELF_USE';
      }
      return updateRoom(pathParams.roomId, updateData);
    }

    case 'create_meter_reading': {
      const room = await findRoomForMeterReading(
        validatedBody.roomId as string,
        ctx.organizationId
      );
      if (!room) throw new HttpError(404, '房间不存在');
      const lease = await findLeaseForMeterReading(
        room.id,
        ctx.organizationId,
        new Date(validatedBody.readingDate as string)
      );

      const reading = await createMeterReading({
        organizationId: ctx.organizationId,
        apartmentId: room.apartmentId,
        roomId: room.id,
        leaseId: lease?.id,
        meterType: validatedBody.meterType as 'WATER' | 'POWER',
        readingDate: new Date(validatedBody.readingDate as string),
        value: Number(validatedBody.value),
        source: (validatedBody.source as 'MANUAL' | 'IMPORT') ?? 'MANUAL',
        status:
          (validatedBody.status as
            | 'NORMAL'
            | 'SUSPECTED'
            | 'CONFIRMED'
            | 'VOID') ?? 'NORMAL',
        note: validatedBody.note as string | undefined,
        createdById: ctx.userId,
      });

      const pendingBills = await findPendingPostpaidBillsByRoom(room.id);
      await Promise.all(
        pendingBills.map((b) =>
          retryPostpaidBillAndMonthlyBill(b.id).catch(() => null)
        )
      );

      return reading;
    }

    case 'create_lease': {
      const fees = (
        (validatedBody.fees as Array<{
          type:
            | 'MANAGEMENT'
            | 'SANITATION'
            | 'ELEVATOR'
            | 'PROPERTY'
            | 'NETWORK'
            | 'OTHER';
          name: string;
          amount: number;
        }>) ?? []
      ).map((f) => ({
        ...f,
        amount: new Prisma.Decimal(f.amount),
      }));
      const roomDepositAmount = new Prisma.Decimal(
        Number(validatedBody.roomDepositAmount ?? 0)
      );
      const keyQuantity = Number(validatedBody.keyQuantity ?? 0);
      const keyUnitPrice = new Prisma.Decimal(
        Number(validatedBody.keyUnitPrice ?? 0)
      );
      const keyDepositAmount = new Prisma.Decimal(keyQuantity).mul(
        keyUnitPrice
      );
      const depositAmount = roomDepositAmount.plus(keyDepositAmount);

      const leaseData = {
        tenantName: validatedBody.tenantName as string | undefined,
        tenantPhone: validatedBody.tenantPhone as string | undefined,
        startDate: new Date(validatedBody.startDate as string),
        endDate: new Date(validatedBody.endDate as string),
        cycle: validatedBody.cycle as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
        rentAmount: new Prisma.Decimal(Number(validatedBody.rentAmount)),
        depositAmount,
        roomDepositAmount,
        keyQuantity,
        keyUnitPrice,
        waterUnitPrice: new Prisma.Decimal(
          Number(validatedBody.waterUnitPrice)
        ),
        powerUnitPrice: new Prisma.Decimal(
          Number(validatedBody.powerUnitPrice)
        ),
        autoRenew: Boolean(validatedBody.autoRenew),
        status: (validatedBody.status as 'DRAFT' | 'ACTIVE') ?? 'ACTIVE',
      };

      const createFn = depositAmount.greaterThan(0)
        ? createLeaseWithDeposit
        : createLeaseWithoutDeposit;

      return createFn({
        leaseData,
        roomId: validatedBody.roomId as string,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        fees,
      });
    }

    case 'record_bill_payment': {
      return recordBillPayment({
        billId: pathParams.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        amount: Number(validatedBody.amount),
        method: validatedBody.method as string,
        note: validatedBody.note as string | undefined,
      });
    }

    case 'refund_bill': {
      return refundBill({
        billId: pathParams.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        amount: Number(validatedBody.amount),
        method: validatedBody.method as string,
        note: validatedBody.note as string | undefined,
      });
    }

    case 'create_transaction': {
      return createTransaction({
        organizationId: ctx.organizationId,
        operatorId: ctx.userId,
        sourceType: 'MANUAL',
        sourceId: 'manual',
        type: validatedBody.type as 'INCOME' | 'EXPENSE',
        category: validatedBody.category as string,
        amount: new Prisma.Decimal(Number(validatedBody.amount)),
        method: validatedBody.method as string,
        occurredAt: validatedBody.occurredAt
          ? new Date(validatedBody.occurredAt as string)
          : undefined,
        apartmentId: validatedBody.apartmentId as string | undefined,
        note: validatedBody.note as string | undefined,
      });
    }

    case 'create_reservation': {
      const room = await findRoomForReservation(
        validatedBody.roomId as string,
        ctx.organizationId
      );
      if (!room) throw new HttpError(404, '房间不存在');
      return upsertReservation({
        roomId: validatedBody.roomId as string,
        name: validatedBody.name as string,
        phone: validatedBody.phone as string,
        deposit: Number(validatedBody.deposit ?? 0),
        paymentMethod: validatedBody.paymentMethod as string | undefined,
        expectedMoveInDate: new Date(
          validatedBody.expectedMoveInDate as string
        ),
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        roomStatus: room.status,
        apartmentId: room.apartmentId,
        roomNo: room.roomNo,
        apartmentName: room.apartment.name,
      });
    }

    case 'generate_bills': {
      if (!validatedBody.leaseId) {
        return generateCurrentLeaseBills(
          ctx.organizationId,
          validatedBody.today
            ? new Date(validatedBody.today as string)
            : new Date()
        );
      }
      return {
        billIds: await generateLeaseBills(
          validatedBody.leaseId as string,
          validatedBody.today
            ? new Date(validatedBody.today as string)
            : new Date()
        ),
      };
    }

    case 'apply_utility_reading': {
      return applyUtilityReadingToBill({
        billId: pathParams.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        previousWater: Number(validatedBody.previousWater),
        currentWater: Number(validatedBody.currentWater),
        previousPower: Number(validatedBody.previousPower),
        currentPower: Number(validatedBody.currentPower),
      });
    }

    case 'import_utility_readings': {
      const rows = validatedBody.csv
        ? parseUtilityImportRows(validatedBody.csv as string)
        : ((validatedBody.rows as Array<{
            billId: string;
            previousWater: number;
            currentWater: number;
            previousPower: number;
            currentPower: number;
          }>) ?? []);
      const results = [];
      for (const row of rows) {
        results.push(
          await applyUtilityReadingToBill({
            billId: row.billId,
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            previousWater: Number(row.previousWater),
            currentWater: Number(row.currentWater),
            previousPower: Number(row.previousPower),
            currentPower: Number(row.currentPower),
          })
        );
      }
      return results;
    }

    case 'terminate_lease': {
      const current = await getLeaseEndDate(pathParams.id, ctx.organizationId);
      if (!current) throw new HttpError(404, '租约不存在');
      return createLeaseSettlement({
        leaseId: pathParams.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        input: {
          type: validatedBody.type as 'EXPIRED' | 'NEGOTIATED' | 'BREACH',
          reason: validatedBody.reason as string | undefined,
          terminatedAt: validatedBody.terminatedAt
            ? new Date(validatedBody.terminatedAt as string)
            : new Date(),
          rentAdjustmentAmount: Number(validatedBody.rentAdjustmentAmount ?? 0),
          currentWater: Number(validatedBody.currentWater),
          currentPower: Number(validatedBody.currentPower),
          otherFeeAmount: Number(validatedBody.otherFeeAmount ?? 0),
          otherFeeReason: validatedBody.otherFeeReason as string | undefined,
          penaltyAmount: Number(validatedBody.penaltyAmount ?? 0),
          penaltyReason: validatedBody.penaltyReason as string | undefined,
          compensationAmount: Number(validatedBody.compensationAmount ?? 0),
          compensationReason: validatedBody.compensationReason as
            | string
            | undefined,
          roomDepositRefundAmount: Number(
            validatedBody.roomDepositRefundAmount ?? 0
          ),
          keyDepositRefundAmount: Number(
            validatedBody.keyDepositRefundAmount ?? 0
          ),
          roomDepositDeductionAmount: Number(
            validatedBody.roomDepositDeductionAmount ?? 0
          ),
          keyDepositDeductionAmount: Number(
            validatedBody.keyDepositDeductionAmount ?? 0
          ),
          depositDeductionReason: validatedBody.depositDeductionReason as
            | string
            | undefined,
        },
      });
    }

    case 'record_settlement_payment': {
      return recordSettlementPayment({
        settlementId: pathParams.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        direction: validatedBody.direction as 'RECEIVE' | 'REFUND',
        amount: new Prisma.Decimal(Number(validatedBody.amount)),
        method: validatedBody.method as string,
        note: validatedBody.note as string | undefined,
      });
    }

    // --- 公寓管理（补充） ---
    case 'update_apartment': {
      await ensureApartmentInOrg(pathParams.id, ctx.organizationId);
      return updateApartment(pathParams.id, ctx.organizationId, {
        name: validatedBody.name as string | undefined,
        location: validatedBody.location as string | undefined,
      });
    }

    case 'delete_apartment': {
      await ensureApartmentInOrg(pathParams.id, ctx.organizationId);
      const activeCount = await countActiveLeasesInApartment(
        pathParams.id,
        ctx.organizationId
      );
      if (activeCount > 0)
        throw new HttpError(400, '公寓存在活跃租约，无法删除');
      return deleteApartment(pathParams.id);
    }

    case 'delete_room': {
      await ensureRoomInOrg(pathParams.roomId, ctx.organizationId);
      const activeCount = await countActiveLeasesInRoom(
        pathParams.roomId,
        ctx.organizationId
      );
      if (activeCount > 0)
        throw new HttpError(400, '房间存在活跃租约，无法删除');
      return deleteRoom(pathParams.roomId);
    }

    // --- 账单管理（补充） ---
    case 'query_bill_detail': {
      const bill = await getBillById(pathParams.id, ctx.organizationId);
      if (!bill) return null;
      return {
        id: bill.id,
        tenantName: bill.lease.tenantName,
        roomNo: bill.lease.room.roomNo,
        billingDate: formatDate(bill.billingDate),
        ...getBillPeriod(bill),
        dueDate: formatDate(bill.dueDate),
        totalAmount: Number(bill.totalAmount),
        paidAmount: Number(bill.paidAmount),
        remainingAmount: Number(
          (Number(bill.totalAmount) - Number(bill.paidAmount)).toFixed(2)
        ),
        status: bill.status,
        mode: bill.mode,
        note: bill.note,
        failureReason: bill.failureReason,
        items: bill.items.map((item) => ({
          type: item.type,
          name: item.name,
          amount: Number(item.amount),
          status: item.status,
          previousWater: item.previousWater ? Number(item.previousWater) : null,
          currentWater: item.currentWater ? Number(item.currentWater) : null,
          previousPower: item.previousPower ? Number(item.previousPower) : null,
          currentPower: item.currentPower ? Number(item.currentPower) : null,
        })),
        payments: bill.payments.map((p) => ({
          id: p.id,
          type: p.type,
          amount: Number(p.amount),
          method: p.method,
          status: p.status,
          note: p.note,
          paidAt: p.paidAt.toISOString().split('T')[0],
        })),
      };
    }

    case 'delete_bill': {
      const bill = await getBillById(pathParams.id, ctx.organizationId);
      if (!bill) throw new HttpError(404, '账单不存在');
      assertBillOperation(bill.status, 'delete');
      await deleteBillWithPayments(pathParams.id);
      return { deleted: true };
    }

    case 'void_bill': {
      return voidBill(pathParams.id, ctx.organizationId);
    }

    case 'retry_billing': {
      const bill = await getBillForRetry(pathParams.id, ctx.organizationId);
      if (!bill) throw new HttpError(404, '账单不存在');
      return retryPostpaidBillAndMonthlyBill(pathParams.id);
    }

    case 'export_utility_pending': {
      const bills = await findPendingPostpaidBillsForExport(ctx.organizationId);
      const header =
        'billId,房间号,租客,交租日,水电周期开始,水电周期结束,上月水表,本月水表,上月电表,本月电表,失败原因';
      const rows = bills.map((b) => {
        const waterItem = b.items.find((i) => i.type === 'WATER');
        const powerItem = b.items.find((i) => i.type === 'POWER');
        return [
          b.id,
          b.lease.room.roomNo,
          b.lease.tenantName,
          formatDate(b.billingDate),
          waterItem ? formatDate(waterItem.periodStart) : '',
          waterItem ? formatDate(waterItem.periodEnd) : '',
          waterItem?.previousWater ?? '',
          waterItem?.currentWater ?? '',
          powerItem?.previousPower ?? '',
          powerItem?.currentPower ?? '',
          b.failureReason ?? '',
        ].join(',');
      });
      return { csv: [header, ...rows].join('\n') };
    }

    // --- 租赁管理（补充） ---
    case 'update_lease': {
      const lease = await getLeaseById(pathParams.id, ctx.organizationId);
      if (!lease) throw new HttpError(404, '租约不存在');
      if (lease.status !== 'ACTIVE')
        throw new HttpError(400, '仅有效租约可以变更');

      const leaseData: Record<string, unknown> = {};
      if (validatedBody.rentAmount !== undefined)
        leaseData.rentAmount = new Prisma.Decimal(
          Number(validatedBody.rentAmount)
        );
      if (validatedBody.roomDepositAmount !== undefined)
        leaseData.roomDepositAmount = new Prisma.Decimal(
          Number(validatedBody.roomDepositAmount)
        );
      if (validatedBody.keyQuantity !== undefined)
        leaseData.keyQuantity = Number(validatedBody.keyQuantity);
      if (validatedBody.keyUnitPrice !== undefined)
        leaseData.keyUnitPrice = new Prisma.Decimal(
          Number(validatedBody.keyUnitPrice)
        );
      if (validatedBody.waterUnitPrice !== undefined)
        leaseData.waterUnitPrice = new Prisma.Decimal(
          Number(validatedBody.waterUnitPrice)
        );
      if (validatedBody.powerUnitPrice !== undefined)
        leaseData.powerUnitPrice = new Prisma.Decimal(
          Number(validatedBody.powerUnitPrice)
        );

      return updateLease(pathParams.id, {
        leaseData: leaseData as Parameters<typeof updateLease>[1]['leaseData'],
      });
    }

    case 'activate_lease': {
      const lease = await getLeaseWithFees(pathParams.id, ctx.organizationId);
      if (!lease) throw new HttpError(404, '租约不存在');
      if (lease.status !== 'DRAFT')
        throw new HttpError(400, '仅草稿状态的租约可以激活');

      const room = await findRoomById(lease.roomId, ctx.organizationId);
      if (!room) throw new HttpError(404, '房间不存在');
      if (room.status !== 'VACANT' && room.status !== 'RESERVED') {
        throw new HttpError(400, '房间已被占用，无法激活租约');
      }

      await activateLease({
        leaseId: pathParams.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      });
      await updateRoomStatus(lease.roomId, 'OCCUPIED');
      return generateLeaseBills(pathParams.id, new Date(), {
        onlyCurrentPeriod: false,
      });
    }

    case 'preview_settlement': {
      const terminatedAt = validatedBody.terminatedAt
        ? new Date(validatedBody.terminatedAt as string)
        : new Date();
      const preview = await getLeaseSettlementPreview({
        leaseId: pathParams.id,
        organizationId: ctx.organizationId,
        terminatedAt,
      });
      return {
        previousWater: Number(preview.previousWater),
        previousPower: Number(preview.previousPower),
      };
    }

    // --- 收支管理（补充） ---
    case 'query_transaction_categories': {
      return Object.entries(TRANSACTION_CATEGORIES).map(([key, val]) => ({
        key,
        label: val.label,
        type: val.type,
      }));
    }

    case 'query_transaction_detail': {
      const tx = await getTransactionById(pathParams.id, ctx.organizationId);
      if (!tx) return null;
      return {
        id: tx.id,
        type: tx.type,
        category: tx.category,
        categoryLabel: getCategoryLabel(tx.category),
        amount: Number(tx.amount),
        method: tx.method,
        description: tx.description,
        sourceType: tx.sourceType,
        occurredAt: tx.occurredAt.toISOString().split('T')[0],
        note: tx.note,
        apartmentName: tx.apartment?.name ?? null,
        tenantName: tx.lease?.tenantName ?? null,
        roomNo: tx.lease?.room?.roomNo ?? null,
        operatorName: tx.operator?.username ?? null,
        bill: tx.bill
          ? {
              id: tx.bill.id,
              mode: tx.bill.mode,
              status: tx.bill.status,
            }
          : null,
      };
    }

    case 'delete_transaction': {
      const result = await deleteTransaction(pathParams.id, ctx.organizationId);
      if (!result) throw new HttpError(404, '收支记录不存在');
      return { deleted: true };
    }

    // --- 押金管理（补充） ---
    case 'query_deposit_detail': {
      const deposit = await prisma.deposit.findFirst({
        where: { id: pathParams.id, organizationId: ctx.organizationId },
        include: {
          lease: { include: { room: { include: { apartment: true } } } },
          bill: {
            include: {
              payments: { include: { user: { select: { username: true } } } },
            },
          },
        },
      });
      if (!deposit) return null;

      const depositBills = await prisma.bill.findMany({
        where: { leaseId: deposit.leaseId, mode: 'DEPOSIT', deletedAt: null },
        include: {
          payments: { include: { user: { select: { username: true } } } },
        },
      });

      return {
        id: deposit.id,
        tenantName: deposit.lease.tenantName,
        roomNo: deposit.lease.room.roomNo,
        apartmentName: deposit.lease.room.apartment.name,
        type: deposit.type,
        amount: Number(deposit.amount),
        paidAmount: Number(deposit.paidAmount),
        refundedAmount: Number(deposit.refundedAmount),
        deductedAmount: Number(deposit.deductedAmount),
        status: deposit.status,
        createdAt: deposit.createdAt.toISOString().split('T')[0],
        bill: deposit.bill
          ? {
              id: deposit.bill.id,
              status: deposit.bill.status,
              totalAmount: Number(deposit.bill.totalAmount),
              paidAmount: Number(deposit.bill.paidAmount),
              payments: deposit.bill.payments.map((p) => ({
                id: p.id,
                type: p.type,
                amount: Number(p.amount),
                method: p.method,
                note: p.note,
                paidAt: p.paidAt.toISOString().split('T')[0],
                recordedBy: p.user.username,
              })),
            }
          : null,
        depositBills: depositBills.map((b) => ({
          id: b.id,
          status: b.status,
          depositType: b.depositType,
          totalAmount: Number(b.totalAmount),
          paidAmount: Number(b.paidAmount),
          payments: b.payments.map((p) => ({
            id: p.id,
            type: p.type,
            amount: Number(p.amount),
            method: p.method,
            note: p.note,
            paidAt: p.paidAt.toISOString().split('T')[0],
            recordedBy: p.user.username,
          })),
        })),
      };
    }

    case 'record_deposit_payment': {
      return recordDepositPayment({
        depositId: pathParams.id,
        userId: ctx.userId,
        type: validatedBody.type as 'COLLECT' | 'REFUND' | 'DEDUCT',
        amount: new Prisma.Decimal(Number(validatedBody.amount)),
        method: validatedBody.method as string,
        note: validatedBody.note as string | undefined,
      });
    }

    // --- 上游合同管理 ---
    case 'create_apartment_contract': {
      await ensureApartmentInOrg(pathParams.id, ctx.organizationId);
      const existing = await prisma.apartmentContract.findUnique({
        where: { apartmentId: pathParams.id },
      });
      if (existing) throw new HttpError(409, '该公寓已存在上游合同');
      return prisma.apartmentContract.create({
        data: {
          apartmentId: pathParams.id,
          organizationId: ctx.organizationId,
          landlordName: validatedBody.landlordName as string | undefined,
          landlordPhone: validatedBody.landlordPhone as string | undefined,
          contractStart: validatedBody.contractStart
            ? new Date(validatedBody.contractStart as string)
            : undefined,
          contractEnd: validatedBody.contractEnd
            ? new Date(validatedBody.contractEnd as string)
            : undefined,
          rentAmount:
            validatedBody.rentAmount != null
              ? new Prisma.Decimal(Number(validatedBody.rentAmount))
              : undefined,
          floors: validatedBody.floors as number | undefined,
          landArea:
            validatedBody.landArea != null
              ? new Prisma.Decimal(Number(validatedBody.landArea))
              : undefined,
          totalArea:
            validatedBody.totalArea != null
              ? new Prisma.Decimal(Number(validatedBody.totalArea))
              : undefined,
        },
      });
    }

    case 'update_apartment_contract': {
      await ensureApartmentInOrg(pathParams.id, ctx.organizationId);
      const existing = await prisma.apartmentContract.findUnique({
        where: { apartmentId: pathParams.id },
      });
      if (!existing) throw new HttpError(404, '上游合同不存在');
      const updateData: Record<string, unknown> = {};
      if (validatedBody.landlordName !== undefined)
        updateData.landlordName = validatedBody.landlordName;
      if (validatedBody.landlordPhone !== undefined)
        updateData.landlordPhone = validatedBody.landlordPhone;
      if (validatedBody.contractStart !== undefined)
        updateData.contractStart = new Date(
          validatedBody.contractStart as string
        );
      if (validatedBody.contractEnd !== undefined)
        updateData.contractEnd = new Date(validatedBody.contractEnd as string);
      if (validatedBody.rentAmount !== undefined)
        updateData.rentAmount = new Prisma.Decimal(
          Number(validatedBody.rentAmount)
        );
      if (validatedBody.floors !== undefined)
        updateData.floors = validatedBody.floors;
      if (validatedBody.landArea !== undefined)
        updateData.landArea = new Prisma.Decimal(
          Number(validatedBody.landArea)
        );
      if (validatedBody.totalArea !== undefined)
        updateData.totalArea = new Prisma.Decimal(
          Number(validatedBody.totalArea)
        );
      return prisma.apartmentContract.update({
        where: { apartmentId: pathParams.id },
        data: updateData,
      });
    }

    case 'delete_apartment_contract': {
      await ensureApartmentInOrg(pathParams.id, ctx.organizationId);
      const existing = await prisma.apartmentContract.findUnique({
        where: { apartmentId: pathParams.id },
      });
      if (!existing) throw new HttpError(404, '上游合同不存在');
      return prisma.apartmentContract.delete({
        where: { apartmentId: pathParams.id },
      });
    }

    // --- 预定管理（补充） ---
    case 'delete_reservation': {
      const room = await findRoomForReservation(
        pathParams.roomId,
        ctx.organizationId
      );
      if (!room) throw new HttpError(404, '房间不存在');
      const reservation = await getReservationByRoomId(pathParams.roomId);
      if (!reservation) throw new HttpError(404, '该房间没有预留记录');
      await deleteReservation(pathParams.roomId);
      return { deleted: true };
    }

    default:
      throw new HttpError(400, `未实现的操作：${item.name}`);
  }
}
