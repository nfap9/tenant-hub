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
import {
  queryApartmentsForAgent,
  queryRoomsForAgent,
  queryRoomDetailForAgent,
  queryApartmentContractForAgent,
} from '../services/forAgent/apartment.js';
import {
  queryBillsForAgent,
  queryMeterReadingsForAgent,
} from '../services/forAgent/bill.js';
import {
  queryLeasesForAgent,
  querySettlementsForAgent,
} from '../services/forAgent/lease.js';
import {
  queryDepositsForAgent,
  queryDepositSummaryForAgent,
} from '../services/forAgent/deposit.js';
import {
  queryTransactionsForAgent,
  queryTransactionSummaryForAgent,
} from '../services/forAgent/transaction.js';
import { queryReservationForAgent } from '../services/forAgent/reservation.js';
import { getAnalyticsSummaryForAgent } from '../services/forAgent/analytics.js';
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
      return queryApartmentsForAgent({
        organizationId: ctx.organizationId,
        keyword: validatedBody.keyword as string | undefined,
        limit: validatedBody.limit as number | undefined,
      });
    }

    case 'query_apartment_contract': {
      return queryApartmentContractForAgent({
        organizationId: ctx.organizationId,
        apartmentId: pathParams.id,
      });
    }

    case 'query_rooms': {
      return queryRoomsForAgent({
        organizationId: ctx.organizationId,
        apartmentId: validatedBody.apartmentId as string | undefined,
        status: validatedBody.status as
          | 'VACANT'
          | 'RESERVED'
          | 'OCCUPIED'
          | 'MAINTENANCE'
          | undefined,
        keyword: validatedBody.keyword as string | undefined,
        limit: validatedBody.limit as number | undefined,
      });
    }

    case 'query_room_detail': {
      return queryRoomDetailForAgent({
        organizationId: ctx.organizationId,
        roomId: pathParams.roomId,
      });
    }

    case 'query_leases': {
      return queryLeasesForAgent({
        organizationId: ctx.organizationId,
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
    }

    case 'query_settlements': {
      return querySettlementsForAgent({
        organizationId: ctx.organizationId,
        leaseId: validatedBody.leaseId as string | undefined,
        limit: validatedBody.limit as number | undefined,
      });
    }

    case 'query_bills': {
      return queryBillsForAgent({
        organizationId: ctx.organizationId,
        status: validatedBody.status as
          | 'DRAFT'
          | 'BILLING'
          | 'UNPAID'
          | 'PARTIAL_PAID'
          | 'PAID'
          | 'REFUNDED'
          | 'FAILED'
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
    }

    case 'query_meter_readings': {
      return queryMeterReadingsForAgent({
        organizationId: ctx.organizationId,
        roomId: validatedBody.roomId as string | undefined,
        meterType: validatedBody.meterType as 'WATER' | 'POWER' | undefined,
        limit: validatedBody.limit as number | undefined,
      });
    }

    case 'query_transactions': {
      return queryTransactionsForAgent({
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
    }

    case 'query_transaction_summary': {
      return queryTransactionSummaryForAgent({
        organizationId: ctx.organizationId,
        startDate: validatedBody.startDate as Date | undefined,
        endDate: validatedBody.endDate as Date | undefined,
      });
    }

    case 'query_deposits': {
      return queryDepositsForAgent({
        organizationId: ctx.organizationId,
        status: validatedBody.status as
          | 'UNPAID'
          | 'PAID'
          | 'PARTIAL_REFUNDED'
          | 'FULLY_REFUNDED'
          | 'DEDUCTED'
          | undefined,
        limit: validatedBody.limit as number | undefined,
      });
    }

    case 'query_deposit_summary': {
      return queryDepositSummaryForAgent(ctx.organizationId);
    }

    case 'query_reservation': {
      return queryReservationForAgent({
        organizationId: ctx.organizationId,
        roomId: pathParams.roomId,
      });
    }

    case 'analytics_summary': {
      return getAnalyticsSummaryForAgent(ctx.organizationId);
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
        status?: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
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
          | 'MAINTENANCE';
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
        tenantName: validatedBody.tenantName as string,
        tenantPhone: validatedBody.tenantPhone as string,
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
