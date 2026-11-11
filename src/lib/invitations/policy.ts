import { z } from 'zod'

export const MAX_SEATS = 20

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MANILA_OFFSET_HOURS = 8

/**
 * The CMS stores the deadline as text ("January 27, 2027" or "2027-01-27").
 * Returns the instant the deadline day ends in Manila, or null when the text
 * is not a recognisable date (then no deadline is enforced).
 */
export function deadlineInstant(text: string | null | undefined): number | null {
  if (!text) return null
  const value = text.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const long = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(value)
  let year: number
  let month: number
  let day: number
  if (iso) {
    year = Number(iso[1])
    month = Number(iso[2]) - 1
    day = Number(iso[3])
  } else if (long) {
    const name = long[1].toLowerCase()
    month = MONTHS.findIndex(candidate => candidate === name || candidate.slice(0, 3) === name)
    if (month < 0) return null
    year = Number(long[3])
    day = Number(long[2])
  } else {
    return null
  }
  const check = new Date(Date.UTC(year, month, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month || check.getUTCDate() !== day) return null
  return Date.UTC(year, month, day + 1, -MANILA_OFFSET_HOURS)
}

export function isPastDeadline(text: string | null | undefined, now: number = Date.now()): boolean {
  const instant = deadlineInstant(text)
  return instant !== null && now >= instant
}

/** First word of the guest's name, used in greetings and link previews. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

/** "Plus" guests the couple granted: seats beyond the invited guest. */
export function plusCount(seats: number): number {
  return Math.max(0, seats - 1)
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(value => (value ? value : undefined))

export const inviteRsvpSchema = z.object({
  attending: z.enum(['yes', 'no']),
  partySize: z.number().int().min(1).max(MAX_SEATS).optional(),
  companions: z.array(z.string().trim().min(2, 'Please enter each guest\'s full name').max(255)).max(MAX_SEATS - 1).default([]),
  dietary: optionalText(500),
  songRequest: optionalText(255),
  message: optionalText(2000),
  acknowledged: z.literal(true, { errorMap: () => ({ message: 'Please confirm you have read the reminders.' }) }),
})

export type InviteRsvpInput = z.infer<typeof inviteRsvpSchema>

export interface InviteRsvpValues {
  attending: boolean
  partySize: number
  companions: string[]
  dietary?: string
  songRequest?: string
  message?: string
}

export type RsvpCheck =
  | { ok: true; values: InviteRsvpValues }
  | { ok: false; message: string }

/**
 * Server-side rules for a personal-link RSVP. `seats` is always the value
 * stored on the invitation, never anything the browser sent.
 */
export function checkInviteRsvp(input: InviteRsvpInput, seats: number): RsvpCheck {
  if (input.attending === 'no') {
    return { ok: true, values: { attending: false, partySize: 0, companions: [], dietary: input.dietary, songRequest: input.songRequest, message: input.message } }
  }
  const partySize = input.partySize ?? 1
  if (partySize > seats) {
    return { ok: false, message: `Your invitation includes ${seats} ${seats === 1 ? 'seat' : 'seats'}.` }
  }
  if (input.companions.length !== partySize - 1) {
    return { ok: false, message: 'Please name each guest you are bringing.' }
  }
  return {
    ok: true,
    values: { attending: true, partySize, companions: input.companions, dietary: input.dietary, songRequest: input.songRequest, message: input.message },
  }
}

export const INVITE_UNAVAILABLE = 'This invitation link is not active. Please contact us and we will help you.'
export const DEADLINE_PASSED = 'The RSVP deadline has passed. Please contact us for any changes.'
