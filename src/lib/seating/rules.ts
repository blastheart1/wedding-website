import { personKey, type Person, type SeatingInvitation } from './people'

/** The rules of the seat plan. Pure: the admin screen and the server both run them, and the server's answer is final. */

export const TABLE_SHAPES = ['round', 'rect', 'square', 'couple'] as const
export type TableShape = (typeof TABLE_SHAPES)[number]

export const SHAPE_LABEL: Record<TableShape, string> = {
  round: 'Round',
  rect: 'Long',
  square: 'Square',
  couple: "Couple's",
}

export const CHAIRS = { min: 1, max: 24, start: 10 } as const
export const ROTATION_STEP = 15

export interface SeatingTable {
  id: number
  label: string
  shape: TableShape
  chairs: number
  /** Centre of the table on the floor, in floor units. */
  x: number
  y: number
  /** Degrees clockwise, in steps of 15. */
  rotation: number
}

export interface Assignment {
  invitationId: number
  /** 0 is the invited guest; 1 and up are their plus ones. */
  index: number
  tableId: number
  /** 0-based chair at the table. */
  chair: number
}

export interface PersonRef {
  invitationId: number
  index: number
}

/** Where a person is being put: a table (next free chair), a particular chair, or back on the list. */
export type SeatTarget = { tableId: number; chair?: number } | null

export type MoveResult =
  | { ok: true; assignments: Assignment[]; changed: PersonRef[] }
  | { ok: false; message: string }

const samePerson = (a: PersonRef, b: PersonRef): boolean => a.invitationId === b.invitationId && a.index === b.index

export function seatedAt(assignments: readonly Assignment[], tableId: number): Assignment[] {
  return assignments.filter(assignment => assignment.tableId === tableId).sort((a, b) => a.chair - b.chair)
}

/** The lowest-numbered empty chair, or null when the table is full. */
export function nextFreeChair(table: SeatingTable, assignments: readonly Assignment[]): number | null {
  const taken = new Set(seatedAt(assignments, table.id).map(assignment => assignment.chair))
  for (let chair = 0; chair < table.chairs; chair += 1) if (!taken.has(chair)) return chair
  return null
}

/**
 * Seats, moves, swaps or unseats one person and returns the whole new list.
 * Dropping onto someone else's chair swaps the two when the mover already had
 * a seat; a mover coming from the list takes the next free chair instead.
 */
export function movePerson(
  tables: readonly SeatingTable[], assignments: readonly Assignment[], person: PersonRef, target: SeatTarget,
): MoveResult {
  const current = assignments.find(assignment => samePerson(assignment, person)) ?? null
  const others = assignments.filter(assignment => !samePerson(assignment, person))
  if (target === null) {
    return { ok: true, assignments: others, changed: current ? [person] : [] }
  }
  const table = tables.find(candidate => candidate.id === target.tableId)
  if (!table) return { ok: false, message: 'That table no longer exists.' }
  if (target.chair !== undefined && (target.chair < 0 || target.chair >= table.chairs)) {
    return { ok: false, message: 'That chair is not at this table.' }
  }
  const seat = (chair: number): Assignment => ({ invitationId: person.invitationId, index: person.index, tableId: table.id, chair })
  const occupant = target.chair === undefined ? null : others.find(assignment => assignment.tableId === table.id && assignment.chair === target.chair) ?? null

  if (target.chair !== undefined && !occupant) {
    return { ok: true, assignments: [...others, seat(target.chair)], changed: [person] }
  }
  if (occupant && current) {
    // Swap: the person in that chair takes the mover's old seat.
    const swapped: Assignment = { ...occupant, tableId: current.tableId, chair: current.chair }
    return {
      ok: true,
      assignments: [...others.filter(assignment => !samePerson(assignment, occupant)), swapped, seat(occupant.chair)],
      changed: [person, { invitationId: occupant.invitationId, index: occupant.index }],
    }
  }
  if (current && current.tableId === table.id && target.chair === undefined) {
    return { ok: true, assignments: [...assignments], changed: [] }
  }
  const free = nextFreeChair(table, others)
  if (free === null) return { ok: false, message: `${table.label} is full.` }
  return { ok: true, assignments: [...others, seat(free)], changed: [person] }
}

export type ChairChange =
  | { ok: true; assignments: Assignment[]; changed: PersonRef[] }
  | { ok: false; message: string }

/**
 * Changing a table's chair count never unseats anyone. Fewer chairs than people
 * is refused; otherwise anyone left on a removed chair moves into a gap.
 */
export function resizeTable(table: SeatingTable, chairs: number, assignments: readonly Assignment[]): ChairChange {
  const seated = seatedAt(assignments, table.id)
  if (seated.length > chairs) {
    const people = seated.length === 1 ? '1 person is' : `${seated.length} people are`
    return { ok: false, message: `${people} seated at ${table.label}. Move someone before removing chairs.` }
  }
  const stranded = seated.filter(assignment => assignment.chair >= chairs)
  if (!stranded.length) return { ok: true, assignments: [...assignments], changed: [] }
  const taken = new Set(seated.filter(assignment => assignment.chair < chairs).map(assignment => assignment.chair))
  const moved = stranded.map(assignment => {
    let chair = 0
    while (taken.has(chair)) chair += 1
    taken.add(chair)
    return { ...assignment, chair }
  })
  const strandedKeys = new Set(stranded.map(assignment => personKey(assignment.invitationId, assignment.index)))
  return {
    ok: true,
    assignments: [...assignments.filter(assignment => !strandedKeys.has(personKey(assignment.invitationId, assignment.index))), ...moved],
    changed: moved.map(assignment => ({ invitationId: assignment.invitationId, index: assignment.index })),
  }
}

/** The next unused number: with "Table 1" and "Table 3" on the floor, the new one is "Table 4". */
export function nextTableLabel(tables: readonly Pick<SeatingTable, 'label'>[]): string {
  const numbers = tables.map(table => /^Table (\d{1,4})$/.exec(table.label.trim())).filter((match): match is RegExpExecArray => match !== null).map(match => Number(match[1]))
  return `Table ${Math.max(0, ...numbers) + 1}`
}

export type WarningKind = 'declined' | 'not_coming' | 'split' | 'leftover'

export interface SeatingWarning {
  kind: WarningKind
  message: string
  /** The table to look at, when there is one. */
  tableId: number | null
  /** The seat this is about; a leftover seat can be cleared with it. */
  person: PersonRef
}

/**
 * Things the couple should look at. Nothing here is fixed automatically:
 * a seat is only ever taken away by the person planning.
 */
export function seatingWarnings(
  invitations: readonly SeatingInvitation[], people: readonly Person[], tables: readonly SeatingTable[], assignments: readonly Assignment[],
): SeatingWarning[] {
  const byKey = new Map(people.map(person => [person.key, person]))
  const tableName = (id: number) => tables.find(table => table.id === id)?.label ?? 'a table'
  const warnings: SeatingWarning[] = []
  for (const assignment of assignments) {
    const ref = { invitationId: assignment.invitationId, index: assignment.index }
    const person = byKey.get(personKey(assignment.invitationId, assignment.index))
    if (!person) {
      const invitation = invitations.find(candidate => candidate.id === assignment.invitationId)
      const who = invitation ? `${invitation.guestName}'s invitation` : 'A removed invitation'
      warnings.push({ kind: 'leftover', tableId: assignment.tableId, person: ref, message: `${who} no longer includes a seat that is still held at ${tableName(assignment.tableId)}.` })
    } else if (person.attendance === 'declined') {
      warnings.push({ kind: 'declined', tableId: assignment.tableId, person: ref, message: `${person.name} declined but is still seated at ${tableName(assignment.tableId)}.` })
    } else if (person.attendance === 'not_coming') {
      warnings.push({ kind: 'not_coming', tableId: assignment.tableId, person: ref, message: `${person.name} is not coming but still has a seat at ${tableName(assignment.tableId)}.` })
    }
  }
  // A guest and their plus ones at different tables: often intended, so it is only pointed out.
  const tablesByInvitation = new Map<number, Set<number>>()
  for (const assignment of assignments) {
    const person = byKey.get(personKey(assignment.invitationId, assignment.index))
    if (!person || person.attendance === 'declined' || person.attendance === 'not_coming') continue
    tablesByInvitation.set(assignment.invitationId, (tablesByInvitation.get(assignment.invitationId) ?? new Set()).add(assignment.tableId))
  }
  for (const [invitationId, tableIds] of tablesByInvitation) {
    if (tableIds.size < 2) continue
    const host = byKey.get(personKey(invitationId, 0))
    const names = [...tableIds].map(tableName).join(' and ')
    warnings.push({ kind: 'split', tableId: [...tableIds][0], person: { invitationId, index: 0 }, message: `${host?.name ?? 'A guest'}'s party is split between ${names}.` })
  }
  return warnings
}

/** People who still need a chair: on the list, expected or possibly coming, and not seated. */
export function unseatedCount(people: readonly Person[], assignments: readonly Assignment[]): number {
  const seated = new Set(assignments.map(assignment => personKey(assignment.invitationId, assignment.index)))
  return people.filter(person => (person.attendance === 'coming' || person.attendance === 'pending') && !seated.has(person.key)).length
}
