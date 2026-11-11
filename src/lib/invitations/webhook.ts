import { createHmac, timingSafeEqual } from 'node:crypto'

const TOLERANCE_SECONDS = 5 * 60

export interface WebhookHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

/**
 * Verifies a Svix-signed webhook (the scheme Resend uses): HMAC-SHA256 over
 * "id.timestamp.body" with the base64 secret after the "whsec_" prefix.
 * Rejects stale timestamps so a captured request cannot be replayed later.
 */
export function verifyWebhook(secret: string | undefined, headers: WebhookHeaders, body: string, nowMs: number = Date.now()): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false
  const timestamp = Number(headers.timestamp)
  if (!Number.isFinite(timestamp) || Math.abs(nowMs / 1000 - timestamp) > TOLERANCE_SECONDS) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  if (key.length === 0) return false
  const expected = createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${body}`).digest()
  return headers.signature.split(' ').some(entry => {
    const [version, value] = entry.split(',')
    if (version !== 'v1' || !value) return false
    const given = Buffer.from(value, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

export type DeliveryEvent = { type: 'email_delivered' | 'email_bounced'; emailId: string }

const EMAIL_ID = /^[A-Za-z0-9-]{8,64}$/
const TYPES: Record<string, DeliveryEvent['type']> = { 'email.delivered': 'email_delivered', 'email.bounced': 'email_bounced' }

/** Picks out the two delivery events the dashboard records. Anything else is ignored. */
export function parseDeliveryEvent(body: string): DeliveryEvent | null {
  try {
    const payload = JSON.parse(body) as { type?: unknown; data?: { email_id?: unknown } }
    const type = typeof payload.type === 'string' ? TYPES[payload.type] : undefined
    const emailId = payload.data?.email_id
    return type && typeof emailId === 'string' && EMAIL_ID.test(emailId) ? { type, emailId } : null
  } catch {
    return null
  }
}
