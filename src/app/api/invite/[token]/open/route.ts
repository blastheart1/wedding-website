import { NextRequest, NextResponse } from 'next/server'
import { createRsvpRateLimiter } from '@/lib/rsvp-policy'
import { recordInviteOpen } from '@/lib/invitations/service'
import { inviteStore } from '@/lib/invitations/store'

export const dynamic = 'force-dynamic'

const isRateLimited = createRsvpRateLimiter(30)

/**
 * Sent by the guest page once it is running in a real browser. The answer is
 * always the same empty 204, so it reveals nothing about whether a link exists.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!isRateLimited(ip)) {
    try {
      await recordInviteOpen(inviteStore, params.token, request.headers.get('user-agent'))
    } catch (error) {
      console.error('Invitation open tracking failed', error instanceof Error ? error.name : 'unknown error')
    }
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
