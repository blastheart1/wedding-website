import { NextResponse } from 'next/server'
import { RSVP_BY_INVITATION } from '@/lib/rsvp-policy'

/**
 * Closed. This endpoint belonged to the open email RSVP form, which let anyone
 * reply by typing an email. It now refuses every request without reading or
 * writing anything. Guests reply through /i/[token].
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: RSVP_BY_INVITATION, message: RSVP_BY_INVITATION, reason: 'invitation_only' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
