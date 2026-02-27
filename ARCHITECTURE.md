# Architecture Diagram

## System Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        Browser                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              React Components                          │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ EntriesPage                                      │  │    │
│  │  │  - QueryClientProvider                           │  │    │
│  │  │  - Create Entry Dialog                           │  │    │
│  │  │  - Entries Table (real-time updates)             │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  │                      ↕ useEntries()                    │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ TanStack Query                                   │  │    │
│  │  │  - Polling: every 2 seconds                      │  │    │
│  │  │  - Cache invalidation on mutation                │  │    │
│  │  │  - useCreateEntry() for mutations                │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  ↓ HTTP Fetch                                ↑ JSON Response   │
└────────────────────┬────────────────────────┬─────────────────-┘
                     │                        │
                     ↓                        │
        ┌────────────────────────┐            │
        │  Next.js Server        │            │
        │  (App Router)          │            │
        └────────────────────────┴────────────┘
              ↓ API Routes ↑
        ┌──────────────────────────┐
        │ POST /api/entries        │
        │ - Create entry           │
        │ - Trigger processEntry() │
        │ - Return 201             │
        └──────────────────────────┘
              ↓ Async ↑
        ┌──────────────────────────┐
        │ lib/worker.ts            │
        │ processEntry()           │
        │  ├─ claimLock()          │
        │  ├─ Process STAGE_1      │
        │  ├─ releaseLock()        │
        │  ├─ claimLock()          │
        │  ├─ Process STAGE_2      │
        │  └─ releaseLock()        │
        │  ├─ claimLock()          │
        │  ├─ Mark COMPLETED       │
        │  └─ releaseLock()        │
        └──────────────────────────┘
              ↓ Query/Update ↑
        ┌──────────────────────────┐
        │ Prisma Client (lib/db)   │
        │ - SQL Query Generation   │
        │ - Type Safety            │
        │ - Connection Pooling     │
        └──────────────────────────┘
              ↓ TCP/IP ↑
        ┌──────────────────────────┐
        │   PostgreSQL Database    │
        │                          │
        │  Entry Table:            │
        │  ├─ id                   │
        │  ├─ title                │
        │  ├─ status               │
        │  ├─ progress             │
        │  ├─ result               │
        │  ├─ lockedBy             │
        │  ├─ lockedAt             │
        │  └─ timestamps           │
        │                          │
        │  Indexes:                │
        │  ├─ PRIMARY(id)          │
        │  └─ (status, lockedAt)   │
        └──────────────────────────┘
```

## Request-Response Flow

### Create Entry Flow

```
User Input
  │
  ├─→ Dialog Component
  │    │
  │    └─→ useCreateEntry() mutation
  │         │
  │         └─→ POST /api/entries
  │              │
  │              └─→ API Route Handler
  │                   │
  │                   ├─→ Validate input
  │                   │
  │                   ├─→ Prisma Create Entry
  │                   │    │
  │                   │    └─→ INSERT INTO "Entry"
  │                   │         └─→ PostgreSQL
  │                   │
  │                   ├─→ Trigger processEntry() (non-blocking)
  │                   │
  │                   └─→ Return Entry (201)
  │
  ├─→ Toast: "Created successfully"
  │
  └─→ TanStack Query invalidates cache
       │
       └─→ Auto-refetch happens next poll
```

### Background Processing Flow

```
processEntry(entryId)
  │
  ├─→ STAGE 1
  │    │
  │    ├─→ claimLock()
  │    │    │
  │    │    └─→ UPDATE Entry SET lockedBy = 'worker'
  │    │         WHERE id = X AND lockedBy IS NULL
  │    │
  │    ├─→ delay(2000) // Simulate work
  │    │
  │    ├─→ UPDATE Entry SET status = STAGE_1, progress = 33
  │    │    WHERE id = X AND lockedBy = 'worker'
  │    │
  │    └─→ releaseLock()
  │         │
  │         └─→ UPDATE Entry SET lockedBy = NULL, lockedAt = NULL
  │
  ├─→ STAGE 2
  │    │
  │    ├─→ claimLock() // Lock queue: safe concurrent access
  │    │
  │    ├─→ delay(2000)
  │    │
  │    ├─→ UPDATE Entry SET status = STAGE_2, progress = 66
  │    │
  │    └─→ releaseLock()
  │
  ├─→ STAGE 3 (COMPLETED)
  │    │
  │    ├─→ claimLock()
  │    │
  │    ├─→ delay(2000)
  │    │
  │    ├─→ UPDATE Entry SET status = COMPLETED, progress = 100
  │    │    SET result = "Processed at {timestamp}"
  │    │
  │    └─→ releaseLock()
  │
  └─→ Done! Next 2s poll picks up updates
```

### Live Update Flow

```
TanStack Query (2s interval)
  │
  ├─→ GET /api/entries
  │    │
  │    └─→ API Route Handler
  │         │
  │         ├─→ Prisma findMany()
  │         │    │
  │         │    └─→ SELECT * FROM "Entry" ORDER BY createdAt DESC
  │         │         └─→ PostgreSQL
  │         │
  │         └─→ Return { entries: [...], total, limit, offset }
  │
  ├─→ Update Query Cache
  │    │
  │    ├─→ Previous data: STAGE_1, 33%
  │    │
  │    └─→ New data: STAGE_2, 66%
  │
  └─→ React Re-render
       │
       ├─→ Progress bar: 33% → 66%
       │
       ├─→ Badge: "Processing Stage 1" → "Processing Stage 2"
       │
       └─→ Result: (empty) → (updated if completed)
```

## Concurrency Control: Atomic Locking

### Lock Acquisition (Atomic)

```
Before:
┌──────────────────────────────────────┐
│ Entry                                │
├─────────────────┬────────────────────┤
│ id    │ status  │ lockedBy │ lockedAt │
├───────┼─────────┼──────────┼──────────┤
│ abc-1 │ CREATED │ NULL     │ NULL     │
└───────┴─────────┴──────────┴──────────┘

SQL:
UPDATE "Entry"
SET "lockedBy" = 'worker', "lockedAt" = NOW()
WHERE id = 'abc-1' AND "lockedBy" IS NULL

After (if successful):
┌──────────────────────────────────────┐
│ Entry                                │
├─────────────────┬────────────────────┤
│ id    │ status  │ lockedBy │ lockedAt │
├───────┼─────────┼──────────┼──────────┤
│ abc-1 │ CREATED │ worker   │ 2024-... │
└───────┴─────────┴──────────┴──────────┘

Result: updateCount = 1 (success) or 0 (already locked)
```

### Lock Verification (Safe Update)

```
UPDATE "Entry"
SET status = 'STAGE_1', progress = 33
WHERE id = 'abc-1' AND "lockedBy" = 'worker'

Result:
- If locked by this worker: 1 row updated ✓
- If locked by other: 0 rows updated ✗
- Prevents concurrent stage progression
```

### Lock Expiry (After 2 minutes)

```
OLD LOCK:
│ id    │ lockedBy │ lockedAt    │
│ abc-1 │ worker   │ 2024-01-01T00:00:00Z │

NOW:
2024-01-01T00:02:01Z (2 minutes + 1 second later)

RECLAIM:
WHERE id = 'abc-1'
AND (lockedBy IS NULL OR lockedAt < NOW() - INTERVAL '2 minutes')

Result: Can claim again ✓
```

## Database Schema

```sql
CREATE TABLE "Entry" (
  "id"        TEXT PRIMARY KEY,
  "title"     TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'CREATED',
  "progress"  INTEGER NOT NULL DEFAULT 0,
  "result"    TEXT,
  "lockedBy"  TEXT,
  "lockedAt"  TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  CONSTRAINT status_check CHECK (
    status IN ('CREATED', 'STAGE_1', 'STAGE_2', 'COMPLETED', 'FAILED')
  )
);

CREATE INDEX idx_entry_status_locked_at ON "Entry" ("status", "lockedAt");
```

## Component Hierarchy

```
app/
└── entries/page.tsx (Client)
    └── QueryClientProvider
        │
        ├── Header
        │   └── "Async Workflow Demo"
        │
        ├── CreateEntryDialog
        │   ├── DialogTrigger (Button)
        │   ├── DialogContent
        │   │   ├── Title
        │   │   ├── Description
        │   │   └── Form
        │   │       ├── Input (title)
        │   │       └── Submit Button
        │   │
        │   └── Hook: useCreateEntry()
        │       └── useMutation()
        │
        ├── EntriesTable
        │   ├── Loading Skeleton
        │   │   └── 5 skeleton rows
        │   │
        │   ├── Empty State
        │   │   └── "No entries yet"
        │   │
        │   └── Table
        │       ├── Header Row
        │       │   ├── Title
        │       │   ├── Status
        │       │   ├── Progress
        │       │   ├── Result
        │       │   └── Created
        │       │
        │       └── Data Rows (map entries)
        │           ├── Title (truncated)
        │           ├── Badge (status)
        │           ├── Progress Bar + %
        │           ├── Result (truncated)
        │           └── Created (formatted)
        │
        └── Hook: useEntries()
            └── useQuery()
                └── refetchInterval: 2000ms
```

## State Flow Diagram

```
┌─────────────────────────────────────────┐
│  Server State (PostgreSQL)              │
│                                         │
│  Entry {                                │
│    id: "abc-123"                       │
│    title: "My Task"                    │
│    status: "STAGE_1"                   │
│    progress: 33                        │
│    result: null                        │
│    lockedBy: "worker"                  │
│    lockedAt: 2024-01-01T00:00:00Z     │
│  }                                      │
│                                         │
│  (Source of truth)                     │
└──────────────┬──────────────────────────┘
               │
               │ TanStack Query
               │ (Cached locally)
               │
               ├→ fetch every 2s
               │
               └→ validate staleness
                 (always stale, refetch on interval)
                   │
                   ├→ compare new data
                   │
                   ├→ update cache
                   │
                   └→ trigger React re-render
                      │
                      ├─→ EntriesTable
                      │    ├─→ Progress: 33%
                      │    ├─→ Badge: "Processing Stage 1"
                      │    ├─→ Result: empty
                      │
                      ├─→ CreateEntryDialog
                      │    ├─→ Enabled: true
                      │
                      └─→ Browser Display
                           └─→ Visual updates
```

## Timing Diagram

```
Timeline (seconds)

0s   User clicks "Create Entry"
     │
     ├─→ Dialog opens
     │
2s   User submits title
     │
     ├─→ POST /api/entries
     │   ├─→ Entry created (CREATED, 0%)
     │   └─→ processEntry() triggered async
     │
     ├─→ Toast: "Created successfully"
     │
3s   TanStack Query first auto-poll
     │
     ├─→ GET /api/entries
     │   └─→ Still CREATED (worker not started yet)
     │
4s   Worker claims lock (STAGE_1 starts)
     │
     ├─→ delay(2000)
     │
6s   Worker releases lock, updates to STAGE_1 (33%)
     │
     ├─→ Next query sees: STAGE_1, 33%
     │
7s   TanStack Query auto-poll
     │
     ├─→ GET /api/entries
     │   └─→ STAGE_1, 33%
     │
     ├─→ EntriesTable updates
     │   ├─→ Progress bar: 33%
     │   └─→ Badge: "Processing Stage 1"
     │
8s   Worker claims lock (STAGE_2 starts)
     │
     ├─→ delay(2000)
     │
10s  Worker releases lock, updates to STAGE_2 (66%)
     │
11s  TanStack Query auto-poll
     │
     ├─→ STAGE_2, 66%
     │
12s  Worker claims lock (COMPLETED starts)
     │
     ├─→ delay(2000)
     │
14s  Worker releases lock, updates to COMPLETED (100%)
     │
15s  TanStack Query auto-poll
     │
     ├─→ COMPLETED, 100%
     │
     ├─→ Result: "Processed at 2024-01-01T00:00:14Z"
     │
     └─→ Workflow complete!
```

## Error Handling Flow

```
processEntry(id)
  │
  ├─→ TRY
  │   ├─→ claimLock() ✓
  │   ├─→ delay(2000) ✓
  │   ├─→ updateEntry() ✓
  │   ├─→ releaseLock() ✓
  │   │
  │   └─→ Success → Continue to next stage
  │
  └─→ CATCH (Error)
      │
      ├─→ Log error
      │
      ├─→ UPDATE Entry SET
      │    status = 'FAILED'
      │    result = 'Error: ...'
      │
      ├─→ Try to release lock
      │
      └─→ Stop processing
           │
           └─→ UI shows FAILED badge on next poll
```

## Deployment Architecture (Future)

```
┌─────────────────────────────────────┐
│ Vercel (Next.js App)                │
├─────────────────────────────────────┤
│                                     │
│  API Routes → Prisma Client         │
│  Worker Logic → Prisma Client       │
│                                     │
└────────┬────────────────────────────┘
         │ TCP/IP
         │ (connection pooling)
         │
┌────────┴────────────────────────────┐
│ PostgreSQL (e.g., Vercel Postgres)  │
├─────────────────────────────────────┤
│                                     │
│  Entry table with atomic locking    │
│  Connection pooling with PgBouncer  │
│                                     │
└─────────────────────────────────────┘
```

This architecture ensures:
- ✅ Atomic operations (no race conditions)
- ✅ Live updates (polling at 2s intervals)
- ✅ Scalable (single source of truth in DB)
- ✅ Resilient (lock expiry prevents deadlocks)
- ✅ Type-safe (Prisma generated types)
