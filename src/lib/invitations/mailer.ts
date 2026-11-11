/**
 * Email delivery through Resend's HTTP API. No SDK: one authenticated POST.
 * Configuration (all set by hand, never pulled):
 *   RESEND_API_KEY              API key from Resend
 *   INVITE_EMAIL_FROM           e.g. "Luis & Bee <invites@your-domain>" on a verified domain
 *   INVITE_EMAIL_REPLY_TO       optional reply address
 *   INVITE_EMAIL_TEST_RECIPIENT optional: every email goes to this address instead of the guest
 *   INVITE_EMAIL_SIMULATE       "1" = pretend to send (for testing the dashboard without a provider).
 *                               Ignored on the Vercel production deployment.
 */
const ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 15_000

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

export type EmailMode = 'live' | 'simulated' | 'off'

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email sending is not set up yet.')
    this.name = 'EmailNotConfiguredError'
  }
}

export class EmailSendError extends Error {
  constructor(public readonly status: number) {
    super('The email provider did not accept the message.')
    this.name = 'EmailSendError'
  }
}

/**
 * Real credentials always win. Simulation only applies when they are absent,
 * and never on the production deployment, where a pretend send would leave
 * guests uninvited while the dashboard says "sent".
 */
export function emailMode(): EmailMode {
  if (process.env.RESEND_API_KEY && process.env.INVITE_EMAIL_FROM) return 'live'
  if (process.env.INVITE_EMAIL_SIMULATE === '1' && process.env.VERCEL_ENV !== 'production') return 'simulated'
  return 'off'
}

export function isEmailConfigured(): boolean {
  return emailMode() !== 'off'
}

export const SIMULATED_ID_PREFIX = 'simulated-'

/** Sends one email and returns the provider's message id. Never logs addresses or content. */
export async function sendEmail(email: OutgoingEmail): Promise<string> {
  const mode = emailMode()
  if (mode === 'off') throw new EmailNotConfiguredError()
  if (mode === 'simulated') return `${SIMULATED_ID_PREFIX}${Date.now()}`

  const testRecipient = process.env.INVITE_EMAIL_TEST_RECIPIENT
  const replyTo = process.env.INVITE_EMAIL_REPLY_TO
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.INVITE_EMAIL_FROM,
      to: [testRecipient || email.to],
      subject: testRecipient ? `[Test] ${email.subject}` : email.subject,
      html: email.html,
      text: email.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new EmailSendError(response.status)
  const json: unknown = await response.json().catch(() => null)
  const id = typeof json === 'object' && json !== null ? (json as { id?: unknown }).id : undefined
  return typeof id === 'string' ? id : ''
}
