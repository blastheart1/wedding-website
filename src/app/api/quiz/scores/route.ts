import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { z } from 'zod'

const submitSchema = z.object({
  playerName:  z.string().min(1).max(100).transform(s => s.trim()),
  // answers: record of questionId -> selected option ('A'|'B'|'C'|'D')
  answers:     z.record(z.string(), z.enum(['A', 'B', 'C', 'D'])),
  timeTakenMs: z.number().int().min(0).max(600_000).optional(),
})

export async function GET() {
  try {
    const db     = getDb()
    const scores = await db
      .select()
      .from(schema.quizScores)
      .orderBy(desc(schema.quizScores.score), desc(schema.quizScores.createdAt))
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

    // Fetch correct answers server-side — never trust client answers
    const questions = await db.select().from(schema.quizQuestions)
    const answerKey = Object.fromEntries(questions.map(q => [String(q.id), q.correctOption]))

    let score = 0
    const totalQ = Object.keys(answerKey).length

    for (const [qId, selected] of Object.entries(data.answers)) {
      if (answerKey[qId] === selected) score++
    }

    const [saved] = await db
      .insert(schema.quizScores)
      .values({
        playerName:  data.playerName,
        score,
        totalQ,
        timeTakenMs: data.timeTakenMs,
      })
      .returning()

    return NextResponse.json({ success: true, data: { score, totalQ, id: saved.id } }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to submit score' }, { status: 500 })
  }
}
