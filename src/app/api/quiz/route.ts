import { NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq, asc } from 'drizzle-orm'

// Public: fetch visible quiz questions (without revealing correct answers)
export async function GET() {
  try {
    const db        = getDb()
    const questions = await db
      .select({
        id:        schema.quizQuestions.id,
        question:  schema.quizQuestions.question,
        optionA:   schema.quizQuestions.optionA,
        optionB:   schema.quizQuestions.optionB,
        optionC:   schema.quizQuestions.optionC,
        optionD:   schema.quizQuestions.optionD,
        sortOrder: schema.quizQuestions.sortOrder,
      })
      .from(schema.quizQuestions)
      .where(eq(schema.quizQuestions.visible, true))
      .orderBy(asc(schema.quizQuestions.sortOrder), asc(schema.quizQuestions.createdAt))

    return NextResponse.json({ success: true, data: questions })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch questions' }, { status: 500 })
  }
}
