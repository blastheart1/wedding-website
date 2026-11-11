import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  email:  z.string().email().max(255).transform(s => s.toLowerCase().trim()),
  name:   z.string().max(255).optional(),
  status: z.enum(['allow', 'block']).default('allow'),
  seats:  z.number().int().min(1).max(20).default(1),
})

const updateSchema = z.object({
  id:     z.number().int().positive(),
  name:   z.string().max(255).optional(),
  status: z.enum(['allow', 'block']).optional(),
  seats:  z.number().int().min(1).max(20).optional(),
})

const bulkSchema = z.object({
  guests: z.array(z.object({
    email:  z.string().email().max(255).transform(s => s.toLowerCase().trim()),
    name:   z.string().max(255).optional(),
    status: z.enum(['allow', 'block']).default('allow'),
    seats:  z.number().int().min(1).max(20).default(1),
  })).max(500),
})

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db      = getDb()
  const guests  = await db
    .select()
    .from(schema.guestList)
    .orderBy(asc(schema.guestList.email))

  return NextResponse.json({ success: true, data: guests })
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createSchema.parse(body)
    const db   = getDb()

    const [guest] = await db
      .insert(schema.guestList)
      .values(data)
      .onConflictDoUpdate({
        target: schema.guestList.email,
        set: {
          name:   data.name,
          status: data.status,
          seats:  data.seats,
        },
      })
      .returning()

    return NextResponse.json({ success: true, data: guest }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to add guest' }, { status: 500 })
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
    const [guest] = await db
      .update(schema.guestList)
      .set(updates)
      .where(eq(schema.guestList.id, id))
      .returning()

    return NextResponse.json({ success: true, data: guest })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update guest' }, { status: 500 })
  }
}

// PUT: bulk import/upsert
export async function PUT(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { guests } = bulkSchema.parse(body)
    const db = getDb()

    const results = await Promise.all(
      guests.map(g =>
        db
          .insert(schema.guestList)
          .values(g)
          .onConflictDoUpdate({
            target: schema.guestList.email,
            set: { name: g.name, status: g.status, seats: g.seats },
          })
          .returning(),
      ),
    )

    return NextResponse.json({ success: true, count: results.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Bulk import failed' }, { status: 500 })
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
  await db.delete(schema.guestList).where(eq(schema.guestList.id, id))
  return NextResponse.json({ success: true })
}
