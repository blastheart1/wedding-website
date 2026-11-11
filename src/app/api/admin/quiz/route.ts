import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  question:      z.string().min(1).max(500),
  optionA:       z.string().min(1).max(255),
  optionB:       z.string().min(1).max(255),
  optionC:       z.string().min(1).max(255),
  optionD:       z.string().min(1).max(255),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
})

const updateSchema = createSchema.partial().extend({
  id:        z.number().int().positive(),
  sortOrder: z.number().int().optional(),
  visible:   z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db        = getDb()
  const questions = await db
    .select()
    .from(schema.quizQuestions)
    .orderBy(asc(schema.quizQuestions.sortOrder), asc(schema.quizQuestions.createdAt))

  return NextResponse.json({ success: true, data: questions })
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createSchema.parse(body)
    const db   = getDb()

    const existing = await db.select().from(schema.quizQuestions)
    const maxOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1)

    const [q] = await db
      .insert(schema.quizQuestions)
      .values({ ...data, sortOrder: maxOrder + 1 })
      .returning()

    return NextResponse.json({ success: true, data: q }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to create question' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = updateSchema.parse(body)
    const db   = getDb()

    const { id, ...updates } = data
    const [q] = await db
      .update(schema.quizQuestions)
      .set(updates)
      .where(eq(schema.quizQuestions.id, id))
      .returning()

    return NextResponse.json({ success: true, data: q })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update question' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = parseInt(searchParams.get('id') ?? '', 10)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
  }

  const db = getDb()
  await db.delete(schema.quizQuestions).where(eq(schema.quizQuestions.id, id))
  return NextResponse.json({ success: true })
}
