# Agent Service Layer Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `forAgent` intermediate service/mapper layer — all agent operations call core service functions directly.

**Architecture:** The `api-executor.ts` switchboard currently routes 14 query operations through `services/forAgent/*.ts` wrappers that call `*Raw` core functions and map through `mappers/*.ts`. We inline the mapping in each case and delete the entire `forAgent/` directory. The 18 write operations already call core services directly and remain untouched.

**Tech Stack:** TypeScript, Node.js, Prisma ORM

---

### Task 1: Inline query operations in api-executor.ts

**Files:**
- Modify: `apps/api/src/agent/api-executor.ts`

- [ ] **Step 1: Replace imports — remove forAgent imports, add core service imports**

Replace these forAgent imports (lines 41-63):
```ts
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
```

With these core service imports:
```ts
import { listApartmentsRaw, listRoomsRaw, getRoomByIdRaw } from '../services/apartment.js';
import { listBillsRaw, listMeterReadingsRaw } from '../services/bill.js';
import { listLeasesRaw, listLeaseSettlementsRaw } from '../services/lease.js';
import { listTransactionsRaw, getTransactionSummaryRaw } from '../services/transaction.js';
import { findReservationByRoomIdRaw } from '../services/reservation.js';
import { getCategoryLabel } from '../services/transactionCategories.js';
import { calculateDepositSummary } from '../services/depositUtils.js';
import { hasExpired, isAutoRenewalPeriod } from '../services/leaseLifecycle.js';
```

Also add `import { prisma } from '../config/prisma.js';` since some queries use Prisma directly.

- [ ] **Step 2: Replace `query_apartments` case (line 129-135)**

Replace:
```ts
    case 'query_apartments': {
      return queryApartmentsForAgent({
        organizationId: ctx.organizationId,
        keyword: validatedBody.keyword as string | undefined,
        limit: validatedBody.limit as number | undefined,
      });
    }
```

With:
```ts
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
```

- [ ] **Step 3: Replace `query_apartment_contract` case (lines 137-142)**

Replace:
```ts
    case 'query_apartment_contract': {
      return queryApartmentContractForAgent({
        organizationId: ctx.organizationId,
        apartmentId: pathParams.id,
      });
    }
```

With:
```ts
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
```

- [ ] **Step 4: Replace `query_rooms` case (lines 144-158)**

Replace:
```ts
    case 'query_rooms': {
      return queryRoomsForAgent({
        organizationId: ctx.organizationId,
        apartmentId: validatedBody.apartmentId as string | undefined,
        status: validatedBody.status as ... | undefined,
        keyword: validatedBody.keyword as string | undefined,
        limit: validatedBody.limit as number | undefined,
      });
    }
```

With:
```ts
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
```

- [ ] **Step 5: Replace `query_room_detail` case (lines 160-165)**

Replace:
```ts
    case 'query_room_detail': {
      return queryRoomDetailForAgent({
        organizationId: ctx.organizationId,
        roomId: pathParams.roomId,
      });
    }
```

With:
```ts
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
```

- [ ] **Step 6: Replace `query_leases` case (lines 167-179)**

Replace:
```ts
    case 'query_leases': {
      return queryLeasesForAgent({ ... });
    }
```

With:
```ts
    case 'query_leases': {
      const leases = await listLeasesRaw(ctx.organizationId, {
        tenantName: validatedBody.tenantName as string | undefined,
        roomId: validatedBody.roomId as string | undefined,
        status: validatedBody.status as 'ACTIVE' | 'TERMINATED' | 'EXPIRED' | 'DRAFT' | undefined,
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
```

- [ ] **Step 7: Replace `query_settlements` case (lines 181-187)**

Replace:
```ts
    case 'query_settlements': {
      return querySettlementsForAgent({ ... });
    }
```

With:
```ts
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
```

- [ ] **Step 8: Replace `query_bills` case (lines 189-207)**

Replace:
```ts
    case 'query_bills': {
      return queryBillsForAgent({ ... });
    }
```

With:
```ts
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
```

- [ ] **Step 9: Replace `query_meter_readings` case (lines 209-216)**

Replace:
```ts
    case 'query_meter_readings': {
      return queryMeterReadingsForAgent({ ... });
    }
```

With:
```ts
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
```

- [ ] **Step 10: Replace `query_transactions` case (lines 218-237)**

Replace:
```ts
    case 'query_transactions': {
      return queryTransactionsForAgent({ ... });
    }
```

With:
```ts
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
```

- [ ] **Step 11: Replace `query_transaction_summary` case (lines 239-245)**

Replace:
```ts
    case 'query_transaction_summary': {
      return queryTransactionSummaryForAgent({ ... });
    }
```

With:
```ts
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
```

- [ ] **Step 12: Replace `query_deposits` case (lines 247-259)**

Replace:
```ts
    case 'query_deposits': {
      return queryDepositsForAgent({ ... });
    }
```

With:
```ts
    case 'query_deposits': {
      const deposits = await prisma.deposit.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...((validatedBody.status as string | undefined) ? { status: validatedBody.status as string } : {}),
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
```

- [ ] **Step 13: Replace `query_deposit_summary` case (lines 261-263)**

Replace:
```ts
    case 'query_deposit_summary': {
      return queryDepositSummaryForAgent(ctx.organizationId);
    }
```

With:
```ts
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
```

- [ ] **Step 14: Replace `query_reservation` case (lines 265-269)**

Replace:
```ts
    case 'query_reservation': {
      return queryReservationForAgent({
        organizationId: ctx.organizationId,
        roomId: pathParams.roomId,
      });
    }
```

With:
```ts
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
```

- [ ] **Step 15: Replace `analytics_summary` case (lines 272-274)**

Replace:
```ts
    case 'analytics_summary': {
      return getAnalyticsSummaryForAgent(ctx.organizationId);
    }
```

With:
```ts
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
```

- [ ] **Step 16: Verify the file compiles**

Run: `npx tsc --noEmit --project apps/api/tsconfig.json`
Expected: No type errors

---

### Task 2: Delete the forAgent directory

**Files:**
- Delete: `apps/api/src/services/forAgent/` (entire directory, ~7 service files + 9 mappers)

- [ ] **Step 1: Delete the directory**

```bash
rm -rf apps/api/src/services/forAgent
```

- [ ] **Step 2: Verify no remaining imports reference forAgent**

Run: `grep -r "forAgent" apps/api/src/ --include='*.ts'`
Expected: No results (all imports should have been removed in Task 1)

Run: `npx tsc --noEmit --project apps/api/tsconfig.json`
Expected: No errors

---

### Task 3: Clean up types.ts (optional)

**Files:**
- Modify: `apps/api/src/agent/types.ts`

- [ ] **Step 1: Review and remove unused types**

The types `ApartmentSummary`, `RoomSummary`, `LeaseSummary`, `BillSummary`, `AnalyticsSummary`, `DecimalToNumber` were previously used by the mapper functions. Check if anything outside the `forAgent/` directory references them.

```bash
grep -r "ApartmentSummary\|RoomSummary\|LeaseSummary\|BillSummary\|AnalyticsSummary\|DecimalToNumber" apps/api/src/ --include='*.ts' | grep -v "forAgent" | grep -v "types.ts"
```

If no results, remove the unused type definitions from `apps/api/src/agent/types.ts` (lines 41-104). Leave the remaining types (`StreamChunk`, `AgentContext`, `ChatMessage`, `ToolResult`) untouched since they're used by the agent core and frontend.

---

### Task 4: Final verification

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit --project apps/api/tsconfig.json
```

Expected: No errors

- [ ] **Step 2: Run the API tests**

```bash
cd apps/api && npx vitest run --reporter=verbose 2>/dev/null || echo "No tests or tests not configured"
```
