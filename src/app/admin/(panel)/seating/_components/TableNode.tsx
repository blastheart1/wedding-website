'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import clsx from 'clsx'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { RotateCw } from 'lucide-react'
import { CHAIR, chairPoints, clamp, rotatePoint, snap, tableBox, tableReach } from '@/lib/seating/geometry'
import { ATTENDANCE_LABEL, personKey, type Person } from '@/lib/seating/people'
import { settleRotation, type Assignment, type SeatingTable } from '@/lib/seating/rules'
import { dragId } from './api'
import { useFloorDrag } from './useFloorDrag'

interface ChairProps {
  table: SeatingTable
  chair: number
  x: number
  y: number
  person: Person | null
  /** A seat held by someone no longer on the list. */
  leftover: boolean
  selectedKey: string | null
  onSelect: (key: string) => void
  onSeatHere: (tableId: number, chair: number) => void
}

/** One chair, drawn as a pill with the person's short name. Empty chairs take a drop or a tap. */
function Chair({ table, chair, x, y, person, leftover, selectedKey, onSelect, onSeatHere }: ChairProps) {
  const drop = useDroppable({ id: dragId.chair(table.id, chair) })
  const drag = useDraggable({ id: dragId.person(person?.key ?? `empty-${table.id}-${chair}`), disabled: !person })
  const away = person && (person.attendance === 'declined' || person.attendance === 'not_coming')
  const style = { left: x - CHAIR.width / 2, top: y - CHAIR.height / 2, width: CHAIR.width, height: CHAIR.height }
  const shared = 'absolute flex items-center justify-center rounded-full border px-1.5 text-[11px] leading-none'

  if (!person) {
    return (
      <button
        ref={drop.setNodeRef}
        type="button"
        style={{ ...style, borderStyle: 'dashed' }}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); onSeatHere(table.id, chair) }}
        aria-label={leftover ? `Chair ${chair + 1} at ${table.label}, held by a removed guest` : `Empty chair ${chair + 1} at ${table.label}`}
        className={clsx(shared, 'transition-colors', drop.isOver ? 'border-black/90 bg-black/20' : leftover ? 'border-black/40 bg-[#F6D9D5] text-[#8C1D18]' : 'border-black/45 bg-white/85 text-black/40 hover:bg-white')}
      >
        {leftover ? 'Held' : ''}
      </button>
    )
  }
  return (
    <button
      ref={node => { drop.setNodeRef(node); drag.setNodeRef(node) }}
      type="button"
      style={style}
      {...drag.listeners}
      {...drag.attributes}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); onSelect(person.key) }}
      aria-label={`${person.name}, ${ATTENDANCE_LABEL[person.attendance]}, chair ${chair + 1} at ${table.label}`}
      aria-pressed={selectedKey === person.key}
      title={`${person.name} · ${ATTENDANCE_LABEL[person.attendance]}`}
      className={clsx(
        shared, 'cursor-grab touch-none select-none font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.25)] active:cursor-grabbing',
        drag.isDragging && 'opacity-30',
        away ? 'border-black/20 bg-[#F6D9D5] text-[#8C1D18] line-through' : person.attendance === 'pending' ? 'border-black/55 bg-white text-black/85' : 'border-black/0 bg-[#2E1F1A] text-white',
        (selectedKey === person.key || drop.isOver) && 'outline outline-2 outline-offset-1 outline-black',
      )}
    >
      <span className="truncate">{person.shortName}</span>
    </button>
  )
}

interface TableNodeProps {
  table: SeatingTable
  seated: readonly Assignment[]
  peopleByKey: ReadonlyMap<string, Person>
  room: { width: number; height: number }
  /** Locked: tables cannot be moved or turned, only seated at. */
  locked: boolean
  zoom: number
  selectedKey: string | null
  onSelectPerson: (key: string) => void
  onSeat: (tableId: number, chair?: number) => void
  onOpen: (tableId: number) => void
  onMoved: (tableId: number, x: number, y: number) => void
  onTurned: (tableId: number, rotation: number) => void
}

const HANDLE_GAP = 26

/**
 * A table on the floor with its chairs around it. Drag the table to move it,
 * drag the round handle to turn it, click it to open it. Drawn with plain
 * elements so it scales with the floor.
 */
export function TableNode({ table, seated, peopleByKey, room, locked, zoom, selectedKey, onSelectPerson, onSeat, onOpen, onMoved, onTurned }: TableNodeProps) {
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const [turning, setTurning] = useState<number | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const drop = useDroppable({ id: dragId.table(table.id) })
  const rotation = turning ?? table.rotation
  const box = tableBox(table.shape, table.chairs)
  const points = chairPoints(table.shape, table.chairs, rotation)
  const byChair = new Map(seated.map(assignment => [assignment.chair, assignment]))
  // A table and its chairs always stay inside the room.
  const reach = Math.min(tableReach(table.shape, table.chairs), Math.floor(Math.min(room.width, room.height) / 2))
  const place = (dx: number, dy: number) => ({ x: clamp(snap(table.x + dx), reach, room.width - reach), y: clamp(snap(table.y + dy), reach, room.height - reach) })
  const position = offset ? place(offset.x, offset.y) : { x: table.x, y: table.y }
  const activate = () => { if (selectedKey) onSeat(table.id); else onOpen(table.id) }

  const drag = useFloorDrag({
    enabled: !locked,
    zoom,
    onDrag: (dx, dy) => setOffset({ x: dx, y: dy }),
    onEnd: moved => {
      if (moved && offset) { const next = place(offset.x, offset.y); onMoved(table.id, next.x, next.y) } else activate()
      setOffset(null)
    },
  })

  // Turning: the handle follows the pointer around the table's centre.
  const angleTo = (event: ReactPointerEvent) => {
    const centre = anchor.current?.getBoundingClientRect()
    if (!centre) return table.rotation
    return settleRotation((Math.atan2(event.clientY - centre.top, event.clientX - centre.left) * 180) / Math.PI + 90)
  }
  const turn = {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setTurning(table.rotation) },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => { if (turning !== null) setTurning(angleTo(event)) },
    onPointerUp: () => { if (turning !== null && turning !== table.rotation) onTurned(table.id, turning); setTurning(null) },
    onPointerCancel: () => setTurning(null),
  }
  const handle = rotatePoint({ x: 0, y: -(box.height / 2 + CHAIR.height + 16 + HANDLE_GAP) }, rotation)

  return (
    <div ref={anchor} className="group absolute" style={{ left: position.x, top: position.y, zIndex: offset || turning !== null ? 5 : 1 }} data-seating-table={table.id} data-floor-item="true">
      <div
        ref={drop.setNodeRef}
        role="button"
        tabIndex={0}
        {...drag}
        onClick={locked ? activate : undefined}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate() } }}
        aria-label={`${table.label}, ${seated.length} of ${table.chairs} seated${selectedKey ? '. Press to seat the chosen guest here' : '. Press to open'}`}
        className={clsx(
          'absolute flex select-none items-center justify-center bg-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.22)] outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black',
          table.shape === 'round' ? 'rounded-full' : 'rounded-[10px]',
          locked ? 'cursor-pointer' : 'cursor-move touch-none',
          drop.isOver && 'bg-[#EFE7DF] outline outline-[3px] outline-black',
        )}
        style={{ left: -box.width / 2, top: -box.height / 2, width: box.width, height: box.height, transform: `rotate(${rotation}deg)` }}
      />
      {/* The label stays upright whatever way the table is turned. */}
      <div className="pointer-events-none absolute left-0 top-0 w-[160px] -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="truncate text-[14px] font-bold leading-tight text-black/90">{table.label}</p>
        <p className="text-[12px] font-medium tabular-nums leading-tight text-black/60">{turning !== null ? `${turning}°` : `${seated.length}/${table.chairs}`}</p>
      </div>
      {points.map((point, chair) => {
        const assignment = byChair.get(chair)
        const person = assignment ? peopleByKey.get(personKey(assignment.invitationId, assignment.index)) ?? null : null
        return (
          <Chair key={chair} table={table} chair={chair} x={point.x} y={point.y} person={person} leftover={Boolean(assignment) && !person}
            selectedKey={selectedKey} onSelect={onSelectPerson} onSeatHere={onSeat} />
        )
      })}
      {!locked && table.shape !== 'round' && (
        <button
          type="button"
          {...turn}
          onClick={event => event.stopPropagation()}
          tabIndex={-1}
          aria-label={`Turn ${table.label}. Drag around the table`}
          title="Drag to turn"
          data-seating-turn={table.id}
          style={{ left: handle.x - 13, top: handle.y - 13 }}
          className={clsx(
            'absolute flex h-[26px] w-[26px] cursor-grab touch-none items-center justify-center rounded-full bg-[#2E1F1A] text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-opacity active:cursor-grabbing',
            turning !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
          )}
        >
          <RotateCw size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
