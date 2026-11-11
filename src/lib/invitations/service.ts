import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { hashToken, isTokenShape } from './token'
import { checkInviteRsvp, DEADLINE_PASSED, firstName, INVITE_UNAVAILABLE, inviteRsvpSchema, isPastDeadline, plusCount } from './policy'
import type { InvitationRecord, InviteStore, InviteView, RsvpRecord, ServiceResult } from './types'

/** A repeat visit inside this window updates the counters but adds no new timeline entry. */
const OPEN_EVENT_GAP_MS = 30 * 60 * 1000

/** Link-preview robots fetch the page but must never count as the guest opening it. */
const PREVIEW_ROBOT = /bot|crawler|spider|facebookexternalhit|facebot|instagram|whatsapp|telegram|slack|discord|twitter|linkedin|pinterest|preview|headless|curl|wget|python|okhttp/i

export function isPreviewRobot(userAgent: string | null | undefined): boolean {
  return !userAgent || PREVIEW_ROBOT.test(userAgent)
}

/**
 * Unknown, malformed and revoked links are indistinguishable to the caller:
 * all return null, and malformed values never reach the database.
 */
export async function resolveInvitation(store: InviteStore, token: unknown): Promise<InvitationRecord | null> {
  if (!isTokenShape(token)) return null
  const expected = hashToken(token)
  const invitation = await store.findByTokenHash(expected)
  if (!invitation || invitation.status !== 'active') return null
  const stored = Buffer.from(invitation.tokenHash, 'utf8')
  const wanted = Buffer.from(expected, 'utf8')
  if (stored.length !== wanted.length || !timingSafeEqual(stored, wanted)) return null
  return invitation
}

export function toInviteView(invitation: InvitationRecord, rsvp: RsvpRecord | null, deadline: string | null, now: number): InviteView {
  return {
    firstName: firstName(invitation.guestName),
    guestName: invitation.guestName,
    seats: invitation.seats,
    plus: plusCount(invitation.seats),
    canEdit: !isPastDeadline(deadline, now),
    deadline: deadline ?? '',
    response: rsvp && {
      attending: rsvp.attending,
      partySize: rsvp.partySize ?? (rsvp.attending ? 1 : 0),
      companions: rsvp.companions,
      dietary: rsvp.dietary ?? '',
      songRequest: rsvp.songRequest ?? '',
      message: rsvp.message ?? '',
      submittedAt: (rsvp.updatedAt ?? rsvp.createdAt).toISOString(),
    },
  }
}

export async function loadInviteView(store: InviteStore, token: unknown, now: Date = new Date()): Promise<InviteView | null> {
  const invitation = await resolveInvitation(store, token)
  if (!invitation) return null
  const [rsvp, deadline] = await Promise.all([store.findRsvp(invitation), store.deadlineText()])
  return toInviteView(invitation, rsvp, deadline, now.getTime())
}

/** Create or edit the RSVP behind a personal link. Every rule is rechecked here on each call. */
export async function submitInviteRsvp(store: InviteStore, token: unknown, payload: unknown, now: Date = new Date()): Promise<ServiceResult<InviteView>> {
  const invitation = await resolveInvitation(store, token)
  if (!invitation) return { status: 404, body: { success: false, error: INVITE_UNAVAILABLE } }

  const deadline = await store.deadlineText()
  if (isPastDeadline(deadline, now.getTime())) return { status: 403, body: { success: false, error: DEADLINE_PASSED } }

  const parsed = inviteRsvpSchema.safeParse(payload)
  if (!parsed.success) {
    const message = parsed.error instanceof z.ZodError ? parsed.error.errors[0].message : 'Please check your answers.'
    return { status: 400, body: { success: false, error: message } }
  }
  // Seats come from the stored invitation, never from the request.
  const checked = checkInviteRsvp(parsed.data, invitation.seats)
  if (!checked.ok) return { status: 400, body: { success: false, error: checked.message } }

  const existing = await store.findRsvp(invitation)
  await store.saveRsvp(invitation, checked.values, existing, now)
  if (!invitation.respondedAt) await store.markResponded(invitation.id, now)
  await store.recordEvent(invitation.id, existing ? 'updated' : 'responded', null,
    JSON.stringify({ attending: checked.values.attending, partySize: checked.values.partySize }))

  const saved = await store.findRsvp(invitation)
  return { status: 200, body: { success: true, data: toInviteView(invitation, saved, deadline, now.getTime()) } }
}

/** Called by the guest page after it loads in a real browser. Always answers the same way. */
export async function recordInviteOpen(store: InviteStore, token: unknown, userAgent: string | null | undefined, now: Date = new Date()): Promise<boolean> {
  if (isPreviewRobot(userAgent)) return false
  const invitation = await resolveInvitation(store, token)
  if (!invitation) return false
  await store.recordOpen(invitation.id, now)
  const last = invitation.lastOpenedAt?.getTime()
  if (last === undefined || now.getTime() - last >= OPEN_EVENT_GAP_MS) {
    await store.recordEvent(invitation.id, 'opened')
  }
  return true
}
