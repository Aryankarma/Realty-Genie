# Local Setup Guide

Complete instructions for setting up this async workflow system on your local machine.

## Prerequisites

- **Node.js**: 18.17+ (check with `node --version`)
- **pnpm**: Latest version (check with `pnpm --version`)
  - Install: `npm install -g pnpm`
- **PostgreSQL**: 13+ running locally
  - macOS: `brew install postgresql && brew services start postgresql`
  - Windows: Download from https://www.postgresql.org/download/windows/
  - Linux: `sudo apt-get install postgresql postgresql-contrib`

## Step 1: Install Dependencies

```bash
pnpm install
```

This installs all Node.js dependencies including Prisma, Next.js, React Query, and shadcn/ui.

## Step 2: Set Up PostgreSQL Database

### Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# In the PostgreSQL prompt:
CREATE USER workflow_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE workflow_db OWNER workflow_user;

# Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE workflow_db TO workflow_user;

# Exit PostgreSQL
\q
```

### Verify Connection

```bash
# Test the connection (replace password with what you set above)
psql postgresql://workflow_user:your_secure_password@localhost:5432/workflow_db
```

If the connection succeeds, you'll see the `workflow_db=#` prompt. Type `\q` to exit.

## Step 3: Configure Environment Variables

Copy the example file and fill in your actual database URL:

```bash
cp .env.example .env.local
```

Edit `.env.local` and update the `DATABASE_URL`:

```env
DATABASE_URL=postgresql://workflow_user:your_secure_password@localhost:5432/workflow_db
NODE_ENV=development
```

**Important**: 
- Replace `your_secure_password` with the password you set in Step 2
- Never commit `.env.local` to version control (it's in `.gitignore`)
- Keep this file secure and confidential

## Step 4: Run Prisma Migrations

Initialize the database schema:

```bash
pnpm prisma migrate dev --name init
```

This command will:
1. Create all tables defined in `prisma/schema.prisma`
2. Generate the Prisma client
3. Create a migration file in `prisma/migrations/`

You should see output like:
```
✔ Generated Prisma Client (X.X.X) to ./node_modules/.prisma/client in XXms

✔ Your database is now in sync with your schema.
```

### Verify Database Schema

Check that tables were created:

```bash
psql postgresql://workflow_user:your_secure_password@localhost:5432/workflow_db

# In the PostgreSQL prompt:
\dt

# You should see the "entries" table
```

## Step 5: Start Development Server

```bash
pnpm dev
```

The application will start on `http://localhost:3000`

You should see:
```
  ▲ Next.js 16.0.0
  - Local:        http://localhost:3000
  - Environments: .env.local
```

## Step 6: Test the Application

1. Open your browser to `http://localhost:3000`
2. You should see the Dashboard with an empty entries table
3. Click "Create Entry" and add a few test entries
4. Watch as entries progress through stages automatically
5. Status updates every 2 seconds as the background worker processes them

## Troubleshooting

### Error: "Can't reach database server"

**Problem**: PostgreSQL is not running or connection string is wrong

**Solutions**:
```bash
# Check if PostgreSQL is running (macOS)
brew services list | grep postgresql

# Start PostgreSQL if stopped (macOS)
brew services start postgresql

# Check if PostgreSQL is running (Linux)
sudo systemctl status postgresql

# Test connection manually
psql postgresql://workflow_user:password@localhost:5432/workflow_db
```

### Error: "Database doesn't exist"

**Problem**: Database wasn't created or connection string points to wrong database

**Solutions**:
```bash
# List all databases
psql postgres -l | grep workflow_db

# If not found, create it again following Step 2

# Check your DATABASE_URL in .env.local matches exactly
```

### Error: "EADDRINUSE: address already in use :::3000"

**Problem**: Port 3000 is already in use

**Solutions**:
```bash
# Use a different port
pnpm dev -- -p 3001

# Or find and kill the process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

### Error: "Error in Prisma Client initialization"

**Problem**: Prisma client not generated or out of sync with schema

**Solutions**:
```bash
# Regenerate Prisma client
pnpm prisma generate

# Check that prisma/schema.prisma exists and is valid
cat prisma/schema.prisma
```

### Entries not progressing through stages

**Problem**: Background worker isn't running

**Solutions**:
1. Check browser console for errors
2. Check terminal output for API errors
3. Verify DATABASE_URL is correct in .env.local
4. Try manually advancing an entry via the UI's "Advance" button
5. Check that the worker API is accessible: `curl http://localhost:3000/api/worker`

## Development Workflow

### Making Schema Changes

If you need to modify the database schema:

```bash
# Edit prisma/schema.prisma
nano prisma/schema.prisma

# Create and run migration
pnpm prisma migrate dev --name describe_your_changes

# This will create a new migration file and update the database
```

### Inspecting Database Data

```bash
# Open Prisma Studio (visual database inspector)
pnpm prisma studio

# Opens at http://localhost:5555
# You can view and edit data directly
```

### Resetting Database for Testing

```bash
# ⚠️ WARNING: This deletes all data
pnpm prisma migrate reset

# This will:
# 1. Delete all data
# 2. Drop all tables
# 3. Re-run all migrations
# 4. Seed the database (if seed script exists)
```

## Production Deployment

### To Vercel

1. Push your code to GitHub
2. Connect repository to Vercel
3. Add `DATABASE_URL` to environment variables in Vercel project settings
4. Deploy (Vercel automatically runs migrations during build)

### To Other Platforms

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

**Important**: Always set `DATABASE_URL` environment variable before starting the application.

## Performance Tips

- **Connection Pooling**: Prisma includes built-in connection pooling. For Vercel deployments, use Prisma's serverless driver or PgBouncer
- **Polling Interval**: Adjust the 2-second worker poll interval in `lib/worker.ts` based on your needs
- **Database Indexes**: The schema includes indexes on `status` and `lockedBy` for query performance
- **Monitoring**: Check database logs: `tail -f /usr/local/var/log/postgres.log` (macOS)

## Support

If you encounter issues:

1. Check the [README.md](./README.md) for architecture details
2. Verify all prerequisites are installed
3. Confirm DATABASE_URL is correctly formatted
4. Check that PostgreSQL service is running
5. Review Prisma documentation: https://www.prisma.io/docs
