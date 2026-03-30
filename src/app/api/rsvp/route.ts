import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const rsvpSchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters').max(255),
  email:       z.string().email('Please enter a valid email').max(255),
  attending:   z.enum(['yes', 'no']),
  dietary:     z.string().max(500).optional(),
  songRequest: z.string().max(255).optional(),
  message:     z.string().max(2000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = rsvpSchema.parse(body)
    const db   = getDb()

    const email = data.email.toLowerCase().trim()

    // Re-verify not already submitted (double-check at write time)
    const existing = await db
      .select({ id: schema.rsvps.id })
      .from(schema.rsvps)
      .where(eq(schema.rsvps.email, email))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: "You've already RSVPed with this email. Email us if you need to make changes." },
        { status: 409 },
      )
    }

    const [rsvp] = await db
      .insert(schema.rsvps)
      .values({
        name:        data.name,
        email,
        attending:   data.attending === 'yes',
        dietary:     data.dietary,
        songRequest: data.songRequest,
        message:     data.message,
      })
      .returning()

    return NextResponse.json({
      success: true,
      message: "RSVP received! We can't wait to celebrate with you.",
      id:      rsvp.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.errors[0].message },
        { status: 400 },
      )
    }

    // Unique-constraint violation fallback (race condition safety net)
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('rsvps_email_unique') || msg.includes('unique')) {
      return NextResponse.json(
        { success: false, message: "You've already RSVPed with this email. Email us if you need to make changes." },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
