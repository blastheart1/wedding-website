import { asc, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { getInviteDb, schema } from './db'
import { decryptToken, issueToken } from './token'
import { inviteSettingsSchema, parseInviteSettings, type InviteSettings } from './settings'
import type { GuestInput, ShareChannel } from './admin-schemas'
import type { InviteEventType } from './types'

const { invitations, invitationEvents, inviteSettings, rsvps, guestList } = schema

/** Everything the dashboard lists. Token fields are deliberately absent. */
const summaryColumns = {
  id: invitations.id,
  guestName: invitations.guestName,
  email: invitations.email,
  phone: invitations.phone,
  seats: invitations.seats,
  status: invitations.status,
  sentAt: invitations.sentAt,
  lastChannel: invitations.lastChannel,
  firstOpenedAt: invitations.firstOpenedAt,
  lastOpenedAt: invitations.lastOpenedAt,
  openCount: invitations.openCount,
  respondedAt: invitations.respondedAt,
  linkRequestedAt: invitations.linkRequestedAt,
  createdAt: invitations.createdAt,
}

export interface InvitationResponse {
  attending: boolean
  partySize: number
  companions: string[]
  dietary: string | null
  songRequest: string | null
  message: string | null
  updatedAt: Date | null
}

type SummaryRow = { [K in keyof typeof summaryColumns]: (typeof invitations.$inferSelect)[K] }
export type InvitationSummary = SummaryRow & { response: InvitationResponse | null }

export interface InvitationDetail extends InvitationSummary {
  token: string
  events: { id: number; type: string; channel: string | null; meta: string | null; createdAt: Date }[]
}

/** Thrown when an email or phone already belongs to another invitation. */
export class DuplicateContactError extends Error {
  constructor() {
    super('Another invitation already uses that email or phone number.')
    this.name = 'DuplicateContactError'
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

function parseCompanions(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const responseColumns = {
  invitationId: rsvps.invitationId,
  attending: rsvps.attending,
  partySize: rsvps.partySize,
  companions: rsvps.companions,
  dietary: rsvps.dietary,
  songRequest: rsvps.songRequest,
  message: rsvps.message,
  updatedAt: rsvps.updatedAt,
}

type ResponseRow = { [K in keyof typeof responseColumns]: (typeof rsvps.$inferSelect)[K] }

const toResponse = (row: ResponseRow): InvitationResponse => ({
  attending: row.attending,
  partySize: row.partySize ?? (row.attending ? 1 : 0),
  companions: parseCompanions(row.companions),
  dietary: row.dietary,
  songRequest: row.songRequest,
  message: row.message,
  updatedAt: row.updatedAt,
})

async function logEvent(invitationId: number, type: InviteEventType, channel: string | null = null, meta: string | null = null): Promise<void> {
  await getInviteDb().insert(invitationEvents).values({ invitationId, type, channel, meta })
}

export async function listInvitations(): Promise<InvitationSummary[]> {
  const db = getInviteDb()
  const [rows, responses] = await Promise.all([
    db.select(summaryColumns).from(invitations).orderBy(asc(invitations.guestName), asc(invitations.id)),
    db.select(responseColumns).from(rsvps).where(isNotNull(rsvps.invitationId)),
  ])
  const byInvitation = new Map(responses.map(row => [row.invitationId, toResponse(row)]))
  return rows.map(row => ({ ...row, response: byInvitation.get(row.id) ?? null }))
}

export async function getInvitationDetail(id: number): Promise<InvitationDetail | null> {
  const db = getInviteDb()
  const [rows, tokens, responses, events] = await Promise.all([
    db.select(summaryColumns).from(invitations).where(eq(invitations.id, id)).limit(1),
    db.select({ tokenEnc: invitations.tokenEnc }).from(invitations).where(eq(invitations.id, id)).limit(1),
    db.select(responseColumns).from(rsvps).where(eq(rsvps.invitationId, id)).limit(1),
    db.select({ id: invitationEvents.id, type: invitationEvents.type, channel: invitationEvents.channel, meta: invitationEvents.meta, createdAt: invitationEvents.createdAt })
      .from(invitationEvents).where(eq(invitationEvents.invitationId, id)).orderBy(desc(invitationEvents.createdAt), desc(invitationEvents.id)).limit(200),
  ])
  if (!rows[0] || !tokens[0]) return null
  return { ...rows[0], response: responses[0] ? toResponse(responses[0]) : null, token: decryptToken(tokens[0].tokenEnc), events }
}

export async function createInvitation(input: GuestInput, guestListId: number | null = null): Promise<number> {
  const issued = issueToken()
  try {
    const [row] = await getInviteDb().insert(invitations).values({
      guestName: input.guestName, email: input.email, phone: input.phone, seats: input.seats,
      tokenHash: issued.tokenHash, tokenEnc: issued.tokenEnc, guestListId,
    }).returning({ id: invitations.id })
    await logEvent(row.id, 'created')
    return row.id
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateContactError()
    throw error
  }
}

export interface BulkResult {
  created: number
  skipped: { guestName: string; reason: string }[]
}

/** Adds guests one by one so a duplicate skips that guest only, never the whole list. */
export async function createInvitations(inputs: readonly GuestInput[], guestListIds: readonly (number | null)[] = []): Promise<BulkResult> {
  const result: BulkResult = { created: 0, skipped: [] }
  for (const [index, input] of inputs.entries()) {
    try {
      await createInvitation(input, guestListIds[index] ?? null)
      result.created += 1
    } catch (error) {
      if (!(error instanceof DuplicateContactError)) throw error
      result.skipped.push({ guestName: input.guestName, reason: error.message })
    }
  }
  return result
}

export async function editInvitation(id: number, input: GuestInput): Promise<boolean> {
  try {
    const rows = await getInviteDb().update(invitations)
      .set({ guestName: input.guestName, email: input.email, phone: input.phone, seats: input.seats, updatedAt: new Date() })
      .where(eq(invitations.id, id)).returning({ id: invitations.id })
    if (!rows[0]) return false
    await logEvent(id, 'edited')
    return true
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateContactError()
    throw error
  }
}

export async function setInvitationStatus(id: number, status: 'active' | 'revoked'): Promise<boolean> {
  const rows = await getInviteDb().update(invitations).set({ status, updatedAt: new Date() })
    .where(eq(invitations.id, id)).returning({ id: invitations.id })
  if (!rows[0]) return false
  await logEvent(id, status === 'revoked' ? 'revoked' : 'restored')
  return true
}

/** Issues a new link. The old link stops working at once because its hash is replaced. */
export async function regenerateInvitation(id: number): Promise<boolean> {
  const issued = issueToken()
  const rows = await getInviteDb().update(invitations)
    .set({ tokenHash: issued.tokenHash, tokenEnc: issued.tokenEnc, sentAt: null, lastChannel: null, updatedAt: new Date() })
    .where(eq(invitations.id, id)).returning({ id: invitations.id })
  if (!rows[0]) return false
  await logEvent(id, 'regenerated')
  return true
}

export async function recordShare(id: number, channel: ShareChannel, type: InviteEventType = 'shared', meta: string | null = null): Promise<boolean> {
  const now = new Date()
  const rows = await getInviteDb().update(invitations).set({ sentAt: now, lastChannel: channel, linkRequestedAt: null, updatedAt: now })
    .where(eq(invitations.id, id)).returning({ id: invitations.id })
  if (!rows[0]) return false
  await logEvent(id, type, channel, meta)
  return true
}

export type DeleteOutcome = 'deleted' | 'not_found' | 'has_response'

/** An invitation that already has an RSVP can be revoked but never deleted. */
export async function deleteInvitation(id: number): Promise<DeleteOutcome> {
  const db = getInviteDb()
  const linked = await db.select({ id: rsvps.id }).from(rsvps).where(eq(rsvps.invitationId, id)).limit(1)
  if (linked[0]) return 'has_response'
  const rows = await db.delete(invitations).where(eq(invitations.id, id)).returning({ id: invitations.id })
  return rows[0] ? 'deleted' : 'not_found'
}

export async function loadSettingsForAdmin(): Promise<InviteSettings> {
  const rows = await getInviteDb().select({ data: inviteSettings.data }).from(inviteSettings).limit(1)
  return parseInviteSettings(rows[0]?.data)
}

export async function saveSettings(input: unknown): Promise<InviteSettings> {
  const settings = inviteSettingsSchema.parse(input)
  const db = getInviteDb()
  const data = JSON.stringify(settings)
  const existing = await db.select({ id: inviteSettings.id }).from(inviteSettings).orderBy(asc(inviteSettings.id)).limit(1)
  if (existing[0]) {
    await db.update(inviteSettings).set({ data, updatedAt: new Date() }).where(eq(inviteSettings.id, existing[0].id))
  } else {
    await db.insert(inviteSettings).values({ data })
  }
  return settings
}

/** Copies allowed guests from the older email list that do not have an invitation yet. Reads guest_list only. */
export async function importFromGuestList(): Promise<BulkResult> {
  const db = getInviteDb()
  const allowed = await db.select({ id: guestList.id, email: guestList.email, name: guestList.name, seats: guestList.seats })
    .from(guestList).where(eq(guestList.status, 'allow')).orderBy(asc(guestList.id))
  if (!allowed.length) return { created: 0, skipped: [] }
  const existing = await db.select({ email: invitations.email }).from(invitations)
    .where(inArray(invitations.email, allowed.map(guest => guest.email)))
  const taken = new Set(existing.map(row => row.email))
  const fresh = allowed.filter(guest => !taken.has(guest.email))
  return createInvitations(
    fresh.map(guest => ({ guestName: guest.name?.trim() || guest.email.split('@')[0], email: guest.email, phone: null, seats: guest.seats })),
    fresh.map(guest => guest.id),
  )
}
