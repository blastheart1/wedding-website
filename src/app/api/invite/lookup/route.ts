import { NextRequest, NextResponse } from 'next/server'
import { lookupStatus } from '@/lib/invitations/lookup'
import { lookupDeps } from '@/lib/invitations/lookup-store'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store' }

/** Public status check by exact email or phone. Rate limited in the database across all instances. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  let contact: unknown
  try {
    contact = ((await request.json()) as { contact?: unknown } | null)?.contact
  } catch {
    contact = undefined
  }
  try {
    const result = await lookupStatus(lookupDeps, contact, ip)
    return NextResponse.json(result.body, { status: result.status, headers })
  } catch (error) {
    console.error('Invitation lookup failed', error instanceof Error ? error.name : 'unknown error')
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500, headers })
  }
}
