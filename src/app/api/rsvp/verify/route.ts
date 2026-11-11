import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { createRsvpRateLimiter, emailSchema, rsvpEligibility } from '@/lib/rsvp-policy'

const verifySchema = z.object({ email: emailSchema })
const isRateLimited = createRsvpRateLimiter()

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Please try again in a minute.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  try {
    const { email } = verifySchema.parse(await request.json())
    const db = getDb()
    // Select only required fields. Optional presentation migrations do not affect RSVP.
    const [guests, rsvps, configs] = await Promise.all([
      db.select({ status: schema.guestList.status, seats: schema.guestList.seats, name: schema.guestList.name })
        .from(schema.guestList).where(eq(schema.guestList.email, email)).limit(1),
      db.select({ id: schema.rsvps.id })
        .from(schema.rsvps).where(eq(schema.rsvps.email, email)).limit(1),
      db.select({ rsvpAccessMode: schema.weddingConfig.rsvpAccessMode })
        .from(schema.weddingConfig).limit(1),
    ])
    const data = rsvpEligibility(guests[0] ?? null, rsvps.length > 0, configs[0]?.rsvpAccessMode ?? 'open')
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: error instanceof z.ZodError ? error.errors[0].message : 'Invalid JSON request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 })
  }
}
