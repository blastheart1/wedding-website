import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  question: z.string().min(1).max(500),
  answer:   z.string().min(1).max(2000),
})

const updateSchema = z.object({
  id:        z.number().int().positive(),
  question:  z.string().min(1).max(500).optional(),
  answer:    z.string().min(1).max(2000).optional(),
  sortOrder: z.number().int().optional(),
  visible:   z.boolean().optional(),
})

const reorderSchema = z.object({
  order: z.array(z.number().int().positive()),
})

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db    = getDb()
  const items = await db
    .select()
    .from(schema.faqItems)
    .orderBy(asc(schema.faqItems.sortOrder), asc(schema.faqItems.createdAt))

  return NextResponse.json({ success: true, data: items })
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createSchema.parse(body)
    const db   = getDb()

    // Set sortOrder to max + 1
    const existing = await db.select().from(schema.faqItems)
    const maxOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1)

    const [item] = await db
      .insert(schema.faqItems)
      .values({ ...data, sortOrder: maxOrder + 1 })
      .returning()

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to create FAQ item' }, { status: 500 })
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
    const [item] = await db
      .update(schema.faqItems)
      .set(updates)
      .where(eq(schema.faqItems.id, id))
      .returning()

    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update FAQ item' }, { status: 500 })
  }
}

// PUT: reorder all items
export async function PUT(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { order } = reorderSchema.parse(body)
    const db = getDb()

    await Promise.all(
      order.map((id, index) =>
        db
          .update(schema.faqItems)
          .set({ sortOrder: index })
          .where(eq(schema.faqItems.id, id)),
      ),
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to reorder FAQ items' }, { status: 500 })
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
  await db.delete(schema.faqItems).where(eq(schema.faqItems.id, id))
  return NextResponse.json({ success: true })
}
