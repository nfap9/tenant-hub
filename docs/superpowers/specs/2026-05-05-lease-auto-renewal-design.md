# Lease Auto Renewal Design

## Context

Tenant Hub already supports creating leases, terminating leases, marking rooms occupied or vacant, and generating rent bills from a lease cycle. The current model stores the core lease terms, optional lease fees, a termination type enum, and an `autoRenew` flag. The missing business behavior is treating an un-terminated lease as still active after the originally agreed end date.

## Business Rules

- A lease contains tenant information, room information, lease dates, payment grace days, rent cycle, utility prices, rent, deposit, auto-renewal preference, and optional fee items.
- The lease `startDate` is the payment day anchor. Bills are generated from this date by monthly, quarterly, or yearly cycle.
- `graceDays` means payment due date is `periodStart + graceDays`; payment during this window is not considered a breach.
- If `autoRenew` is enabled and the lease is still `ACTIVE` after `endDate`, the lease remains valid under the original rent, cycle, utility prices, and fee items.
- Auto-renewal does not create a second lease record. It is represented as derived state: `isAutoRenewalPeriod`.
- `isAutoRenewalPeriod` is true when `autoRenew=true`, `status=ACTIVE`, and today's date is after the original `endDate`.
- A tenant leaving on or after the original `endDate` is not a breach solely because the lease is past its original term.
- Contract termination has three scenarios:
  - `EXPIRED`: leaving on or after the original `endDate`.
  - `NEGOTIATED`: both sides agree to terminate.
  - `BREACH`: business explicitly marks the termination as a breach.

## API Design

### Create Lease

`POST /api/leases` accepts the existing lease terms plus:

- `graceDays`
- `autoRenew`
- optional fees

Validation:

- The room must belong to the current organization.
- The room must be vacant.
- `endDate` must be on or after `startDate`.
- Money and utility prices must be non-negative.
- Fee items must belong to the room apartment and be enabled.

After create:

- The room becomes `OCCUPIED`.
- Bills are generated for the lease.

### List Leases And Room Leases

Lease responses include:

- persisted lease fields
- `isAutoRenewalPeriod`

Room queries that include active leases also expose this derived field so the mobile room screen can show "自动续约中".

### Terminate Lease

`POST /api/leases/:id/terminate` accepts:

- `type`: `EXPIRED`, `NEGOTIATED`, or `BREACH`
- `reason`
- `terminatedAt`

Validation:

- The lease must belong to the current organization.
- `EXPIRED` requires `terminatedAt` to be on or after the original `endDate`.

After termination:

- The lease status becomes `TERMINATED`.
- Termination details are stored.
- The room becomes `VACANT`.

## Billing Design

Bill generation uses the lease cycle and the start date payment anchor.

- Non-auto-renew leases generate bills only through `endDate`.
- Auto-renew active leases generate bills through a rolling horizon beyond today, using original contract pricing.
- Terminated leases generate bills only through `terminatedAt`.
- Existing bill period starts are skipped so generation is idempotent.

The rolling horizon should be small and predictable. Generate through the current billing period plus one extra cycle so the next payable bill exists without creating years of future bills.

## Mobile Design

The room signing modal adds:

- payment grace days input
- auto-renew toggle

The occupied lease panel shows:

- tenant
- rent
- contract dates
- rent cycle
- payment grace days
- auto-renew status
- "自动续约中" when derived state is true

The termination action opens a small modal with:

- termination type selector
- termination date
- reason

For leases already after the original `endDate`, the recommended default type is `EXPIRED`; otherwise the default is `NEGOTIATED`.

## Testing

Backend tests should cover the billing boundary logic before implementation:

- non-auto-renew lease stops at `endDate`
- active auto-renew lease generates beyond `endDate`
- terminated auto-renew lease stops at `terminatedAt`
- derived auto-renewal state is true only after `endDate`
- expired termination before `endDate` is rejected

Mobile verification should cover TypeScript compilation and the signing/termination form payloads.
