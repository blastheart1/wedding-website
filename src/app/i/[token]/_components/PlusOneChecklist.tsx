'use client'

import { Check } from 'lucide-react'
import clsx from 'clsx'
import { Group, Row } from './ui'

interface PlusOneChecklistProps {
  /** The people the couple named for this invitation. */
  names: readonly string[]
  /** Positions in `names` of the people who are coming. */
  bringing: readonly number[]
  onChange: (next: number[]) => void
}

/**
 * The closed list of plus ones, as one big tappable row each. Anyone left
 * unticked gives up their seat; nobody outside the list can be added.
 */
export function PlusOneChecklist({ names, bringing, onChange }: PlusOneChecklistProps) {
  const ticked = new Set(bringing)
  const toggle = (position: number) => onChange(ticked.has(position) ? bringing.filter(item => item !== position) : [...bringing, position].sort((a, b) => a - b))
  const everyone = ticked.size === names.length
  return (
    <Group
      label="Who is coming with you?"
      footnote="Tick the guests you are bringing. Anyone you leave unticked gives up their seat, and the list is closed: no one else can be added."
    >
      <Row className="flex items-center justify-between gap-3">
        <p className="font-sans text-[15px] text-ink2" aria-live="polite">{ticked.size === 0 ? 'Just you so far' : `Bringing ${ticked.size} of ${names.length}`}</p>
        <button
          type="button"
          onClick={() => onChange(everyone ? [] : names.map((_name, position) => position))}
          className="min-h-[44px] rounded-full bg-[#F5F2EE] px-4 font-sans text-[15px] font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          {everyone ? 'Clear all' : 'Include everyone'}
        </button>
      </Row>
      {names.map((name, position) => (
        <Row key={name} className="!p-0">
          <label className="flex min-h-[56px] cursor-pointer items-center gap-4 px-4 py-2.5 active:bg-black/[0.03]">
            <input type="checkbox" className="peer sr-only" checked={ticked.has(position)} onChange={() => toggle(position)} />
            <span
              aria-hidden="true"
              className={clsx(
                'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink',
                ticked.has(position) ? 'bg-ink text-cream' : 'bg-[#EAE5DE] text-transparent',
              )}
            >
              <Check size={18} strokeWidth={3} />
            </span>
            <span className="min-w-0 break-words font-sans text-[17px] leading-snug text-ink">{name}</span>
          </label>
        </Row>
      ))}
    </Group>
  )
}
