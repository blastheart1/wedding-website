/**
 * The list of people to seat. Nobody is stored separately for seating: every
 * entry is worked out from an invitation (how many seats it holds) and its RSVP
 * (who is coming, and the names of the guests being brought).
 */

export interface SeatingInvitation {
  id: number
  guestName: string
  /** Seats including the invited guest: 1 = solo, 3 = guest plus two. */
  seats: number
  status: string
  response: { attending: boolean; partySize: number; companions: string[] } | null
}

/** coming: said yes. pending: no reply yet. declined: said no. not_coming: a plus one the guest did not confirm. */
export type Attendance = 'coming' | 'pending' | 'declined' | 'not_coming'

export interface Person {
  /** `${invitationId}:${index}`: stable for as long as the invitation exists. */
  key: string
  invitationId: number
  /** 0 is the invited guest; 1 and up are their plus ones. */
  index: number
  /** Full line for lists: "Jazzer Santos", "Jazzer's plus one", or "Maria Cruz · Jazzer's plus one". */
  name: string
  /** Short form for a chair on the floor: "Jazzer", "Jazzer +1", "Maria". */
  shortName: string
  /** For a plus one, the invited guest they come with. */
  hostName: string | null
  attendance: Attendance
}

const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

export const personKey = (invitationId: number, index: number): string => `${invitationId}:${index}`

export function parsePersonKey(key: string): { invitationId: number; index: number } | null {
  const match = /^(\d{1,9}):(\d{1,2})$/.exec(key)
  return match ? { invitationId: Number(match[1]), index: Number(match[2]) } : null
}

const firstWord = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/** "Jazzer's plus one", "Jazzer's plus two". */
export function plusOneLabel(hostName: string, index: number): string {
  return `${firstWord(hostName)}'s plus ${COUNT_WORDS[index - 1] ?? index}`
}

function attendanceOf(invitation: SeatingInvitation, index: number): Attendance {
  const response = invitation.response
  if (!response) return 'pending'
  if (!response.attending) return 'declined'
  return index < response.partySize ? 'coming' : 'not_coming'
}

function personOf(invitation: SeatingInvitation, index: number): Person {
  const base = { key: personKey(invitation.id, index), invitationId: invitation.id, index, attendance: attendanceOf(invitation, index) }
  if (index === 0) {
    return { ...base, name: invitation.guestName.trim(), shortName: firstWord(invitation.guestName), hostName: null }
  }
  const label = plusOneLabel(invitation.guestName, index)
  // The guest names who they bring when they RSVP; until then the plus one is known only by its host.
  const named = invitation.response?.attending ? invitation.response.companions[index - 1]?.trim() : ''
  return {
    ...base,
    name: named ? `${named} · ${label}` : label,
    shortName: named ? firstWord(named) : `${firstWord(invitation.guestName)} +${index}`,
    hostName: invitation.guestName.trim(),
  }
}

/** Two people with the same short name get a last initial where they have one: "Ana S.", "Ana R." */
function distinctShortNames(people: readonly Person[]): Person[] {
  const counts = new Map<string, number>()
  for (const person of people) counts.set(person.shortName.toLowerCase(), (counts.get(person.shortName.toLowerCase()) ?? 0) + 1)
  return people.map(person => {
    if ((counts.get(person.shortName.toLowerCase()) ?? 0) < 2) return person
    const fullName = person.name.split(' · ')[0]
    const words = fullName.trim().split(/\s+/)
    // An unnamed plus one ("Jazzer's plus one") has no surname of its own to borrow from.
    if (words.length < 2 || (person.index > 0 && fullName === person.name)) return person
    return { ...person, shortName: `${person.shortName} ${words[words.length - 1][0].toUpperCase()}.` }
  })
}

/** Everyone on an active invitation: the guest first, then each of their plus ones, in the order invitations are given. */
export function buildPeople(invitations: readonly SeatingInvitation[]): Person[] {
  const people = invitations
    .filter(invitation => invitation.status === 'active')
    .flatMap(invitation => Array.from({ length: Math.max(1, invitation.seats) }, (_unused, index) => personOf(invitation, index)))
  return distinctShortNames(people)
}

export const ATTENDANCE_LABEL: Record<Attendance, string> = {
  coming: 'Coming',
  pending: 'No reply yet',
  declined: 'Declined',
  not_coming: 'Not coming',
}
