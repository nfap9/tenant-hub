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
} from '../services/apartment.js';
import {
  createMeterReading,
  findRoomForMeterReading,
  findLeaseForMeterReading,
  findPendingPostpaidBillsByRoom,
  applyUtilityReadingToBill,
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
} from '../services/reservation.js';
import {
  retryPostpaidBillAndMonthlyBill,
  generateCurrentLeaseBills,
  generateLeaseBills,
} from '../services/billing.js';
import {
  createLeaseSettlement,
  recordSettlementPayment,
} from '../services/leaseSettlement.js';
import { getLeaseEndDate } from '../services/lease.js';
import { parseUtilityImportRows } from '../services/utilityImport.js';
import { listApartmentsRaw, listRoomsRaw, getRoomByIdRaw } from '../services/apartment.js';
import { listBillsRaw, listMeterReadingsRaw } from '../services/bill.js';
import { listLeasesRaw, listLeaseSettlementsRaw } from '../services/lease.js';
import { listTransactionsRaw, getTransactionSummaryRaw } from '../services/transaction.js';
import { findReservationByRoomIdRaw } from '../services/reservation.js';
import { getCategoryLabel } from '../services/transactionCategories.js';
import { calculateDepositSummary } from '../services/depositUtils.js';
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
              rentAmount: contract.rentAmount ? Number(contract.rentAmount) : null,
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
        status: validatedBody.status as 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'SELF_USE' | undefined,
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
          lease: { roomId: pathParams.roomId, organizationId: ctx.organizationId },
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
              expectedMoveInDate: room.reservation.expectedMoveInDate.toISOString().split('T')[0],
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
                type: f.type, name: f.name, amount: Number(f.amount),
              })),
              deposits: activeLease.deposits.map((d) => ({
                type: d.type, amount: Number(d.amount),
                paidAmount: Number(d.paidAmount), status: d.status,
              })),
            }
          : null,
        currentMonthBills: currentBills.map((b) => ({
          id: b.id, status: b.status, totalAmount: Number(b.totalAmount), mode: b.mode,
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
        status: validatedBody.status as 'ACTIVE' | 'TERMINATED' | 'EXPIRED' | undefined,
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
        fees: l.fees.map((f) => ({ type: f.type, name: f.name, amount: Number(f.amount) })),
        deposits: l.deposits.map((d) => ({
          id: d.id, type: d.type, amount: Number(d.amount),
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
        status: validatedBody.status as 'BILLING' | 'UNPAID' | 'PAID' | 'REFUNDED' | 'VOID' | undefined,
        tenantName: validatedBody.tenantName as string | undefined,
        mode: validatedBody.mode as 'PREPAID' | 'POSTPAID' | 'DEPOSIT' | undefined,
        limit: validatedBody.limit as number | undefined,
      });
      return bills.map((b) => ({
        id: b.id,
        tenantName: b.lease.tenantName,
        roomNo: b.lease.room.roomNo,
        billingDate: b.billingDate.toISOString().split('T')[0],
        periodStart: b.periodStart.toISOString().split('T')[0],
        periodEnd: b.periodEnd.toISOString().split('T')[0],
        dueDate: b.dueDate.toISOString().split('T')[0],
        totalAmount: Number(b.totalAmount),
        paidAmount: Number(b.paidAmount),
        remainingAmount: Number((Number(b.totalAmount) - Number(b.paidAmount)).toFixed(2)),
        status: b.status,
        mode: b.mode,
        note: b.note,
        failureReason: b.failureReason,
        items: b.items.map((item) => ({
          type: item.type, name: item.name, amount: Number(item.amount), status: item.status,
          previousWater: item.previousWater ? Number(item.previousWater) : null,
          currentWater: item.currentWater ? Number(item.currentWater) : null,
          previousPower: item.previousPower ? Number(item.previousPower) : null,
          currentPower: item.currentPower ? Number(item.currentPower) : null,
        })),
        payments: b.payments.map((p) => ({
          id: p.id, type: p.type, amount: Number(p.amount), method: p.method,
          status: p.status, note: p.note,
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
          | 'BILL_PAYMENT' | 'DEPOSIT_PAYMENT' | 'SETTLEMENT_PAYMENT'
          | 'APARTMENT_EXPENSE' | 'RESERVATION' | 'MANUAL' | undefined,
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
      const byCategory: Record<string, { label: string; income: number; expense: number }> = {};
      for (const t of transactions) {
        const amount = Number(t.amount);
        if (t.type === 'INCOME') {
          totalIncome += amount;
        } else {
          totalExpense += amount;
        }
        if (!byCategory[t.category]) {
          byCategory[t.category] = { label: getCategoryLabel(t.category), income: 0, expense: 0 };
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
          category: key, label: val.label,
          income: Number(val.income.toFixed(2)),
          expense: Number(val.expense.toFixed(2)),
        })),
      };
    }

    case 'query_deposits': {
      const status = validatedBody.status as 'UNPAID' | 'PAID' | 'PARTIAL_REFUNDED' | 'FULLY_REFUNDED' | 'DEDUCTED' | undefined;
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
      const reservation = await findReservationByRoomIdRaw(pathParams.roomId, ctx.organizationId);
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
        expectedMoveInDate: reservation.expectedMoveInDate.toISOString().split('T')[0],
        createdAt: reservation.createdAt.toISOString().split('T')[0],
      };
    }

    case 'analytics_summary': {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [apartments, rooms, activeLeases, monthlyBills, allBills] = await Promise.all([
        listApartmentsRaw(ctx.organizationId),
        listRoomsRaw(ctx.organizationId),
        prisma.lease.count({
          where: { organizationId: ctx.organizationId, deletedAt: null, status: 'ACTIVE' },
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
        monthlyBills.filter((b) => b.status === 'PAID')
          .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;
      const totalBilled =
        allBills.reduce((sum, b) => sum + Number(b._sum.totalAmount || 0), 0) || 0;
      const totalPaid =
        allBills.filter((b) => b.status === 'PAID')
          .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;

      return {
        totalApartments,
        totalRooms,
        occupiedRooms,
        vacantRooms,
        occupancyRate: totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(2)) : 0,
        activeLeases,
        monthlyRentIncome: Number(monthlyRentIncome.toFixed(2)),
        unpaidBillsAmount: Number((totalBilled - totalPaid).toFixed(2)),
        paidBillsAmount: Number(totalPaid.toFixed(2)),
        collectionRate: totalBilled > 0 ? Number(((totalPaid / totalBilled) * 100).toFixed(2)) : 100,
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

    default:
      throw new HttpError(400, `未实现的操作：${item.name}`);
  }
}
