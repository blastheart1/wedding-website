import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { buildPeople, parsePersonKey, type Person } from '@/lib/seating/people'
import { movePerson, nextTableLabel, resizeTable, type Assignment, type SeatingTable, type SeatTarget, type TableShape } from '@/lib/seating/rules'
import type { SeatingPlan } from '@/lib/seating/schemas'
import { errorMessage, seatingApi, type SeatingData, type TableDraft } from './api'

export interface SeatingPlanState {
  data: SeatingData | null
  people: Person[]
  loading: boolean
  error: string
  /** Read out by screen readers after each change. */
  announcement: string
  move: (key: string, target: SeatTarget) => boolean
  addTable: (x: number, y: number, shape?: TableShape) => void
  updateTable: (id: number, changes: TableDraft) => void
  removeTable: (id: number) => void
  savePlan: (plan: SeatingPlan) => void
}

/**
 * The seat plan's data and every change to it. The screen updates first; the
 * save follows, one at a time and in order. If a save is refused, the message
 * is shown and the plan is read again from the server, which always has the
 * final say.
 */
export function useSeatingPlan(): SeatingPlanState {
  const [data, setData] = useState<SeatingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const latest = useRef<SeatingData | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const waiting = useRef(0)
  const pendingLabels = useRef<string[]>([])

  const put = useCallback((next: SeatingData) => { latest.current = next; setData(next) }, [])

  const reload = useCallback(async () => {
    try {
      put(await seatingApi.load())
      setError('')
    } catch (problem) {
      setError(errorMessage(problem))
    } finally {
      setLoading(false)
    }
  }, [put])

  useEffect(() => { reload() }, [reload])

  /**
   * Runs saves one after another. `settle` merges the server's answer once nothing newer is
   * waiting, so an older answer never overwrites a newer change. `always` is for answers
   * that add something the screen does not have yet (a new table and its id).
   */
  const save = useCallback(<T,>(send: () => Promise<T>, settle?: (current: SeatingData, result: T) => SeatingData, always = false) => {
    waiting.current += 1
    queue.current = queue.current.then(async () => {
      try {
        const result = await send()
        waiting.current -= 1
        if (settle && (always || waiting.current === 0) && latest.current) put(settle(latest.current, result))
      } catch (problem) {
        waiting.current -= 1
        toast.error(errorMessage(problem))
        if (waiting.current === 0) await reload()
      }
    })
  }, [put, reload])

  const people = useMemo(() => buildPeople(data?.invitations ?? []), [data?.invitations])

  const move = useCallback((key: string, target: SeatTarget): boolean => {
    const current = latest.current
    const person = parsePersonKey(key)
    if (!current || !person) return false
    const result = movePerson(current.tables, current.assignments, person, target)
    if (!result.ok) { toast.error(result.message); setAnnouncement(result.message); return false }
    if (!result.changed.length) return true
    put({ ...current, assignments: result.assignments })
    const name = buildPeople(current.invitations).find(candidate => candidate.key === key)?.name ?? 'Guest'
    const table = target && current.tables.find(candidate => candidate.id === target.tableId)
    setAnnouncement(table ? `${name} seated at ${table.label}.` : `${name} taken off the table.`)
    save(() => seatingApi.move(person.invitationId, person.index, target), (state, answer) => ({ ...state, assignments: answer.assignments }))
    return true
  }, [put, save])

  const addTable = useCallback((x: number, y: number, shape: TableShape = 'round') => {
    const current = latest.current
    if (!current) return
    // Numbered after the tables on screen and the ones still on their way to the server.
    const label = nextTableLabel([...current.tables, ...pendingLabels.current.map(pending => ({ label: pending }))])
    pendingLabels.current = [...pendingLabels.current, label]
    // A couple's table starts with two chairs; the others with the usual ten.
    save(() => seatingApi.addTable({ label, x, y, shape, ...(shape === 'couple' ? { chairs: 2 } : {}) }).finally(() => { pendingLabels.current = pendingLabels.current.filter(pending => pending !== label) }), (state, table: SeatingTable) => ({ ...state, tables: [...state.tables, table] }), true)
    setAnnouncement(`${label} added.`)
  }, [save])

  const updateTable = useCallback((id: number, changes: TableDraft) => {
    const current = latest.current
    const table = current?.tables.find(candidate => candidate.id === id)
    if (!current || !table) return
    let assignments: Assignment[] = current.assignments
    if (changes.chairs !== undefined) {
      const resized = resizeTable(table, changes.chairs, current.assignments)
      if (!resized.ok) { toast.error(resized.message); setAnnouncement(resized.message); return }
      assignments = resized.assignments
    }
    put({ ...current, assignments, tables: current.tables.map(candidate => (candidate.id === id ? { ...candidate, ...changes } : candidate)) })
    save(() => seatingApi.updateTable(id, changes), (state, answer) => ({
      ...state,
      assignments: answer.assignments,
      tables: state.tables.map(candidate => (candidate.id === id ? answer.table : candidate)),
    }))
  }, [put, save])

  const removeTable = useCallback((id: number) => {
    const current = latest.current
    if (!current) return
    put({ ...current, tables: current.tables.filter(table => table.id !== id), assignments: current.assignments.filter(assignment => assignment.tableId !== id) })
    save(() => seatingApi.removeTable(id))
    setAnnouncement('Table deleted. Its guests are back on the list.')
  }, [put, save])

  const savePlan = useCallback((plan: SeatingPlan) => {
    const current = latest.current
    if (!current) return
    put({ ...current, plan })
    save(() => seatingApi.savePlan(plan))
  }, [put, save])

  return { data, people, loading, error, announcement, move, addTable, updateTable, removeTable, savePlan }
}
