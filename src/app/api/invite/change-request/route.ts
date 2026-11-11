import { NextRequest, NextResponse } from 'next/server'
import { requestRsvpChange } from '@/lib/invitations/lookup'
import { lookupDeps } from '@/lib/invitations/lookup-store'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store' }

/** A guest's note asking the couple to change their RSVP. It never edits the RSVP itself. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  let body: { contact?: unknown; note?: unknown } | null = null
  try {
    body = (await request.json()) as { contact?: unknown; note?: unknown } | null
  } catch {
    body = null
  }
  try {
    const result = await requestRsvpChange(lookupDeps, body?.contact, body?.note, ip)
    return NextResponse.json(result.body, { status: result.status, headers })
  } catch (error) {
    console.error('Change request failed', error instanceof Error ? error.name : 'unknown error')
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500, headers })
  }
}
