# Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Set Up Database

Create `.env.local` with your PostgreSQL connection:
```
DATABASE_URL="postgresql://username:password@localhost:5432/async_workflow"
```

Make sure PostgreSQL is running, then create the database and run migrations:
```bash
npx prisma migrate dev --name init
```

### 3. Run Development Server
```bash
pnpm dev
```

### 4. Open the App
Navigate to `http://localhost:3000/entries` in your browser.

## Testing the Workflow

1. **Create Entry**: Click "Create Entry" and enter a title
2. **Watch Progress**: The entry will automatically progress through stages
3. **Monitor Updates**: The table updates every 2 seconds showing live progress
4. **View Results**: Once complete, the result timestamp appears

## Architecture Overview

```
User creates entry → API creates record → Worker processes async
                                              ↓
                                    Claims lock (atomic)
                                              ↓
                                    STAGE_1 (2s delay)
                                              ↓
                                    STAGE_2 (2s delay)
                                              ↓
                                    COMPLETED (2s delay)
                                              ↓
                                    UI polls & updates (2s interval)
```

## Key Files

- **`prisma/schema.prisma`** - Database schema with Entry model
- **`lib/worker.ts`** - Background processing logic with locking
- **`lib/api.ts`** - API client with TanStack Query
- **`app/entries/page.tsx`** - Main UI page
- **`components/entries-table.tsx`** - Live updating entries table

## Environment Variables

Only required variable:
- `DATABASE_URL` - PostgreSQL connection string

Example:
```
postgresql://user:password@localhost:5432/database_name
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "relation Entry does not exist" | Run `npx prisma migrate dev --name init` |
| Port 3000 already in use | Run on different port: `pnpm dev -- -p 3001` |
| Database connection failed | Check DATABASE_URL and ensure PostgreSQL is running |
| Entries not updating | Refresh browser and check dev server console for errors |

## Database Commands

```bash
# Run migrations
npx prisma migrate dev --name init

# Open database explorer
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Next: Read Full Documentation

See `README_ASYNC_WORKFLOW.md` for detailed architecture, API documentation, and advanced setup.
