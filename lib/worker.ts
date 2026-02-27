import prisma from './db'
import { Status } from '@prisma/client'

const WORKER_ID = 'worker'
const LOCK_TIMEOUT = 2 * 60 * 1000 // 2 minutes
const STAGE_DELAY = 2000 // 2 seconds

async function claimLock(entryId: string): Promise<boolean> {
  const now = new Date()
  const result = await prisma.entry.updateMany({
    where: {
      id: entryId,
      OR: [
        { lockedBy: null },
        { lockedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT) } }
      ]
    },
    data: {
      lockedBy: WORKER_ID,
      lockedAt: now
    }
  })
  
  return result.count > 0
}

async function releaseLock(entryId: string): Promise<void> {
  await prisma.entry.updateMany({
    where: {
      id: entryId,
      lockedBy: WORKER_ID
    },
    data: {
      lockedBy: null,
      lockedAt: null
    }
  })
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function processEntry(entryId: string): Promise<void> {
  try {
    // STAGE 1
    if (await claimLock(entryId)) {
      await delay(STAGE_DELAY)
      await prisma.entry.updateMany({
        where: {
          id: entryId,
          lockedBy: WORKER_ID
        },
        data: {
          status: Status.STAGE_1,
          progress: 33
        }
      })
      await releaseLock(entryId)
    }

    // STAGE 2
    if (await claimLock(entryId)) {
      await delay(STAGE_DELAY)
      await prisma.entry.updateMany({
        where: {
          id: entryId,
          lockedBy: WORKER_ID
        },
        data: {
          status: Status.STAGE_2,
          progress: 66
        }
      })
      await releaseLock(entryId)
    }

    // COMPLETED
    if (await claimLock(entryId)) {
      await delay(STAGE_DELAY)
      await prisma.entry.updateMany({
        where: {
          id: entryId,
          lockedBy: WORKER_ID
        },
        data: {
          status: Status.COMPLETED,
          progress: 100,
          result: `Processed successfully at ${new Date().toISOString()}`
        }
      })
      await releaseLock(entryId)
    }
  } catch (error) {
    console.error(`[Worker] Error processing entry ${entryId}:`, error)
    
    // Mark as FAILED
    await prisma.entry.updateMany({
      where: {
        id: entryId,
        lockedBy: WORKER_ID
      },
      data: {
        status: Status.FAILED,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    })
    await releaseLock(entryId)
  }
}
