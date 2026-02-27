-- CreateEnum
CREATE TYPE "Status" AS ENUM ('CREATED', 'STAGE_1', 'STAGE_2', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'CREATED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entry_status_lockedAt_idx" ON "Entry"("status", "lockedAt");
