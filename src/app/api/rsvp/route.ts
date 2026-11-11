import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { createRsvpRateLimiter, denialMessages, rsvpEligibility, rsvpSchema } from '@/lib/rsvp-policy'

const isRateLimited = createRsvpRateLimiter()

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, message: 'Too many attempts. Please try again in a minute.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  try {
    const data = rsvpSchema.parse(await request.json())
    const db = getDb()

    // Never trust a prior browser verification or submitted seats/access flags.
    // Reload the current invitation policy immediately before the insert.
    const [guestRows, existing, configs] = await Promise.all([
      db.select({ status: schema.guestList.status, seats: schema.guestList.seats, name: schema.guestList.name })
        .from(schema.guestList).where(eq(schema.guestList.email, data.email)).limit(1),
      db.select({ id: schema.rsvps.id })
        .from(schema.rsvps).where(eq(schema.rsvps.email, data.email)).limit(1),
      db.select({ rsvpAccessMode: schema.weddingConfig.rsvpAccessMode })
        .from(schema.weddingConfig).limit(1),
    ])

    const eligibility = rsvpEligibility(guestRows[0] ?? null, existing.length > 0, configs[0]?.rsvpAccessMode ?? 'open')
    if (!eligibility.allowed) {
      const reason = eligibility.reason ?? 'not_invited'
      return NextResponse.json(
        { success: false, message: denialMessages[reason], reason },
        { status: reason === 'already_rsvped' ? 409 : 403 },
      )
    }

    const [rsvp] = await db.insert(schema.rsvps).values({
      name: data.name,
      email: data.email,
      attending: data.attending === 'yes',
      dietary: data.dietary,
      songRequest: data.songRequest,
      message: data.message,
    }).returning()

    return NextResponse.json({
      success: true,
      message: data.attending === 'yes'
        ? "RSVP received! We can't wait to celebrate with you."
        : 'Thank you for letting us know. Your response has been received.',
      id: rsvp.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: error instanceof z.ZodError ? error.errors[0].message : 'Invalid JSON request.' },
        { status: 400 },
      )
    }

    // The unique index also protects simultaneous submissions.
    const dbError = error as { code?: string; message?: string }
    if (dbError?.code === '23505' || dbError?.message?.includes('rsvps_email_unique')) {
      return NextResponse.json(
        { success: false, message: denialMessages.already_rsvped, reason: 'already_rsvped' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
