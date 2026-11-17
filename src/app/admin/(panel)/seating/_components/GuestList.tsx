'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical, Search, X } from 'lucide-react'
import { ATTENDANCE_LABEL, type Person } from '@/lib/seating/people'
import { Segmented, inputClass } from '@/app/admin/_ui/primitives'
import { dragId } from './api'

type ListFilter = 'unseated' | 'seated' | 'all'

const FILTERS: readonly { value: ListFilter; label: string }[] = [
  { value: 'unseated', label: 'Unseated' },
  { value: 'seated', label: 'Seated' },
  { value: 'all', label: 'All' },
]

interface PersonRowProps {
  person: Person
  tableLabel: string | null
  selected: boolean
  draggable: boolean
  onSelect: (key: string) => void
  onUnseat: (key: string) => void
}

function PersonRow({ person, tableLabel, selected, draggable, onSelect, onUnseat }: PersonRowProps) {
  const drag = useDraggable({ id: dragId.person(person.key), disabled: !draggable })
  const away = person.attendance === 'declined' || person.attendance === 'not_coming'
  return (
    <li className={clsx('flex items-center border-t border-black/[0.07] first:border-t-0', selected && 'bg-black/[0.06]', drag.isDragging && 'opacity-40')}>
      <button
        ref={drag.setNodeRef}
        type="button"
        {...drag.listeners}
        {...drag.attributes}
        onClick={() => onSelect(person.key)}
        aria-pressed={selected}
        className={clsx('flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-2 pr-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black/50', draggable && 'cursor-grab active:cursor-grabbing')}
      >
        <GripVertical size={16} aria-hidden="true" className="shrink-0 text-black/25" />
        <span className="min-w-0">
          <span className={clsx('block truncate text-[15px]', away ? 'text-black/45 line-through' : 'text-black/85', person.index > 0 && 'pl-3')}>{person.name}</span>
          <span className={clsx('block truncate text-[12px] text-black/45', person.index > 0 && 'pl-3')}>
            {ATTENDANCE_LABEL[person.attendance]}{tableLabel ? ` · ${tableLabel}` : ''}
          </span>
        </span>
      </button>
      {tableLabel && (
        <button type="button" onClick={() => onUnseat(person.key)} aria-label={`Take ${person.name} off ${tableLabel}`} title="Take off the table"
          className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/45 hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50">
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

interface GuestListProps {
  people: readonly Person[]
  /** Person key to the label of the table they sit at. */
  seatOf: ReadonlyMap<string, string>
  selectedKey: string | null
  draggable: boolean
  onSelect: (key: string) => void
  onUnseat: (key: string) => void
}

/** Everyone invited, one entry per person. Drag a name to a table, or tap a name and then a table. */
export function GuestList({ people, seatOf, selectedKey, draggable, onSelect, onUnseat }: GuestListProps) {
  const [filter, setFilter] = useState<ListFilter>('unseated')
  const [query, setQuery] = useState('')
  const drop = useDroppable({ id: dragId.list })
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return people.filter(person => {
      const seated = seatOf.has(person.key)
      if (filter === 'unseated' && seated) return false
      if (filter === 'seated' && !seated) return false
      return !needle || person.name.toLowerCase().includes(needle) || (person.hostName ?? '').toLowerCase().includes(needle)
    })
  }, [people, seatOf, filter, query])

  return (
    <section ref={drop.setNodeRef} aria-label="Guests to seat"
      className={clsx('flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-white', drop.isOver && 'outline outline-2 -outline-offset-2 outline-black/50')}>
      <div className="shrink-0 space-y-2 p-2.5">
        <div className="relative">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/35" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names" aria-label="Search names" className={clsx(inputClass, 'py-2 pl-9')} />
        </div>
        <Segmented value={filter} options={FILTERS} onChange={setFilter} label="Which guests to list" />
        <p className="px-1 text-[13px] tabular-nums text-black/50">{seatOf.size} of {people.length} seated</p>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-black/[0.07]">
        {visible.map(person => (
          <PersonRow key={person.key} person={person} tableLabel={seatOf.get(person.key) ?? null} selected={selectedKey === person.key}
            draggable={draggable} onSelect={onSelect} onUnseat={onUnseat} />
        ))}
        {!visible.length && (
          <li className="px-4 py-10 text-center text-[14px] text-black/45">
            {people.length === 0 ? 'Add guests in Invitations and they will appear here.' : filter === 'unseated' && !query ? 'Everyone has a seat.' : 'No names match.'}
          </li>
        )}
      </ul>
    </section>
  )
}
