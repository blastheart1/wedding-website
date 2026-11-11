import type { InviteRsvpValues } from './policy'

/** The invitation fields the guest flow needs. Never includes the token or its hash. */
export interface InvitationRecord {
  id: number
  guestName: string
  email: string | null
  seats: number
  status: string
  tokenHash: string
  firstOpenedAt: Date | null
  lastOpenedAt: Date | null
  respondedAt: Date | null
}

export interface RsvpRecord {
  id: number
  attending: boolean
  partySize: number | null
  companions: string[]
  dietary: string | null
  songRequest: string | null
  message: string | null
  updatedAt: Date | null
  createdAt: Date
}

/** Storage boundary for the guest flow, so the rules can be tested without a database. */
export interface InviteStore {
  findByTokenHash(tokenHash: string): Promise<InvitationRecord | null>
  findRsvp(invitation: InvitationRecord): Promise<RsvpRecord | null>
  saveRsvp(invitation: InvitationRecord, values: InviteRsvpValues, existing: RsvpRecord | null, now: Date): Promise<void>
  markResponded(invitationId: number, now: Date): Promise<void>
  recordOpen(invitationId: number, now: Date): Promise<void>
  recordEvent(invitationId: number, type: InviteEventType, channel?: string | null, meta?: string | null): Promise<void>
  deadlineText(): Promise<string | null>
}

export type InviteEventType =
  | 'created' | 'email_sent' | 'email_failed' | 'email_delivered' | 'email_bounced'
  | 'shared' | 'opened' | 'responded' | 'updated' | 'revoked' | 'restored'
  | 'regenerated' | 'link_requested' | 'change_requested' | 'edited'

/** What the guest page shows. Plain JSON so it can cross the server/client boundary. */
export interface InviteView {
  firstName: string
  guestName: string
  seats: number
  plus: number
  canEdit: boolean
  deadline: string
  response: {
    attending: boolean
    partySize: number
    companions: string[]
    dietary: string
    songRequest: string
    message: string
    submittedAt: string
  } | null
}

export interface ServiceResult<T> {
  status: number
  body: { success: true; data: T } | { success: false; error: string }
}
