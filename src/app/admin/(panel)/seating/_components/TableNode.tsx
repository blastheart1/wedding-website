'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CHAIR, chairPoints, clamp, snap, tableBox, tableReach } from '@/lib/seating/geometry'
import { ATTENDANCE_LABEL, personKey, type Person } from '@/lib/seating/people'
import type { Assignment, SeatingTable } from '@/lib/seating/rules'
import { dragId } from './api'
import { useFloorDrag } from './useFloorDrag'

export type FloorMode = 'seat' | 'arrange'

interface ChairProps {
  table: SeatingTable
  chair: number
  x: number
  y: number
  person: Person | null
  /** A seat held by someone no longer on the list. */
  leftover: boolean
  mode: FloorMode
  selectedKey: string | null
  onSelect: (key: string) => void
  onSeatHere: (tableId: number, chair: number) => void
}

/** One chair, drawn as a pill with the person's short name. Empty chairs take a drop or a tap. */
function Chair({ table, chair, x, y, person, leftover, mode, selectedKey, onSelect, onSeatHere }: ChairProps) {
  const seating = mode === 'seat'
  const drop = useDroppable({ id: dragId.chair(table.id, chair), disabled: !seating })
  const drag = useDraggable({ id: dragId.person(person?.key ?? `empty-${table.id}-${chair}`), disabled: !seating || !person })
  const away = person && (person.attendance === 'declined' || person.attendance === 'not_coming')
  const style = { left: x - CHAIR.width / 2, top: y - CHAIR.height / 2, width: CHAIR.width, height: CHAIR.height }
  const shared = 'absolute flex items-center justify-center rounded-full px-1.5 text-[11px] leading-none'

  if (!person) {
    return (
      <button
        ref={drop.setNodeRef}
        type="button"
        style={{ ...style, borderStyle: 'dashed' }}
        disabled={!seating}
        tabIndex={seating && selectedKey ? 0 : -1}
        onClick={event => { event.stopPropagation(); onSeatHere(table.id, chair) }}
        aria-label={leftover ? `Chair ${chair + 1} at ${table.label}, held by a removed guest` : `Empty chair ${chair + 1} at ${table.label}`}
        className={clsx(shared, 'border', drop.isOver ? 'border-black/60 bg-black/10' : leftover ? 'border-black/30 bg-[#F6D9D5] text-[#8C1D18]' : 'border-black/20 bg-white/60 text-black/30')}
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
      disabled={!seating}
      {...drag.listeners}
      {...drag.attributes}
      onClick={event => { event.stopPropagation(); onSelect(person.key) }}
      aria-label={`${person.name}, ${ATTENDANCE_LABEL[person.attendance]}, chair ${chair + 1} at ${table.label}`}
      aria-pressed={selectedKey === person.key}
      title={`${person.name} · ${ATTENDANCE_LABEL[person.attendance]}`}
      className={clsx(
        shared, 'touch-none select-none font-medium shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
        seating && 'cursor-grab active:cursor-grabbing',
        drag.isDragging && 'opacity-30',
        away ? 'bg-[#F6D9D5] text-[#8C1D18] line-through' : person.attendance === 'pending' ? 'bg-white text-black/60' : 'bg-[#2E1F1A] text-white',
        (selectedKey === person.key || drop.isOver) && 'outline outline-2 outline-offset-1 outline-black/70',
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
  mode: FloorMode
  zoom: number
  selectedKey: string | null
  onSelectPerson: (key: string) => void
  onSeat: (tableId: number, chair?: number) => void
  onOpen: (tableId: number) => void
  onMoved: (tableId: number, x: number, y: number) => void
}

/** A table on the floor with its chairs around it. Drawn with plain elements so it scales with the floor. */
export function TableNode({ table, seated, peopleByKey, room, mode, zoom, selectedKey, onSelectPerson, onSeat, onOpen, onMoved }: TableNodeProps) {
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const drop = useDroppable({ id: dragId.table(table.id), disabled: mode !== 'seat' })
  const box = tableBox(table.shape, table.chairs)
  const points = chairPoints(table.shape, table.chairs, table.rotation)
  const byChair = new Map(seated.map(assignment => [assignment.chair, assignment]))
  // A table and its chairs always stay inside the room.
  const reach = Math.min(tableReach(table.shape, table.chairs), Math.floor(Math.min(room.width, room.height) / 2))
  const place = (dx: number, dy: number) => ({ x: clamp(snap(table.x + dx), reach, room.width - reach), y: clamp(snap(table.y + dy), reach, room.height - reach) })
  const position = offset ? place(offset.x, offset.y) : { x: table.x, y: table.y }

  const drag = useFloorDrag({
    enabled: mode === 'arrange',
    zoom,
    onDrag: (dx, dy) => setOffset({ x: dx, y: dy }),
    onEnd: moved => {
      if (moved && offset) { const next = place(offset.x, offset.y); onMoved(table.id, next.x, next.y) } else onOpen(table.id)
      setOffset(null)
    },
  })
  const activate = () => { if (mode === 'arrange') return; if (selectedKey) onSeat(table.id); else onOpen(table.id) }

  return (
    <div className="absolute" style={{ left: position.x, top: position.y, zIndex: offset ? 5 : 1 }} data-seating-table={table.id}>
      <div
        ref={drop.setNodeRef}
        role="button"
        tabIndex={0}
        {...drag}
        onClick={mode === 'seat' ? activate : undefined}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (mode === 'arrange') onOpen(table.id); else activate() } }}
        aria-label={`${table.label}, ${seated.length} of ${table.chairs} seated${selectedKey ? '. Press to seat the chosen guest here' : '. Press to edit'}`}
        className={clsx(
          'absolute flex select-none items-center justify-center bg-white shadow-[0_1px_4px_rgba(0,0,0,0.16)] outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/60',
          table.shape === 'round' ? 'rounded-full' : 'rounded-[10px]',
          mode === 'arrange' ? 'cursor-move touch-none' : 'cursor-pointer',
          drop.isOver && 'outline outline-2 outline-black/70',
        )}
        style={{ left: -box.width / 2, top: -box.height / 2, width: box.width, height: box.height, transform: `rotate(${table.rotation}deg)` }}
      />
      {/* The label stays upright whatever way the table is turned. */}
      <div className="pointer-events-none absolute left-0 top-0 w-[160px] -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="truncate text-[13px] font-semibold leading-tight text-black/85">{table.label}</p>
        <p className="text-[11px] tabular-nums leading-tight text-black/45">{seated.length}/{table.chairs}</p>
      </div>
      {points.map((point, chair) => {
        const assignment = byChair.get(chair)
        const person = assignment ? peopleByKey.get(personKey(assignment.invitationId, assignment.index)) ?? null : null
        return (
          <Chair key={chair} table={table} chair={chair} x={point.x} y={point.y} person={person} leftover={Boolean(assignment) && !person}
            mode={mode} selectedKey={selectedKey} onSelect={onSelectPerson} onSeatHere={onSeat} />
        )
      })}
    </div>
  )
}
