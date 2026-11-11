import { NextRequest, NextResponse } from 'next/server'
import { createRsvpRateLimiter } from '@/lib/rsvp-policy'
import { submitInviteRsvp } from '@/lib/invitations/service'
import { inviteStore } from '@/lib/invitations/store'

export const dynamic = 'force-dynamic'

const isRateLimited = createRsvpRateLimiter(20)
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Please try again in a minute.' },
      { status: 429, headers: { ...headers, 'Retry-After': '60' } },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Please check your answers.' }, { status: 400, headers })
  }

  try {
    const result = await submitInviteRsvp(inviteStore, params.token, payload)
    return NextResponse.json(result.body, { status: result.status, headers })
  } catch (error) {
    // Never include the token or database detail in logs or responses.
    console.error('Invitation RSVP failed', error instanceof Error ? error.name : 'unknown error')
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500, headers })
  }
}
