import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { z } from 'zod'

const rsvpSchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters').max(255),
  email:       z.string().email('Please enter a valid email').max(255),
  attending:   z.enum(['yes', 'no']),
  meal:        z.string().max(100).optional(),
  songRequest: z.string().max(255).optional(),
  plusOne:     z.boolean().optional(),
  plusOneName: z.string().max(255).optional(),
  message:     z.string().max(2000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = rsvpSchema.parse(body)
    const db   = getDb()

    const [rsvp] = await db
      .insert(schema.rsvps)
      .values({
        name:        data.name,
        email:       data.email.toLowerCase(),
        attending:   data.attending === 'yes',
        meal:        data.meal,
        songRequest: data.songRequest,
        plusOne:     data.plusOne ?? false,
        plusOneName: data.plusOneName,
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

    // Unique-constraint violation → duplicate email
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('rsvps_email_unique') || msg.includes('unique')) {
      return NextResponse.json(
        { success: false, message: "You've already RSVPed with this email. Email us if you need to make changes." },
        { status: 409 },
      )
    }

    console.error('RSVP error:', error)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
