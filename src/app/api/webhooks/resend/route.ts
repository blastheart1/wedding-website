import { NextRequest, NextResponse } from 'next/server'
import { and, eq, like } from 'drizzle-orm'
import { getInviteDb, schema } from '@/lib/invitations/db'
import { inviteStore } from '@/lib/invitations/store'
import { parseDeliveryEvent, verifyWebhook } from '@/lib/invitations/webhook'

export const dynamic = 'force-dynamic'

/** Delivery and bounce notices from Resend. Unsigned or stale requests are refused. */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const verified = verifyWebhook(process.env.RESEND_WEBHOOK_SECRET, {
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
  }, body)
  if (!verified) return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 })

  const event = parseDeliveryEvent(body)
  if (!event) return NextResponse.json({ success: true, data: { recorded: false } })
  try {
    const { invitationEvents } = schema
    // The send recorded the provider's message id; the id format is validated before this query.
    const sent = await getInviteDb().select({ invitationId: invitationEvents.invitationId }).from(invitationEvents)
      .where(and(eq(invitationEvents.type, 'email_sent'), like(invitationEvents.meta, `%"emailId":"${event.emailId}"%`))).limit(1)
    if (sent[0]) await inviteStore.recordEvent(sent[0].invitationId, event.type, 'email')
    return NextResponse.json({ success: true, data: { recorded: Boolean(sent[0]) } })
  } catch (error) {
    console.error('Resend webhook failed', error instanceof Error ? error.name : 'unknown error')
    return NextResponse.json({ success: false, error: 'Could not record the event' }, { status: 500 })
  }
}
