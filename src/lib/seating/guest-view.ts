import type { Assignment, SeatingTable, TableShape } from './rules'
import type { SeatingPlan } from './schemas'

/**
 * What one guest may see of the seat plan: their own party's tables and an
 * outline of the room. Never another guest's name, and nothing at all until
 * the couple publishes the plan.
 */

export interface GuestSeat {
  /** "You", the named guest they are bringing, or "Your plus one". */
  who: string
  table: string
}

export interface GuestMapTable {
  label: string
  shape: TableShape
  chairs: number
  x: number
  y: number
  rotation: number
  /** Someone in this guest's party sits here. */
  mine: boolean
}

export interface GuestSeating {
  seats: GuestSeat[]
  map: {
    room: { width: number; height: number }
    tables: GuestMapTable[]
    shapes: { label: string; x: number; y: number; width: number; height: number }[]
  }
}

export interface GuestSeatingInput {
  plan: SeatingPlan
  tables: readonly SeatingTable[]
  /** Only this invitation's assignments. */
  assignments: readonly Assignment[]
  invitation: { id: number; seats: number }
  response: { attending: boolean; partySize: number; companions: string[] } | null
}

const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

function whoIs(index: number, plusOnes: number, companions: readonly string[]): string {
  if (index === 0) return 'You'
  const named = companions[index - 1]?.trim()
  if (named) return named
  return plusOnes === 1 ? 'Your plus one' : `Your plus ${COUNT_WORDS[index - 1] ?? index}`
}

export function buildGuestSeating(input: GuestSeatingInput): GuestSeating | null {
  const { plan, tables, invitation, response } = input
  if (!plan.published) return null
  if (response && !response.attending) return null
  // Before a reply everyone on the invitation may come; after it, only the confirmed party.
  const partySize = response ? response.partySize : invitation.seats
  const tableById = new Map(tables.map(table => [table.id, table]))
  const seated = input.assignments
    .filter(assignment => assignment.invitationId === invitation.id && assignment.index < Math.min(partySize, invitation.seats) && tableById.has(assignment.tableId))
    .sort((a, b) => a.index - b.index)
  if (!seated.length) return null
  const mine = new Set(seated.map(assignment => assignment.tableId))
  const plusOnes = Math.max(0, partySize - 1)
  return {
    seats: seated.map(assignment => ({
      who: whoIs(assignment.index, plusOnes, response?.companions ?? []),
      table: tableById.get(assignment.tableId)?.label ?? '',
    })),
    map: {
      room: plan.room,
      tables: tables.map(table => ({ label: table.label, shape: table.shape, chairs: table.chairs, x: table.x, y: table.y, rotation: table.rotation, mine: mine.has(table.id) })),
      shapes: plan.shapes.map(shape => ({ label: shape.label, x: shape.x, y: shape.y, width: shape.width, height: shape.height })),
    },
  }
}

const joinNames = (names: readonly string[]): string =>
  names.length < 2 ? names.join('') : names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/** One sentence per table: "You and Maria are at Table 7." */
export function seatingSentences(seats: readonly GuestSeat[]): string[] {
  const byTable = new Map<string, string[]>()
  for (const seat of seats) byTable.set(seat.table, [...(byTable.get(seat.table) ?? []), seat.who])
  return [...byTable].map(([table, names]) => {
    const single = names.length === 1 && names[0] !== 'You'
    return `${joinNames(names)} ${single ? 'is' : 'are'} at ${table}.`
  })
}
