# Async Workflow Demo

A full-stack Next.js application demonstrating async job processing with live UI updates. Entries progress through automated workflow stages with database-level locking for concurrency safety.

## Architecture

### Frontend
- **Next.js 16** with App Router
- **React 19** with client components
- **TanStack Query** for data fetching and polling (2-second interval)
- **ShadCN UI** components for the interface
- **Tailwind CSS** for styling

### Backend
- **Next.js API Routes** for CRUD operations
- **Prisma ORM** for database access
- **PostgreSQL** database with atomic locking
- **Background worker** for async processing (server-side)

### Database
- Entry model with status tracking, progress, and locking fields
- Status progression: CREATED → STAGE_1 → STAGE_2 → COMPLETED (or FAILED)
- Concurrency-safe updates using `lockedBy` and `lockedAt` fields
- Index on `(status, lockedAt)` for efficient lock queries

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 2. Configure Database

Copy `.env.example` to `.env.local` and update with your PostgreSQL connection:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/async_workflow_db"
```

### 3. Create Database and Run Migrations

```bash
npx prisma migrate dev --name init
```

This will:
- Create the PostgreSQL database (if it doesn't exist)
- Create the Entry table with the schema
- Generate the Prisma client

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000/entries`

## How It Works

### Creating an Entry
1. Click "Create Entry" button
2. Enter a title for the workflow entry
3. Entry is created with status `CREATED` (0% progress)
4. Background processing starts immediately

### Background Processing
The worker automatically processes each entry through stages:

1. **STAGE_1** (33% progress) - 2 second delay
2. **STAGE_2** (66% progress) - 2 second delay  
3. **COMPLETED** (100% progress) - 2 second delay
4. Final result recorded with timestamp

Each stage:
- Claims an atomic lock on the database
- Simulates work with a 2-second delay
- Updates progress and status
- Releases the lock

### Live Updates
- UI polls the `/api/entries` endpoint every 2 seconds
- Status badges update to show current stage
- Progress bars animate as work completes
- Results display upon completion

### Concurrency Control
Database-level locking prevents concurrent processing:

```sql
-- Lock claiming (atomic)
UPDATE Entry 
SET lockedBy = 'worker', lockedAt = NOW()
WHERE id = X AND lockedBy IS NULL

-- Lock verification on updates
UPDATE Entry 
SET status = ..., progress = ...
WHERE id = X AND lockedBy = 'worker'
```

This ensures only one worker can process each entry at a time, even with multiple concurrent requests.

## API Endpoints

### Create Entry
```
POST /api/entries
Content-Type: application/json

{ "title": "My workflow entry" }
```

### List Entries
```
GET /api/entries?limit=50&offset=0
```

Response:
```json
{
  "entries": [...],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### Get Single Entry
```
GET /api/entries/:id
```

### Update Entry (Internal)
```
PATCH /api/entries/:id
Content-Type: application/json

{ "status": "STAGE_1", "progress": 33 }
```

## File Structure

```
app/
├── api/
│   └── entries/
│       ├── route.ts          # POST/GET entries
│       └── [id]/route.ts     # GET/PATCH single entry
├── entries/
│   └── page.tsx              # Main demo page
└── layout.tsx                # Root layout with metadata

components/
├── entries-table.tsx         # Entries table with status badges
└── create-entry-dialog.tsx   # Create entry modal

lib/
├── db.ts                     # Prisma client singleton
├── worker.ts                 # Background processing logic
└── api.ts                    # API client and React Query hooks

prisma/
└── schema.prisma             # Database schema
```

## Status Enum Reference

- `CREATED` - Initial state (0%)
- `STAGE_1` - First processing stage (33%)
- `STAGE_2` - Second processing stage (66%)
- `COMPLETED` - Successfully processed (100%)
- `FAILED` - Processing error

## Key Technical Decisions

### No Integrations
- The user chose not to add external integrations
- Database credentials must be configured via `.env.local`
- All setup is done locally with standard Prisma commands

### TanStack Query over WebSocket
- Simple polling (2s interval) instead of WebSocket
- Easier to understand and demo
- Works well with this architecture

### Background Processing
- Server-side async function triggered immediately after creation
- Not a separate process/job queue
- Demonstrates async patterns without complex infrastructure

### Atomic Locking
- Uses database constraints for concurrency
- No race conditions or duplicate processing
- Lock expiry after 2 minutes for safety

## Troubleshooting

### `PrismaClientInitializationError`
Ensure `DATABASE_URL` is set in `.env.local` and the database is running.

### `error: relation "Entry" does not exist`
Run migrations: `npx prisma migrate dev --name init`

### Entries not updating
Check browser console for fetch errors. Ensure the dev server is running on `http://localhost:3000`.

### Lock stuck / entries frozen
Locks auto-expire after 2 minutes. Manually clear with:
```sql
UPDATE "Entry" SET "lockedBy" = NULL, "lockedAt" = NULL WHERE id = 'entry-id';
```

## Next Steps

To extend this demo:

1. **Real Job Queue** - Replace async functions with Bull, Temporal, or Vercel Queues
2. **WebSocket** - Use Socket.io or native WebSocket for real-time updates
3. **Retry Logic** - Add exponential backoff for failed entries
4. **Monitoring** - Add logging, metrics, and alerting
5. **Error Handling** - More robust error messages and recovery strategies
6. **Pagination** - Implement cursor-based pagination for large datasets
7. **Filtering** - Add status filtering and search

## Performance Notes

- Polling interval (2s) can be tuned in `lib/api.ts`
- Stage delays (2s) can be adjusted in `lib/worker.ts`
- Database index on `(status, lockedAt)` optimizes queries
- Consider connection pooling with PgBouncer for production

## License

MIT
