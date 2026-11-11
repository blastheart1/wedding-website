import { and, eq, isNull, sql } from 'drizzle-orm'
import { getInviteDb, schema } from './db'
import { parseInviteSettings, type InviteSettings } from './settings'
import type { InvitationRecord, InviteEventType, InviteStore, RsvpRecord } from './types'
import type { InviteRsvpValues } from './policy'

const { invitations, invitationEvents, inviteSettings, rsvps, weddingConfig } = schema

const invitationColumns = {
  id: invitations.id,
  guestName: invitations.guestName,
  email: invitations.email,
  seats: invitations.seats,
  status: invitations.status,
  tokenHash: invitations.tokenHash,
  firstOpenedAt: invitations.firstOpenedAt,
  lastOpenedAt: invitations.lastOpenedAt,
  respondedAt: invitations.respondedAt,
}

const rsvpColumns = {
  id: rsvps.id,
  attending: rsvps.attending,
  partySize: rsvps.partySize,
  companions: rsvps.companions,
  dietary: rsvps.dietary,
  songRequest: rsvps.songRequest,
  message: rsvps.message,
  updatedAt: rsvps.updatedAt,
  createdAt: rsvps.createdAt,
}

type RsvpRow = Omit<RsvpRecord, 'companions'> & { companions: string | null }

function parseCompanions(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const toRsvp = (row: RsvpRow): RsvpRecord => ({ ...row, companions: parseCompanions(row.companions) })

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

function rsvpFields(invitation: InvitationRecord, values: InviteRsvpValues, now: Date) {
  return {
    name: invitation.guestName,
    attending: values.attending,
    partySize: values.partySize,
    companions: JSON.stringify(values.companions),
    dietary: values.dietary ?? null,
    songRequest: values.songRequest ?? null,
    message: values.message ?? null,
    acknowledgedAt: now,
    updatedAt: now,
    invitationId: invitation.id,
  }
}

async function findRsvp(invitation: InvitationRecord): Promise<RsvpRecord | null> {
  const db = getInviteDb()
  const linked = await db.select(rsvpColumns).from(rsvps).where(eq(rsvps.invitationId, invitation.id)).limit(1)
  if (linked[0]) return toRsvp(linked[0])
  if (!invitation.email) return null
  // A guest who already answered through the older email form keeps that answer.
  const legacy = await db.select(rsvpColumns).from(rsvps)
    .where(and(eq(rsvps.email, invitation.email), isNull(rsvps.invitationId))).limit(1)
  return legacy[0] ? toRsvp(legacy[0]) : null
}

export const inviteStore: InviteStore = {
  async findByTokenHash(tokenHash) {
    const rows = await getInviteDb().select(invitationColumns).from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1)
    return rows[0] ?? null
  },

  findRsvp,

  async saveRsvp(invitation, values, existing, now) {
    const db = getInviteDb()
    const fields = rsvpFields(invitation, values, now)
    if (existing) {
      await db.update(rsvps).set(fields).where(eq(rsvps.id, existing.id))
      return
    }
    try {
      await db.insert(rsvps).values({ ...fields, email: invitation.email })
    } catch (error) {
      // Two submissions at once: the unique indexes keep one row, so update it instead.
      if (!isUniqueViolation(error)) throw error
      const current = await findRsvp(invitation)
      if (!current) throw error
      await db.update(rsvps).set(fields).where(eq(rsvps.id, current.id))
    }
  },

  async markResponded(invitationId, now) {
    await getInviteDb().update(invitations).set({ respondedAt: now, updatedAt: now }).where(eq(invitations.id, invitationId))
  },

  async recordOpen(invitationId, now) {
    await getInviteDb().update(invitations).set({
      openCount: sql`${invitations.openCount} + 1`,
      lastOpenedAt: now,
      firstOpenedAt: sql`COALESCE(${invitations.firstOpenedAt}, ${now.toISOString()}::timestamp)`,
    }).where(eq(invitations.id, invitationId))
  },

  async recordEvent(invitationId, type: InviteEventType, channel = null, meta = null) {
    await getInviteDb().insert(invitationEvents).values({ invitationId, type, channel, meta })
  },

  async deadlineText() {
    const rows = await getInviteDb().select({ rsvpDeadline: weddingConfig.rsvpDeadline }).from(weddingConfig).limit(1)
    return rows[0]?.rsvpDeadline ?? null
  },
}

/** Settings fall back to the defaults when the row is missing or the table is not migrated yet. */
export async function loadInviteSettings(): Promise<InviteSettings> {
  try {
    const rows = await getInviteDb().select({ data: inviteSettings.data }).from(inviteSettings).limit(1)
    return parseInviteSettings(rows[0]?.data)
  } catch {
    return parseInviteSettings(null)
  }
}
