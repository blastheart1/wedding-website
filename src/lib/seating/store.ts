import { and, asc, eq, isNotNull, or } from 'drizzle-orm'
import { getInviteDb, schema } from '@/lib/invitations/db'
import { parsePlusOnes } from '@/lib/invitations/plus-ones'
import { SeatingError } from './errors'
import { buildGuestSeating, type GuestSeating } from './guest-view'
import type { SeatingInvitation } from './people'
import {
  movePerson, nextTableLabel, resizeTable, type Assignment, type PersonRef, type SeatingTable, type TableShape,
} from './rules'
import { parsePlan, planSchema, type MoveInput, type SeatingPlan, type TableCreateInput, type TableUpdateInput } from './schemas'

const { invitations, rsvps, seatingAssignments, seatingPlan, seatingTables } = schema

const tableColumns = {
  id: seatingTables.id,
  label: seatingTables.label,
  shape: seatingTables.shape,
  chairs: seatingTables.chairs,
  x: seatingTables.x,
  y: seatingTables.y,
  rotation: seatingTables.rotation,
}

const assignmentColumns = {
  invitationId: seatingAssignments.invitationId,
  index: seatingAssignments.personIndex,
  tableId: seatingAssignments.tableId,
  chair: seatingAssignments.chair,
}

type TableRow = Omit<SeatingTable, 'shape'> & { shape: string }

const toTable = (row: TableRow): SeatingTable => ({ ...row, shape: row.shape as TableShape })

export interface SeatingData {
  tables: SeatingTable[]
  assignments: Assignment[]
  plan: SeatingPlan
  invitations: SeatingInvitation[]
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

async function listTables(): Promise<SeatingTable[]> {
  const rows = await getInviteDb().select(tableColumns).from(seatingTables).orderBy(asc(seatingTables.id))
  return rows.map(toTable)
}

async function listAssignments(): Promise<Assignment[]> {
  return getInviteDb().select(assignmentColumns).from(seatingAssignments).orderBy(asc(seatingAssignments.tableId), asc(seatingAssignments.chair))
}

async function loadPlan(): Promise<SeatingPlan> {
  const rows = await getInviteDb().select({ data: seatingPlan.data }).from(seatingPlan).orderBy(asc(seatingPlan.id)).limit(1)
  return parsePlan(rows[0]?.data)
}

/** Reads `invitations` and `rsvps` only; nothing in them is ever written from here. */
async function listSeatingInvitations(): Promise<SeatingInvitation[]> {
  const db = getInviteDb()
  const [rows, responses] = await Promise.all([
    db.select({ id: invitations.id, guestName: invitations.guestName, seats: invitations.seats, plusOnes: invitations.plusOnes, status: invitations.status })
      .from(invitations).orderBy(asc(invitations.guestName), asc(invitations.id)),
    db.select({ invitationId: rsvps.invitationId, attending: rsvps.attending, partySize: rsvps.partySize, companions: rsvps.companions })
      .from(rsvps).where(isNotNull(rsvps.invitationId)),
  ])
  const byInvitation = new Map(responses.map(row => [row.invitationId, {
    attending: row.attending,
    partySize: row.partySize ?? (row.attending ? 1 : 0),
    companions: parseCompanions(row.companions),
  }]))
  return rows.map(row => ({ ...row, plusOnes: parsePlusOnes(row.plusOnes), response: byInvitation.get(row.id) ?? null }))
}

export async function loadSeating(): Promise<SeatingData> {
  const [tables, assignments, plan, people] = await Promise.all([listTables(), listAssignments(), loadPlan(), listSeatingInvitations()])
  return { tables, assignments, plan, invitations: people }
}

export async function createTable(input: TableCreateInput): Promise<SeatingTable> {
  const label = input.label ?? nextTableLabel(await listTables())
  const [row] = await getInviteDb().insert(seatingTables)
    .values({ label, shape: input.shape, chairs: input.chairs, x: input.x, y: input.y, rotation: input.rotation })
    .returning(tableColumns)
  return toTable(row)
}

const isPerson = (person: PersonRef) =>
  and(eq(seatingAssignments.invitationId, person.invitationId), eq(seatingAssignments.personIndex, person.index))

/**
 * Replaces the seats of the people who changed, as one transaction: their old
 * rows go first, so a swap never trips the one-person-per-chair index.
 */
function seatWrites(changed: readonly PersonRef[], next: readonly Assignment[]) {
  const db = getInviteDb()
  const rows = next.filter(assignment => changed.some(person => person.invitationId === assignment.invitationId && person.index === assignment.index))
  return [
    ...(changed.length ? [db.delete(seatingAssignments).where(or(...changed.map(isPerson)))] : []),
    ...(rows.length ? [db.insert(seatingAssignments).values(rows.map(row => ({ invitationId: row.invitationId, personIndex: row.index, tableId: row.tableId, chair: row.chair })))] : []),
  ]
}

type BatchInput = Parameters<ReturnType<typeof getInviteDb>['batch']>[0]

async function runTogether(writes: readonly unknown[]): Promise<void> {
  if (writes.length) await getInviteDb().batch(writes as unknown as BatchInput)
}

/** Changes a table. Fewer chairs than people seated is refused; nobody is ever unseated by an edit. */
export async function updateTable(input: TableUpdateInput): Promise<{ table: SeatingTable; assignments: Assignment[] }> {
  const [tables, assignments] = await Promise.all([listTables(), listAssignments()])
  const table = tables.find(candidate => candidate.id === input.id)
  if (!table) throw new SeatingError('That table no longer exists.', 404)
  const { id, ...changes } = input
  const fields = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
  const resized = resizeTable(table, input.chairs ?? table.chairs, assignments)
  if (!resized.ok) throw new SeatingError(resized.message)
  await runTogether([
    ...seatWrites(resized.changed, resized.assignments),
    getInviteDb().update(seatingTables).set({ ...fields, updatedAt: new Date() }).where(eq(seatingTables.id, id)),
  ])
  return { table: { ...table, ...fields } as SeatingTable, assignments: await listAssignments() }
}

/** Removes a table. Its people go back on the list (their seats are removed with it). */
export async function deleteTable(id: number): Promise<boolean> {
  const rows = await getInviteDb().delete(seatingTables).where(eq(seatingTables.id, id)).returning({ id: seatingTables.id })
  return rows.length > 0
}

/** Seats, moves, swaps or unseats one person. Every rule is rechecked here against what is stored. */
export async function moveSeat(input: MoveInput): Promise<Assignment[]> {
  const db = getInviteDb()
  const person: PersonRef = { invitationId: input.invitationId, index: input.index }
  const [tables, assignments] = await Promise.all([listTables(), listAssignments()])
  if (input.target) {
    // Taking a seat needs a real, active invitation that includes this person. Giving one up never does.
    const rows = await db.select({ seats: invitations.seats, status: invitations.status }).from(invitations).where(eq(invitations.id, input.invitationId)).limit(1)
    if (!rows[0] || rows[0].status !== 'active') throw new SeatingError('That guest is no longer on the list.', 404)
    if (input.index >= rows[0].seats) throw new SeatingError('That invitation does not include this seat any more.')
  }
  const moved = movePerson(tables, assignments, person, input.target)
  if (!moved.ok) throw new SeatingError(moved.message)
  await runTogether(seatWrites(moved.changed, moved.assignments))
  return listAssignments()
}

export async function savePlan(input: unknown): Promise<SeatingPlan> {
  const plan = planSchema.parse(input)
  const db = getInviteDb()
  const data = JSON.stringify(plan)
  const existing = await db.select({ id: seatingPlan.id }).from(seatingPlan).orderBy(asc(seatingPlan.id)).limit(1)
  if (existing[0]) {
    await db.update(seatingPlan).set({ data, updatedAt: new Date() }).where(eq(seatingPlan.id, existing[0].id))
  } else {
    await db.insert(seatingPlan).values({ data })
  }
  return plan
}

export interface GuestSeatingRequest {
  invitation: { id: number; seats: number; plusOnes?: string[] }
  response: { attending: boolean; partySize: number; companions: string[] } | null
}

/**
 * What one guest may see. An unpublished plan costs a single small query and
 * shows nothing; the caller treats any failure the same way.
 */
export async function findGuestSeating({ invitation, response }: GuestSeatingRequest): Promise<GuestSeating | null> {
  const plan = await loadPlan()
  if (!plan.published) return null
  const [tables, assignments] = await Promise.all([
    listTables(),
    getInviteDb().select(assignmentColumns).from(seatingAssignments).where(eq(seatingAssignments.invitationId, invitation.id)),
  ])
  return buildGuestSeating({ plan, tables, assignments, invitation, response })
}
