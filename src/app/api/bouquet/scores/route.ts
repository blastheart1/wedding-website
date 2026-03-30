import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { z } from 'zod'

const submitSchema = z.object({
  playerName: z.string().min(1).max(100).transform(s => s.trim()),
  score:      z.number().int().min(0).max(9999),
})

export async function GET() {
  try {
    const db     = getDb()
    const scores = await db
      .select()
      .from(schema.bouquetScores)
      .orderBy(desc(schema.bouquetScores.score), desc(schema.bouquetScores.createdAt))
      .limit(20)

    return NextResponse.json({ success: true, data: scores })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch scores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = submitSchema.parse(body)
    const db   = getDb()

    const [saved] = await db
      .insert(schema.bouquetScores)
      .values(data)
      .returning()

    return NextResponse.json({ success: true, data: saved }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to submit score' }, { status: 500 })
  }
}
