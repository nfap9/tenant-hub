# Lease Auto Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement lease signing completeness, termination scenarios, and continuous auto-renewal behavior under original contract pricing.

**Architecture:** Add pure lease date helpers for derived auto-renewal state and bill generation boundaries, then use those helpers from billing and lease routes. Keep auto-renewal as derived state on the existing lease record rather than creating renewal rows.

**Tech Stack:** TypeScript, Express, Prisma, dayjs, React Native, Node assert tests run with `tsx`.

---

## File Structure

- Create `apps/api/src/services/leaseLifecycle.ts`: pure functions for cycle months, date normalization, auto-renewal state, billing generation end date, and response shaping.
- Create `apps/api/src/services/leaseLifecycle.test.ts`: lightweight Node assert tests for lifecycle boundaries.
- Modify `apps/api/src/services/billing.ts`: use lifecycle helpers to generate bills through contract end, termination date, or auto-renewal rolling horizon.
- Modify `apps/api/src/routes/leases.ts`: validate full lease payload, serialize derived fields, generate current bills on list, and validate termination scenarios.
- Modify `apps/api/src/routes/apartments.ts`: serialize active room leases with derived auto-renewal state and refresh auto-renew bills for occupied rooms.
- Modify `apps/mobile/src/types/domain.ts`: expose `graceDays`, `autoRenew`, `isAutoRenewalPeriod`, and termination type.
- Modify `apps/mobile/src/screens/rooms/RoomsScreen.tsx`: add signing inputs for grace days and auto-renewal, display auto-renewal state, and add termination scenario modal.

## Tasks

### Task 1: Lease Lifecycle Helpers

**Files:**
- Create: `apps/api/src/services/leaseLifecycle.ts`
- Create: `apps/api/src/services/leaseLifecycle.test.ts`

- [ ] Write failing tests for `isAutoRenewalPeriod`, `getLeaseBillGenerationEnd`, and `assertExpiredTerminationAllowed`.
- [ ] Run `pnpm --filter @tenant-hub/api exec tsx src/services/leaseLifecycle.test.ts` and verify it fails because the helper module does not exist.
- [ ] Implement the helper module with day-level comparisons.
- [ ] Re-run the test command and verify it passes.

### Task 2: Billing And API Behavior

**Files:**
- Modify: `apps/api/src/services/billing.ts`
- Modify: `apps/api/src/routes/leases.ts`
- Modify: `apps/api/src/routes/apartments.ts`

- [ ] Update `generateLeaseBills` to call `getLeaseBillGenerationEnd`.
- [ ] Add list-time bill refresh for active leases so auto-renewal bills continue to appear without a cron job.
- [ ] Add create validation for date order and non-negative amounts.
- [ ] Add `isAutoRenewalPeriod` to lease responses.
- [ ] Enforce that `EXPIRED` termination cannot happen before the original `endDate`.
- [ ] Run API typecheck and lifecycle tests.

### Task 3: Mobile Lease UI

**Files:**
- Modify: `apps/mobile/src/types/domain.ts`
- Modify: `apps/mobile/src/screens/rooms/RoomsScreen.tsx`

- [ ] Add domain types for termination type and auto-renewal fields.
- [ ] Add signing form state and controls for `graceDays` and `autoRenew`.
- [ ] Add lease detail display for rent cycle, grace days, auto-renewal, and "自动续约中".
- [ ] Replace direct退租 with a termination modal containing type, date, and reason.
- [ ] Run mobile typecheck.

### Task 4: Final Verification

**Files:**
- All changed files

- [ ] Run `pnpm --filter @tenant-hub/api exec tsx src/services/leaseLifecycle.test.ts`.
- [ ] Run `pnpm --filter @tenant-hub/api typecheck`.
- [ ] Run `pnpm --filter @tenant-hub/mobile typecheck`.
- [ ] Review `git diff` for unrelated changes.
