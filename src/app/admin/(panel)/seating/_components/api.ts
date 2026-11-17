import type { SeatingInvitation } from '@/lib/seating/people'
import type { Assignment, SeatingTable, SeatTarget, TableShape } from '@/lib/seating/rules'
import type { SeatingPlan } from '@/lib/seating/schemas'

/** Client-side calls for the seat plan. Every call resolves to data or throws an Error whose message is safe to show. */

export interface SeatingData {
  tables: SeatingTable[]
  assignments: Assignment[]
  plan: SeatingPlan
  invitations: SeatingInvitation[]
}

export interface TableDraft {
  label?: string
  shape?: TableShape
  chairs?: number
  x?: number
  y?: number
  rotation?: number
}

const BASE = '/api/admin/seating'

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  if (response.status === 401) {
    window.location.assign('/admin/login')
    throw new Error('Please sign in again.')
  }
  const json: { success?: boolean; data?: T; error?: string } = await response.json().catch(() => ({}))
  if (!json.success) throw new Error(json.error ?? 'Something went wrong. Please try again.')
  return json.data as T
}

export const seatingApi = {
  load: () => call<SeatingData>(''),
  addTable: (table: TableDraft & { x: number; y: number }) => call<SeatingTable>('', 'POST', table),
  updateTable: (id: number, changes: TableDraft) => call<{ table: SeatingTable; assignments: Assignment[] }>('', 'PATCH', { id, ...changes }),
  removeTable: (id: number) => call<{ id: number }>('', 'DELETE', { id }),
  move: (invitationId: number, index: number, target: SeatTarget) =>
    call<{ assignments: Assignment[] }>('/assign', 'POST', { invitationId, index, target }),
  savePlan: (plan: SeatingPlan) => call<SeatingPlan>('/plan', 'PUT', plan),
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

/** Ids the floor uses for dragging and dropping. */
export const dragId = {
  person: (key: string) => `person:${key}`,
  table: (id: number) => `table:${id}`,
  chair: (tableId: number, chair: number) => `chair:${tableId}:${chair}`,
  list: 'list',
}

export type DropTarget = { kind: 'list' } | { kind: 'table'; tableId: number } | { kind: 'chair'; tableId: number; chair: number }

export function parseDrop(id: string): DropTarget | null {
  if (id === dragId.list) return { kind: 'list' }
  const table = /^table:(\d+)$/.exec(id)
  if (table) return { kind: 'table', tableId: Number(table[1]) }
  const chair = /^chair:(\d+):(\d+)$/.exec(id)
  return chair ? { kind: 'chair', tableId: Number(chair[1]), chair: Number(chair[2]) } : null
}

export const parseDraggedPerson = (id: string): string | null => (id.startsWith('person:') ? id.slice('person:'.length) : null)
