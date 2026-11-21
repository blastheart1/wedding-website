/**
 * Named plus ones. The couple names the people each guest may bring; the guest
 * ticks the ones who are coming. The list is closed: nobody outside it can be
 * added, and a seat that is not ticked is given up.
 *
 * A plus one is identified by its position in the list, which never changes
 * for as long as the list is not edited. The RSVP stores the ticked names, and
 * a name is only ever in a list once, so a name and a position mean the same.
 */

export const MAX_PLUS_ONES = 19
const NAME_MIN = 2
const NAME_MAX = 255

export const CLOSED_LIST_MESSAGE = 'Please choose from the guests on your invitation.'

const squash = (name: string): string => name.trim().replace(/\s+/g, ' ')
const same = (a: string, b: string): boolean => squash(a).toLowerCase() === squash(b).toLowerCase()

/** The stored list. Anything unreadable is an empty list, which means a plain, unnamed invitation. */
export function parsePlusOnes(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(squash).filter(Boolean) : []
  } catch {
    return []
  }
}

/** What goes in the database: null for no list, so invitations without plus ones stay as they were. */
export const serialisePlusOnes = (names: readonly string[]): string | null => (names.length ? JSON.stringify(names) : null)

export type NamesCheck = { ok: true; names: string[] } | { ok: false; message: string }

/** Cleans a typed list of plus ones: tidy spacing, no blanks, no one twice, no one with the guest's own name. */
export function checkPlusOnes(input: readonly string[], guestName = ''): NamesCheck {
  const names = input.map(squash).filter(Boolean)
  if (names.length > MAX_PLUS_ONES) return { ok: false, message: `A guest can have up to ${MAX_PLUS_ONES} plus ones.` }
  for (const [index, name] of names.entries()) {
    if (name.length < NAME_MIN) return { ok: false, message: `"${name}" is too short. Please use the person's name.` }
    if (name.length > NAME_MAX) return { ok: false, message: 'That name is too long.' }
    if (guestName && same(name, guestName)) return { ok: false, message: `${name} is the guest. Plus ones are the other people on the invitation.` }
    if (names.findIndex(other => same(other, name)) !== index) return { ok: false, message: `${name} is listed twice on one invitation.` }
  }
  return { ok: true, names }
}

/** A named list decides the seats: the guest and everyone named. Without one, the seat count stands as given. */
export const seatsFor = (plusOnes: readonly string[], seats: number): number => (plusOnes.length ? plusOnes.length + 1 : seats)

/** The positions in the list of the people named in an RSVP's ticked names. */
export function bringingPositions(plusOnes: readonly string[], companions: readonly string[]): number[] {
  return plusOnes.flatMap((name, position) => (companions.some(ticked => same(ticked, name)) ? [position] : []))
}

export type Chosen = { ok: true; positions: number[]; companions: string[] } | { ok: false; message: string }

/**
 * What a guest ticked, as positions in the stored list. Only whole, distinct
 * positions inside the list are accepted, so nothing a browser sends can add a
 * person. The names come from the list, never from the request.
 */
export function choosePlusOnes(plusOnes: readonly string[], bringing: unknown): Chosen {
  if (bringing === undefined || bringing === null) return { ok: true, positions: [], companions: [] }
  if (!Array.isArray(bringing) || bringing.length > plusOnes.length) return { ok: false, message: CLOSED_LIST_MESSAGE }
  const positions: number[] = []
  for (const item of bringing as unknown[]) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item >= plusOnes.length || positions.includes(item)) {
      return { ok: false, message: CLOSED_LIST_MESSAGE }
    }
    positions.push(item)
  }
  positions.sort((a, b) => a - b)
  return { ok: true, positions, companions: positions.map(position => plusOnes[position]) }
}

/** Splits a typed or pasted list of names on commas, semicolons and new lines. */
export const splitNames = (text: string): string[] => text.split(/[,;\n]/).map(squash).filter(Boolean)

export type PastedPlusOnes = { ok: true; names: string[] } | { ok: false; message: string }

/**
 * Plus ones as written in the couple's own list: "2: Jennelle Manait, Penelope Molina",
 * or just names. A leading count is checked against the names, so a slip in the
 * list is caught instead of quietly giving a guest the wrong number of seats.
 */
export function parsePastedPlusOnes(text: string): PastedPlusOnes {
  const counted = /^\s*(\d{1,2})\s*:\s*([\s\S]*)$/.exec(text)
  const names = splitNames(counted ? counted[2] : text)
  if (counted && Number(counted[1]) !== names.length) {
    return { ok: false, message: `The list says ${counted[1]} plus ${Number(counted[1]) === 1 ? 'one' : 'ones'} but names ${names.length}.` }
  }
  return { ok: true, names }
}
