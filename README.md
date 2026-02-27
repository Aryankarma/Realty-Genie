# Async Workflow Processing System

A Next.js application that demonstrates background processing of async workflows with built-in concurrency control and atomic guarantees.

## Architecture Overview

### System Design

The system is built around a **3-stage workflow pipeline** where entries progress through defined states:

```
CREATED → STAGE_1 → STAGE_2 → COMPLETED
```

Each stage represents a distinct processing phase that can take time, fail, or be retried. The architecture uses:

- **Next.js App Router** for HTTP API and Server Components
- **Prisma ORM** for type-safe database access
- **PostgreSQL** as the persistent data store
- **React Query (TanStack Query)** for client-side data synchronization
- **shadcn/ui** for UI components

### Data Model

```
Entry {
  id: String (UUID)
  name: String
  status: CREATED | STAGE_1 | STAGE_2 | COMPLETED
  createdAt: DateTime
  updatedAt: DateTime
  lockedBy: String? (worker identifier)
  lockedAt: DateTime? (lock acquisition time)
  error: String? (last error message)
}
```

## Background Processing & Worker System

### How It Works

The application uses an **in-process worker** that polls the database for entries needing processing:

1. **Worker Loop**: Runs on the server at configurable intervals (default: 2s)
2. **Lock Claiming**: When processing an entry, the worker atomically claims a lock (`lockedBy` + `lockedAt`)
3. **Stage Progression**: Entries move through stages in sequence, with artificial delays simulating real work
4. **Lock Release**: After processing, the lock is released so other workers can claim entries

### Worker Flow

```typescript
// Worker processes entries in this sequence:
1. Query for entries with status CREATED and no active lock
2. Claim lock: UPDATE entry SET lockedBy=$id, lockedAt=NOW() WHERE id=$entryId AND lockedBy IS NULL
3. If lock succeeds, process the entry (simulate work with delay)
4. Update status to next stage
5. Release lock by setting lockedBy = null
6. Repeat for STAGE_1 → STAGE_2 and STAGE_2 → COMPLETED
```

### Processing Model

- **Asynchronous**: Work happens in the background without blocking user requests
- **Non-blocking API**: Create entries and immediately get confirmation
- **Status polling**: Frontend polls every 2 seconds to reflect progress
- **Error resilience**: Failed entries remain in the database for inspection and retry

## Consistency & Concurrency Management

### Atomic Locking Mechanism

The system prevents duplicate processing using **database-level atomicity**:

```sql
-- Only one worker can claim a lock at a time
UPDATE entries
SET lockedBy = $workerId, lockedAt = NOW()
WHERE id = $entryId 
  AND lockedBy IS NULL
  AND (lockedAt IS NULL OR lockedAt < NOW() - INTERVAL '5 minutes')
```

If the UPDATE returns 0 rows, the lock was already claimed. This ensures exactly-once processing per worker cycle.

### Lock Expiration (Dead Letter Handling)

Locks automatically expire after 5 minutes (`lockedAt < NOW() - INTERVAL '5 minutes'`). If a worker crashes mid-processing:

1. Its lock remains in the database with `lockedBy` set
2. After 5 minutes, other workers can claim the lock and resume
3. This provides automatic recovery without external coordination

### Race Condition Prevention

**Scenario**: Two workers see the same entry

```
Worker A                          Worker B
READ entry (status=CREATED)      READ entry (status=CREATED)
→ Try to claim lock               → Try to claim lock
✓ Success (lock acquired)        ✗ Fails (lock taken)
Process entry                     Skips, continues polling
UPDATE status → STAGE_1
Release lock
```

Both workers see the same entry, but only one successfully claims the lock and processes it.

### Consistency Guarantees

- **At-most-once**: Distributed locking prevents duplicate processing
- **Status monotonicity**: Entries only progress forward (CREATED → STAGE_1 → STAGE_2 → COMPLETED)
- **Transactional updates**: Status and lock changes happen atomically
- **Eventual consistency**: All workers converge on the same state over time

## API Endpoints

### GET /api/entries
Returns all entries with their current status and progress.

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "Example Task",
    "status": "STAGE_2",
    "progress": 66,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:02:00Z",
    "error": null
  }
]
```

### POST /api/entries
Creates a new entry in CREATED status.

**Body**:
```json
{
  "name": "Task Name"
}
```

**Response**: Returns the created entry object.

### PATCH /api/entries/:id
Manually advance an entry to the next stage (useful for testing).

**Body**:
```json
{
  "action": "advance"
}
```

## File Structure

```
├── app/
│   ├── layout.tsx              # Root layout with QueryClientProvider
│   ├── globals.css             # Tailwind & design tokens
│   └── page.tsx                # Main dashboard page
├── app/api/
│   ├── entries/
│   │   ├── route.ts            # GET /api/entries, POST /api/entries
│   │   └── [id]/
│   │       └── route.ts        # PATCH /api/entries/:id
│   └── worker/
│       └── route.ts            # GET /api/worker (trigger processing)
├── components/
│   ├── entries-table.tsx       # Display entries in table
│   ├── create-entry-dialog.tsx # Form to create new entries
│   └── progress-badge.tsx      # Status & progress display
├── hooks/
│   └── use-entries.ts          # React Query hook for entries
├── lib/
│   └── worker.ts               # Background processing logic
├── prisma/
│   └── schema.prisma           # Database schema
├── .env.example                # Environment variables template
├── SETUP.md                    # Local setup instructions
└── README.md                   # This file
```

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL 13+
- **Data Fetching**: TanStack Query (React Query) v5
- **UI**: React 19 + shadcn/ui + Tailwind CSS v4
- **Language**: TypeScript 5.x

## Running the Application

1. **Setup**: Follow [SETUP.md](./SETUP.md) for initial configuration
2. **Development**: `pnpm dev`
3. **Production**: Deploy to Vercel (DATABASE_URL must be set in environment variables)

The application automatically starts the worker process when deployed. In development, trigger manual processing via the dashboard UI or API endpoints.

## Performance Characteristics

- **Polling Interval**: 2 seconds (configurable)
- **Lock Timeout**: 5 minutes
- **Artificial Stage Delay**: 2 seconds per stage (for demo purposes)
- **Database Queries**: ~3 queries per entry per worker cycle (SELECT, UPDATE, UPDATE)

## Production Considerations

- For high-throughput scenarios, I will consider using dedicated queue systems (Bull, RabbitMQ, AWS SQS)
- Monitor lock expiration timeout based on actual processing duration
- Increase polling interval if database load becomes a concern
- Use connection pooling (Prisma's built-in pooling is sufficient for most cases)