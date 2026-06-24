# Agent Service Layer Simplification

## Objective

Remove the `forAgent` intermediate service/mapper layer in the agent backend. All agent operations will call core service functions directly instead of going through a dedicated agent service layer.

## Motivation

The `forAgent` layer adds ~16 files and significant boilerplate without providing meaningful abstraction:

- **Query operations**: Each `forAgent` function is a 1-2 line wrapper that calls a `*Raw` service function then `.map()` through a dedicated mapper
- **Write operations**: Already calling core services directly — no `forAgent` layer involved

Removing this layer reduces code surface, eliminates duplication, and makes the architecture clearer.

## Current Architecture

```
Frontend
  → POST /api/agent/manifest-chat (SSE)
    → manifest-agent.ts (LLM loop)
      → api-executor.ts (switch dispatch)
        ├── 14 Query ops → forAgent service → mapper → *Raw core service → Prisma
        └── 18 Write ops → core service directly → Prisma
```

## Target Architecture

```
Frontend
  → POST /api/agent/manifest-chat (SSE)
    → manifest-agent.ts (LLM loop)
      → api-executor.ts (switch dispatch)
        ├── 14 Query ops → *Raw core service → inline mapping → Prisma
        └── 18 Write ops → core service directly → Prisma (unchanged)
```

## Changes

### Delete

| Path | Impact |
|------|--------|
| `apps/api/src/services/forAgent/` (7 files) | ~14 query wrapper functions |
| `apps/api/src/services/forAgent/mappers/` (9 files) | ~9 mapper functions + index.ts |
| `apps/api/src/agent/types.ts` (if types only used by deleted files) | Cleanup unused exported types |

### Modify

**`apps/api/src/agent/api-executor.ts`**: Replace 14 `forAgent` function calls with direct core service calls + inline data conversion. Each inline conversion mirrors what the mapper previously did — `Decimal` → `number`, field selection, nested relation flattening. The conversion logic is trivial (2-5 lines per operation) and more readable inline than in a separate file.

### Untouched

| Area | Reason |
|------|--------|
| Frontend (`apps/tenant-web/src/pages/agent/`) | No interface change |
| Agent routes (`apps/api/src/routes/agent.ts`) | No interface change |
| Agent core (`apps/api/src/agent/core/`) | No logic change |
| Agent manifest (`apps/api/src/agent/api-manifest.ts`) | No logic change |
| Write operations in executor | Already calling core services directly |
| DB schema / Prisma migrations | No schema change |

## Import Pattern After Change

Operations that currently call `forAgent` functions will import from the same service modules as write operations:

```ts
// Before
import { queryApartmentsForAgent } from '../../services/forAgent/apartment'

// After
import { listApartmentsRaw } from '../../services/apartment'
```

## Inline Mapping Example

```ts
// Before (separate mapper file)
case 'query_apartments':
  const result = await queryApartmentsForAgent(orgId, body)
  return { data: result }

// After (inline in executor)
case 'query_apartments':
  const data = await listApartmentsRaw(orgId, { ...body, includeRoomStats: true })
  return { data: data.map(a => ({
    id: a.id, name: a.name,
    totalRooms: Number(a.totalRooms), // Decimal → number
    occupiedRooms: Number(a.occupiedRooms),
    availableRooms: Number(a.availableRooms)
  }))}
```

## Mapping Summary per Operation

| Operation Name | Core Service Function | Inline Mapping Notes |
|---|---|---|
| `query_apartments` | `listApartmentsRaw` | Flat + room stats, Decimal→Number |
| `query_apartment_contract` | `prisma.apartment.findFirst` + `prisma.apartmentContract.findUnique` | Join apartment + contract inline |
| `query_rooms` | `listRoomsRaw` | Select & flatten fields |
| `query_room_detail` | `getRoomByIdRaw` + `prisma.bill.findMany` | Multi-query replacement |
| `query_leases` | `listLeasesRaw` | Lease summary fields |
| `query_settlements` | `listLeaseSettlementsRaw` | Settlement fields |
| `query_bills` | `listBillsRaw` | Bill summary fields |
| `query_meter_readings` | `listMeterReadingsRaw` | Meter reading fields |
| `query_transactions` | `listTransactionsRaw` | Transaction fields |
| `query_transaction_summary` | `getTransactionSummaryRaw` | Aggregation inline |
| `query_deposits` | `prisma.deposit.findMany` | (No *Raw exists) |
| `query_deposit_summary` | `prisma.deposit.findMany` + `calculateDepositSummary` | (No *Raw exists) |
| `query_reservation` | `findReservationByRoomIdRaw` | Reservation fields |
| `analytics_summary` | `listApartmentsRaw` + `listRoomsRaw` + `prisma.lease.count` + `prisma.bill.groupBy` | Multi-query aggregation |

## No Behavior Change

- All data flows through the same Prisma queries with the same filters
- All returned data has the same shape — inline mapping produces identical JSON structure
- All write operations are completely unaffected
- Frontend agent UI receives identical response chunks
