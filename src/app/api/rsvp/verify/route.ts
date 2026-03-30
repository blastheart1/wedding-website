import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { GuestVerification } from '@/types'

const verifySchema = z.object({
  email: z.string().email().max(255).transform(s => s.toLowerCase().trim()),
})

// Simple in-memory rate limiter: max 10 verify attempts per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now    = Date.now()
  const entry  = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }

  if (entry.count >= 10) return true
  entry.count++
  return false
}

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Please try again in a minute.' },
      { status: 429 },
    )
  }

  try {
    const body  = await request.json()
    const { email } = verifySchema.parse(body)
    const db    = getDb()

    // Parallel lookups: guest list entry + existing RSVP + config
    const [guestRows, rsvpRows, configRows] = await Promise.all([
      db.select().from(schema.guestList).where(eq(schema.guestList.email, email)).limit(1),
      db.select().from(schema.rsvps).where(eq(schema.rsvps.email, email)).limit(1),
      db.select().from(schema.weddingConfig).limit(1),
    ])

    // Already submitted an RSVP — block double submission
    if (rsvpRows.length > 0) {
      const result: GuestVerification = { allowed: false, seats: null, name: null, reason: 'already_rsvped' }
      return NextResponse.json({ success: true, data: result })
    }

    const guest      = guestRows[0] ?? null
    const accessMode = configRows[0]?.rsvpAccessMode ?? 'open'

    // Blocked guest
    if (guest?.status === 'block') {
      const result: GuestVerification = { allowed: false, seats: null, name: null, reason: 'blocked' }
      return NextResponse.json({ success: true, data: result })
    }

    // Whitelisted guest
    if (guest?.status === 'allow') {
      const result: GuestVerification = {
        allowed: true,
        seats:   guest.seats,
        name:    guest.name ?? null,
        reason:  undefined,
      }
      return NextResponse.json({ success: true, data: result })
    }

    // Not on list
    if (accessMode === 'invite_only') {
      const result: GuestVerification = { allowed: false, seats: null, name: null, reason: 'not_invited' }
      return NextResponse.json({ success: true, data: result })
    }

    // Open / mixed — let them through with no seat assignment
    const result: GuestVerification = { allowed: true, seats: null, name: null }
    return NextResponse.json({ success: true, data: result })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 })
  }
}
