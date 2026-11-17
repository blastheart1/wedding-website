'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Lock, LockOpen, Plus, Ruler } from 'lucide-react'
import { contentBounds, snap, viewToFit, type FloorView } from '@/lib/seating/geometry'
import { personKey, type Person } from '@/lib/seating/people'
import { seatedAt, seatingWarnings, unseatedCount, type TableShape } from '@/lib/seating/rules'
import type { FloorShape } from '@/lib/seating/schemas'
import { Button, Group, Row, Segmented } from '@/app/admin/_ui/primitives'
import { LoadState, ToggleRow } from '@/app/admin/_ui/forms'
import { IconButton, PageHeader } from '@/app/admin/_ui/PageHeader'
import { parseDraggedPerson, parseDrop } from './api'
import { Floor, ZOOM, type FloorHandle, type FloorSpot } from './Floor'
import { FloorMenu } from './FloorMenu'
import { GuestList } from './GuestList'
import { RoomOutline, RoomSheet } from './Room'
import { ShapeNode } from './ShapeNode'
import { ShapeSheet } from './ShapeSheet'
import { TableNode } from './TableNode'
import { TableSheet } from './TableSheet'
import { useSeatingPlan } from './useSeatingPlan'

// The 3D hall is heavy and only wanted on request, so it is loaded when first opened.
const Venue3D = dynamic(() => import('./Venue3D').then(module => module.Venue3D), {
  ssr: false,
  loading: () => <p className="flex h-full items-center justify-center rounded-xl bg-[#D3D5DD] text-[15px] text-black/55">Building the hall…</p>,
})

type Look = 'plan' | '3d'
const LOOKS: readonly { value: Look; label: string }[] = [
  { value: 'plan', label: 'Plan' },
  { value: '3d', label: '3D hall' },
]

/** Tables added with the plus button are placed at least this far from the others, so they never land on one another. */
const NEW_TABLE_GAP = 340

/** Remembers on this device whether the layout was locked. */
const LOCK_KEY = 'seat-plan-layout-locked'

type Panel = { kind: 'table'; id: number } | { kind: 'shape'; id: string } | { kind: 'room' } | null

const newShapeId = () => `shape-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** The seat plan: a list of names beside an open floor of tables. Drag a name to a chair, or click a table and type names. */
export function SeatingView() {
  const plan = useSeatingPlan()
  const { data, people } = plan
  const [look, setLook] = useState<Look>('plan')
  // Locked: tables and shapes stay where they are, so seating cannot nudge the layout by accident.
  const [locked, setLocked] = useState(false)
  const [menu, setMenu] = useState<FloorSpot | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [view, setView] = useState<FloorView>({ x: 0, y: 0, zoom: 1 })
  const floor = useRef<FloorHandle>(null)
  const centred = useRef(false)
  const recentSpots = useRef<{ x: number; y: number }[]>([])

  useEffect(() => { try { setLocked(window.localStorage.getItem(LOCK_KEY) === '1') } catch { /* private window: stays unlocked */ } }, [])
  const toggleLock = () => setLocked(current => { try { window.localStorage.setItem(LOCK_KEY, current ? '0' : '1') } catch { /* not remembered */ } return !current })
  const closeMenu = useCallback(() => setMenu(null), [])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press before a finger drag, so the list still scrolls normally.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const peopleByKey = useMemo(() => new Map(people.map(person => [person.key, person])), [people])
  const seatOf = useMemo(() => {
    const labels = new Map((data?.tables ?? []).map(table => [table.id, table.label]))
    return new Map((data?.assignments ?? [])
      .filter(assignment => peopleByKey.has(personKey(assignment.invitationId, assignment.index)))
      .map(assignment => [personKey(assignment.invitationId, assignment.index), labels.get(assignment.tableId) ?? 'a table']))
  }, [data, peopleByKey])
  const warnings = useMemo(() => (data ? seatingWarnings(data.invitations, people, data.tables, data.assignments) : []), [data, people])
  const unseated = useMemo(() => unseatedCount(people, data?.assignments ?? []), [people, data])

  /** Centres on the room and everything on the floor, zoomed to fit but never past full size. */
  const centre = useCallback(() => {
    const frame = floor.current?.frame()
    if (!data || !frame) return
    const room = { x: data.plan.room.width / 2, y: data.plan.room.height / 2, width: data.plan.room.width, height: data.plan.room.height }
    setView(viewToFit(contentBounds(data.tables, [...data.plan.shapes, room]), frame, { min: ZOOM.min, max: 1 }))
  }, [data])
  // Open centred on the plan. Runs once the floor is on screen (and again when coming back from the 3D hall).
  useEffect(() => { if (data && look === 'plan' && !centred.current && floor.current) { centred.current = true; centre() } }, [data, look, centre])
  useEffect(() => { if (look !== 'plan') centred.current = false }, [look])

  /** The middle of what is currently visible on the floor, in floor units. */
  const visibleCentre = () => {
    const frame = floor.current?.frame() ?? { width: 0, height: 0 }
    return { x: snap((frame.width / 2 - view.x) / view.zoom), y: snap((frame.height / 2 - view.y) / view.zoom) }
  }

  const select = (key: string) => setSelectedKey(current => (current === key ? null : key))
  const seatSelected = (tableId: number, chair?: number) => {
    if (!selectedKey) { setPanel({ kind: 'table', id: tableId }); return }
    if (plan.move(selectedKey, { tableId, chair })) setSelectedKey(null)
  }
  const onDragStart = (event: DragStartEvent) => { setDraggingKey(parseDraggedPerson(String(event.active.id))); setSelectedKey(null) }
  const onDragEnd = (event: DragEndEvent) => {
    setDraggingKey(null)
    const key = parseDraggedPerson(String(event.active.id))
    const target = event.over ? parseDrop(String(event.over.id)) : null
    if (!key || !target) return
    if (target.kind === 'list') { if (seatOf.has(key)) plan.move(key, null); return }
    plan.move(key, target.kind === 'chair' ? { tableId: target.tableId, chair: target.chair } : { tableId: target.tableId })
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Seat plan" />
        <LoadState loading={plan.loading} error={plan.error} />
      </>
    )
  }

  const { room, shapes } = data.plan
  const saveShapes = (next: FloorShape[]) => plan.savePlan({ ...data.plan, shapes: next })
  const addShape = (at?: { x: number; y: number }) => {
    const spot = at ?? visibleCentre()
    const shape: FloorShape = { id: newShapeId(), label: 'Stage', x: snap(spot.x), y: snap(spot.y), width: 260, height: 100 }
    saveShapes([...shapes, shape])
    setPanel({ kind: 'shape', id: shape.id })
  }
  const addTable = (shape: TableShape = 'round', at?: { x: number; y: number }) => {
    // Where the floor was clicked, or else the middle of what is on screen; then step along until clear of other tables.
    const start = at ?? visibleCentre()
    const origin = { x: snap(start.x), y: snap(start.y) }
    // Tables asked for a moment ago may not be back from the server yet, so their spots are remembered too.
    const spots = [...data.tables, ...recentSpots.current]
    const taken = (x: number, y: number) => spots.some(table => Math.hypot(table.x - x, table.y - y) < (at ? 40 : NEW_TABLE_GAP))
    let spot = origin
    for (let step = 1; taken(spot.x, spot.y) && step <= 40; step += 1) {
      spot = { x: origin.x + (step % 5) * NEW_TABLE_GAP, y: origin.y + Math.floor(step / 5) * NEW_TABLE_GAP }
    }
    recentSpots.current = [...recentSpots.current.slice(-8), spot]
    plan.addTable(spot.x, spot.y, shape)
  }
  const openTable = panel?.kind === 'table' ? data.tables.find(table => table.id === panel.id) : undefined
  const openShape = panel?.kind === 'shape' ? shapes.find(shape => shape.id === panel.id) : undefined
  const selected: Person | undefined = selectedKey ? peopleByKey.get(selectedKey) : undefined
  const dragging = draggingKey ? peopleByKey.get(draggingKey) : undefined

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDraggingKey(null)}>
      {/* On a wide screen the page is exactly one screen tall, so the floor gets every pixel that is left. */}
      <div className="flex flex-col md:h-[calc(100dvh-2.5rem)] md:min-h-[560px]">
        <PageHeader title="Seat plan" subtitle={`${data.tables.length} ${data.tables.length === 1 ? 'table' : 'tables'} · ${seatOf.size} of ${people.length} seated`}>
          <div className="w-[170px]"><Segmented value={look} options={LOOKS} onChange={setLook} label="How to look at the room" /></div>
          <IconButton icon={Ruler} label="Room size" onClick={() => setPanel({ kind: 'room' })} />
          <IconButton icon={locked ? Lock : LockOpen} label={locked ? 'Layout is locked. Unlock to move tables' : 'Lock the layout so tables cannot be moved'} onClick={toggleLock} />
          <IconButton icon={Plus} label="Add a table" tone="primary" onClick={() => addTable()} />
        </PageHeader>

        <div className="mt-3 overflow-hidden rounded-xl bg-white">
          <ToggleRow label="Show tables to guests"
            hint={`${unseated ? `${unseated} ${unseated === 1 ? 'guest still has' : 'guests still have'} no seat.` : 'Everyone who may come has a seat.'} ${data.plan.published
              ? 'Guests see their own table and a map of the room on their invitation page, never other guests’ names.'
              : 'Guests see nothing about seating until you turn this on.'}`}
            checked={data.plan.published} onChange={published => plan.savePlan({ ...data.plan, published })} />
        </div>

        <p className="mt-2 min-h-[20px] text-[14px] text-black/60" role="status" aria-live="polite">
          {look === '3d'
            ? 'Drag to look around the hall, scroll to move closer. Tables follow the plan.'
            : selected
              ? `Click a table or an empty chair to seat ${selected.name}.`
              : locked
                ? 'Drag a name onto a table, or click a table and type names. The layout is locked.'
                : 'Drag a name onto a table, or click a table and type names. Drag a table to move it, drag empty floor to move around, click empty floor to add a table.'}
        </p>
        <p className="sr-only" role="status" aria-live="polite">{plan.announcement}</p>

        {/* Side by side on a wide screen. On a phone the floor sits above the list, both in view at once. */}
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
          <div className="order-2 h-[46dvh] min-h-[300px] shrink-0 md:order-1 md:h-auto md:min-h-0 md:w-[290px]">
            <GuestList people={people} seatOf={seatOf} selectedKey={selectedKey} draggable={look === 'plan'} onSelect={select} onUnseat={key => plan.move(key, null)} />
          </div>
          <div className="order-1 h-[52dvh] min-h-[320px] min-w-0 md:order-2 md:h-auto md:min-h-0 md:flex-1">
            {look === '3d' ? (
              <Venue3D room={room} tables={data.tables} assignments={data.assignments} shapes={shapes} />
            ) : (
              <Floor ref={floor} view={view} onView={setView} onCentre={centre}
                onBlankClick={spot => { if (selectedKey) setSelectedKey(null); else setMenu(spot) }}
                overlay={<>
                  {menu && (
                    <FloorMenu left={menu.left} top={menu.top} onClose={closeMenu}
                      onAddTable={shape => { addTable(shape, menu); setMenu(null) }}
                      onAddShape={() => { addShape(menu); setMenu(null) }} />
                  )}
                  {!data.tables.length && !menu && (
                    <p className="pointer-events-none absolute inset-x-0 top-6 text-center text-[16px] text-black/65">The room is empty. Click anywhere on the floor to add a table.</p>
                  )}
                </>}>
                <RoomOutline room={room} />
                {shapes.map(shape => (
                  <ShapeNode key={shape.id} shape={shape} locked={locked} zoom={view.zoom} onOpen={id => setPanel({ kind: 'shape', id })}
                    onChange={next => saveShapes(shapes.map(item => (item.id === next.id ? next : item)))} />
                ))}
                {data.tables.map(table => (
                  <TableNode key={table.id} table={table} seated={seatedAt(data.assignments, table.id)} peopleByKey={peopleByKey} locked={locked} zoom={view.zoom}
                    selectedKey={selectedKey} onSelectPerson={select} onSeat={seatSelected} onOpen={id => setPanel({ kind: 'table', id })}
                    onMoved={(id, x, y) => plan.updateTable(id, { x, y })} onTurned={(id, rotation) => plan.updateTable(id, { rotation })} />
                ))}
              </Floor>
            )}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <Group label="Worth a look" footnote="Nothing is changed for you. Seats are only ever taken away by you.">
          {warnings.map(warning => (
            <Row key={`${warning.kind}-${warning.person.invitationId}-${warning.person.index}-${warning.tableId}`} className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[15px] text-black/80">{warning.message}</p>
              <span className="flex shrink-0 gap-2">
                {warning.kind !== 'split' && <Button className="px-3 py-1.5 text-[14px]" onClick={() => plan.move(personKey(warning.person.invitationId, warning.person.index), null)}>Free the seat</Button>}
                {warning.tableId !== null && <Button className="px-3 py-1.5 text-[14px]" onClick={() => setPanel({ kind: 'table', id: warning.tableId as number })}>Open table</Button>}
              </span>
            </Row>
          ))}
        </Group>
      )}

      <DragOverlay dropAnimation={null}>
        {dragging && <div className="pointer-events-none inline-flex max-w-[240px] rounded-full bg-[#2E1F1A] px-3 py-1.5 text-[14px] font-medium text-white shadow-[0_6px_18px_rgba(0,0,0,0.3)]"><span className="truncate">{dragging.name}</span></div>}
      </DragOverlay>

      {openTable && (
        <TableSheet
          table={openTable}
          seated={seatedAt(data.assignments, openTable.id).map(assignment => {
            const key = personKey(assignment.invitationId, assignment.index)
            return { chair: assignment.chair, person: peopleByKey.get(key) ?? null, unseat: () => plan.move(key, null) }
          })}
          candidates={people.filter(person => !seatedAt(data.assignments, openTable.id).some(assignment => personKey(assignment.invitationId, assignment.index) === person.key))}
          seatOf={seatOf}
          onSeat={key => plan.move(key, { tableId: openTable.id })}
          onChange={changes => plan.updateTable(openTable.id, changes)}
          onDelete={() => { setPanel(null); plan.removeTable(openTable.id) }}
          onClose={() => setPanel(null)}
        />
      )}
      {openShape && (
        <ShapeSheet shape={openShape} onChange={next => saveShapes(shapes.map(item => (item.id === next.id ? next : item)))}
          onDelete={() => { setPanel(null); saveShapes(shapes.filter(item => item.id !== openShape.id)) }} onClose={() => setPanel(null)} />
      )}
      {panel?.kind === 'room' && <RoomSheet room={room} onChange={next => plan.savePlan({ ...data.plan, room: next })} onClose={() => setPanel(null)} />}
    </DndContext>
  )
}
