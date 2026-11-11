import { eq, lt, sql } from 'drizzle-orm'
import { getInviteDb, schema } from './db'
import { isEmailConfigured } from './mailer'
import { sendInvitationEmailById } from './send'
import { inviteStore } from './store'
import { LOOKUP_WINDOW_MS, type LookupDeps } from './lookup'

const { invitations, rateLimits, rsvps } = schema
const STALE_MS = 24 * 60 * 60 * 1000

export const lookupDeps: LookupDeps = {
  async hit(key, now) {
    const db = getInviteDb()
    const stamp = now.toISOString()
    const cutoff = new Date(now.getTime() - LOOKUP_WINDOW_MS).toISOString()
    // One atomic statement: start a new window when the old one has expired, otherwise count up.
    const rows = await db.insert(rateLimits).values({ key, windowStart: now, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.windowStart} < ${cutoff}::timestamp THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStart: sql`CASE WHEN ${rateLimits.windowStart} < ${cutoff}::timestamp THEN ${stamp}::timestamp ELSE ${rateLimits.windowStart} END`,
        },
      })
      .returning({ count: rateLimits.count })
    // Occasionally clear day-old counters so the table stays small.
    if (now.getTime() % 50 === 0) await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - STALE_MS)))
    return rows[0]?.count ?? 1
  },

  async findByContact(contact) {
    const db = getInviteDb()
    const column = contact.kind === 'email' ? invitations.email : invitations.phone
    const rows = await db.select({ id: invitations.id, status: invitations.status, email: invitations.email })
      .from(invitations).where(eq(column, contact.value)).limit(1)
    const invitation = rows[0]
    if (!invitation) return null
    const responses = await db.select({ id: rsvps.id }).from(rsvps).where(eq(rsvps.invitationId, invitation.id)).limit(1)
    return { id: invitation.id, status: invitation.status, hasEmail: Boolean(invitation.email), responded: responses.length > 0 }
  },

  async emailLink(invitationId) {
    if (!isEmailConfigured()) return false
    return (await sendInvitationEmailById(invitationId, { resend: true })).sent
  },

  async requestLink(invitationId, now) {
    await getInviteDb().update(invitations).set({ linkRequestedAt: now }).where(eq(invitations.id, invitationId))
    await inviteStore.recordEvent(invitationId, 'link_requested')
  },
}
