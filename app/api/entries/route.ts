import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { processEntry } from '@/lib/worker'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      )
    }

    const entry = await prisma.entry.create({
      data: {
        title: title.trim()
      }
    })

    // Start async processing without waiting
    processEntry(entry.id).catch(error => {
      console.error(`[API] Background processing failed for ${entry.id}:`, error)
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('[API] Error creating entry:', error)
    return NextResponse.json(
      { error: 'Failed to create entry' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const entries = await prisma.entry.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const total = await prisma.entry.count()

    return NextResponse.json({
      entries,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('[API] Error fetching entries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 }
    )
  }
}
