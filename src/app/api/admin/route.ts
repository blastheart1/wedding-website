import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { isAdminRequest } from '@/lib/auth'

// ─── GET: fetch config + rsvp stats ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const [configs, rsvps] = await Promise.all([
    db.select().from(schema.weddingConfig).limit(1),
    db.select().from(schema.rsvps).orderBy(schema.rsvps.createdAt),
  ])

  return NextResponse.json({
    config: configs[0] ?? null,
    rsvps,
    stats: {
      total:     rsvps.length,
      attending: rsvps.filter(r => r.attending).length,
      declining: rsvps.filter(r => !r.attending).length,
    },
  })
}

// ─── POST: upsert config ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body     = await request.json()
  const db       = getDb()
  const existing = await db.select().from(schema.weddingConfig).limit(1)

  if (existing.length > 0) {
    await db
      .update(schema.weddingConfig)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.weddingConfig.id, existing[0].id))
  } else {
    await db.insert(schema.weddingConfig).values(body)
  }

  return NextResponse.json({ success: true })
}
