'use client'

import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { ATTENDANCE_LABEL, type Person } from '@/lib/seating/people'
import { splitNames, suggestPeople } from '@/lib/seating/suggest'

export interface SeatedPerson {
  chair: number
  /** Missing when the seat is held by a guest no longer on the list. */
  person: Person | null
  unseat: () => void
}

interface NameFieldProps {
  tableLabel: string
  seated: readonly SeatedPerson[]
  /** Everyone who could be seated here: on the list and not already at this table. */
  candidates: readonly Person[]
  /** Person key to the table they sit at now, for people seated elsewhere. */
  seatOf: ReadonlyMap<string, string>
  full: boolean
  /** Seats the person at this table. Returns false when the table refuses. */
  onSeat: (key: string) => boolean
}

/**
 * Seat people by typing. Each person at the table is a pill; type a name and
 * pick a suggestion, or type a comma, and it becomes a pill too.
 */
export function NameField({ tableLabel, seated, candidates, seatOf, full, onSeat }: NameFieldProps) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const [problem, setProblem] = useState('')
  const listId = useId()
  const suggestions = useMemo(() => suggestPeople(text, candidates), [text, candidates])
  const highlighted = Math.min(active, Math.max(0, suggestions.length - 1))

  /** Seats the best match for each finished name. Names that match nobody stay in the box. */
  const seatNames = (names: readonly string[], typing: string) => {
    let pool = [...candidates]
    const unknown: string[] = []
    for (const name of names) {
      const match = suggestPeople(name, pool, 1)[0]
      if (!match) { unknown.push(name); continue }
      if (!onSeat(match.key)) { unknown.push(name); break }
      pool = pool.filter(person => person.key !== match.key)
    }
    setProblem(unknown.length ? `No guest found for ${unknown.map(name => `“${name}”`).join(', ')}.` : '')
    setText([...unknown, typing].filter(Boolean).join(', '))
    setActive(0)
  }
  const choose = (person: Person) => { if (onSeat(person.key)) { setText(''); setProblem('') } setActive(0) }

  const onChange = (value: string) => {
    const { finished, typing } = splitNames(value)
    if (finished.length) seatNames(finished, typing)
    else { setText(value); setProblem(''); setActive(0) }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(highlighted + 1, suggestions.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(highlighted - 1, 0)) }
    else if (event.key === 'Enter') {
      event.preventDefault()
      if (suggestions[highlighted]) choose(suggestions[highlighted])
      else if (text.trim()) setProblem(`No guest found for “${text.trim()}”.`)
    } else if (event.key === 'Escape' && text) { event.stopPropagation(); setText(''); setProblem('') }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-black/[0.045] p-2 focus-within:ring-2 focus-within:ring-black/20">
        {seated.map(({ chair, person, unseat }) => {
          const away = person && (person.attendance === 'declined' || person.attendance === 'not_coming')
          return (
            <span key={chair} title={person ? ATTENDANCE_LABEL[person.attendance] : 'This seat is still held'}
              className={clsx('inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-3 pr-1 text-[14px]', away || !person ? 'bg-[#F6D9D5] text-[#8C1D18]' : 'bg-[#2E1F1A] text-white')}>
              <span className={clsx('truncate', away && 'line-through')}>{person?.name ?? 'A guest no longer on the list'}</span>
              <button type="button" onClick={unseat} aria-label={`Take ${person?.name ?? 'this seat'} off ${tableLabel}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current">
                <X size={14} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </span>
          )
        })}
        <input
          value={text}
          onChange={event => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={full}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={`Type a name to seat at ${tableLabel}`}
          placeholder={full ? 'This table is full' : seated.length ? 'Add another name' : 'Type a name, then a comma'}
          autoComplete="off"
          className="min-w-[150px] flex-1 bg-transparent px-1.5 py-1 text-[16px] text-black/85 outline-none placeholder:text-black/40"
        />
      </div>
      {suggestions.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Matching guests" className="mt-1.5 overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
          {suggestions.map((person, index) => (
            <li key={person.key} role="option" aria-selected={index === highlighted}>
              <button type="button" onClick={() => choose(person)} onMouseEnter={() => setActive(index)}
                className={clsx('flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left', index === highlighted && 'bg-black/[0.07]')}>
                <span className="min-w-0 truncate text-[15px] text-black/85">{person.name}</span>
                <span className="shrink-0 text-[12px] text-black/45">{seatOf.has(person.key) ? `Moves from ${seatOf.get(person.key)}` : ATTENDANCE_LABEL[person.attendance]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 min-h-[18px] text-[13px] leading-snug text-black/50" role="status" aria-live="polite">
        {problem || (full ? 'Add a chair to seat someone else.' : 'A comma or Enter seats the best match. Paste a list of names separated by commas to seat several.')}
      </p>
    </div>
  )
}
