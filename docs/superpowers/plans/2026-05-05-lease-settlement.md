# Lease Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add termination settlement with deposit refund, manual rent adjustment, move-out utilities, other fees, net receivable/refundable amount, and settlement payment/refund records.

**Architecture:** Add Prisma settlement tables, a focused backend settlement service for calculations and persistence, lease routes for creating settlements and recording payments, then update the mobile room termination modal to submit settlement inputs. Existing bill/monthly bill behavior remains unchanged.

**Tech Stack:** Express, Prisma, PostgreSQL, TypeScript, React Native/Expo Web.

---

### Task 1: Settlement Calculation Service

**Files:**
- Create: `apps/api/src/services/leaseSettlement.ts`
- Create: `apps/api/src/services/leaseSettlement.test.ts`
- Modify: `apps/api/package.json`

- [ ] Write tests for net amount, deposit deduction, rent refund, utility validation, and settlement direction.
- [ ] Implement pure calculation helpers.
- [ ] Add the new test file to API `test` script.

### Task 2: Database Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260505152000_lease_settlements/migration.sql`

- [ ] Add `SettlementStatus` and `SettlementPaymentDirection` enums.
- [ ] Add `LeaseSettlement` and `SettlementPayment` models.
- [ ] Add relations from `Lease`, `Room`, `Organization`, and `User`.
- [ ] Validate Prisma schema and regenerate client.

### Task 3: Backend Routes

**Files:**
- Modify: `apps/api/src/routes/leases.ts`
- Modify: `apps/api/src/services/leaseSettlement.ts`

- [ ] Implement settlement creation from a lease.
- [ ] Implement settlement payment/refund recording.
- [ ] Replace direct terminate behavior with settlement-backed termination.

### Task 4: Mobile UI

**Files:**
- Modify: `apps/mobile/src/types/domain.ts`
- Modify: `apps/mobile/src/types/index.ts`
- Modify: `apps/mobile/src/screens/rooms/RoomsScreen.tsx`

- [ ] Extend settlement types.
- [ ] Replace simple terminate modal with settlement inputs.
- [ ] Show calculated receivable/refundable net amount.
- [ ] Submit settlement payload to backend.

### Task 5: Verification

**Files:**
- No code files unless fixes are needed.

- [ ] Run `pnpm db:generate`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
