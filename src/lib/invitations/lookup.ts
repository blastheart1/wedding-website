import { createHash } from 'node:crypto'
import { normalizeContact, type Contact } from './phone'
import type { ServiceResult } from './types'

export const LOOKUP_LIMIT = 5
export const LOOKUP_WINDOW_MS = 15 * 60 * 1000

export interface LookupMatch {
  id: number
  status: string
  hasEmail: boolean
  responded: boolean
}

/** Storage and delivery boundary for the public status lookup. */
export interface LookupDeps {
  /** Counts one attempt for this key inside the current window and returns the total so far. */
  hit(key: string, now: Date): Promise<number>
  findByContact(contact: Contact): Promise<LookupMatch | null>
  /** Emails the guest their link again. Resolves false when email is unavailable or fails. */
  emailLink(invitationId: number): Promise<boolean>
  /** Flags the invitation so the couple can message the guest their link. */
  requestLink(invitationId: number, now: Date): Promise<void>
  /** Records a guest's note asking for a change, for the couple to act on. */
  requestChange(invitationId: number, note: string, now: Date): Promise<void>
}

export interface LookupResult {
  found: boolean
  responded: boolean
  /**
   * 'email' = the link was emailed again; 'manual' = the couple will message it;
   * 'recent' = this contact already asked within the window, so nothing new was sent.
   */
  delivery: 'email' | 'manual' | 'recent' | null
}

/** Stored keys are hashes, so the rate-limit table never holds an email, phone or IP. */
export function rateKey(kind: 'ip' | 'value', value: string): string {
  return `lookup:${kind}:${createHash('sha256').update(value).digest('hex').slice(0, 40)}`
}

const NOT_FOUND: LookupResult = { found: false, responded: false, delivery: null }
export const LOOKUP_INVALID = 'Enter the email address or mobile number we have for you.'
export const LOOKUP_LIMITED = 'Too many tries. Please wait 15 minutes, or contact us and we will help you.'

/**
 * Exact-match status check. It never returns a name, seat count or link, and
 * an unknown contact and a revoked invitation give the identical answer.
 */
export async function lookupStatus(deps: LookupDeps, input: unknown, ip: string, now: Date = new Date()): Promise<ServiceResult<LookupResult>> {
  const contact = typeof input === 'string' && input.length <= 255 ? normalizeContact(input) : null
  // Every request counts against the address, including malformed ones.
  if (await deps.hit(rateKey('ip', ip), now) > LOOKUP_LIMIT) return { status: 429, body: { success: false, error: LOOKUP_LIMITED } }
  if (!contact) return { status: 400, body: { success: false, error: LOOKUP_INVALID } }
  const attempts = await deps.hit(rateKey('value', contact.value), now)
  if (attempts > LOOKUP_LIMIT) return { status: 429, body: { success: false, error: LOOKUP_LIMITED } }

  const match = await deps.findByContact(contact)
  if (!match || match.status !== 'active') return { status: 200, body: { success: true, data: NOT_FOUND } }

  // Only the first request in a window sends anything, so repeating it cannot flood a guest's inbox.
  if (attempts > 1) return { status: 200, body: { success: true, data: { found: true, responded: match.responded, delivery: 'recent' } } }
  const emailed = match.hasEmail ? await deps.emailLink(match.id) : false
  if (!emailed) await deps.requestLink(match.id, now)
  return { status: 200, body: { success: true, data: { found: true, responded: match.responded, delivery: emailed ? 'email' : 'manual' } } }
}

export const CHANGE_NOTE_MAX = 500
export const CHANGE_NOTE_REQUIRED = 'Please tell us what you would like to change.'

/**
 * A guest asks the couple to change their RSVP. Typing a contact does not
 * prove who someone is, so this never edits the RSVP: it leaves a note for
 * the couple. The answer is the same whether or not the contact is on the
 * list, so it cannot be used to test who is invited.
 */
export async function requestRsvpChange(deps: LookupDeps, input: unknown, note: unknown, ip: string, now: Date = new Date()): Promise<ServiceResult<{ received: true }>> {
  const contact = typeof input === 'string' && input.length <= 255 ? normalizeContact(input) : null
  if (await deps.hit(rateKey('ip', ip), now) > LOOKUP_LIMIT) return { status: 429, body: { success: false, error: LOOKUP_LIMITED } }
  if (!contact) return { status: 400, body: { success: false, error: LOOKUP_INVALID } }
  const text = typeof note === 'string' ? note.trim().slice(0, CHANGE_NOTE_MAX) : ''
  if (!text) return { status: 400, body: { success: false, error: CHANGE_NOTE_REQUIRED } }
  if (await deps.hit(rateKey('value', 'change:' + contact.value), now) > LOOKUP_LIMIT) return { status: 429, body: { success: false, error: LOOKUP_LIMITED } }

  const match = await deps.findByContact(contact)
  if (match && match.status === 'active' && match.responded) await deps.requestChange(match.id, text, now)
  return { status: 200, body: { success: true, data: { received: true } } }
}
