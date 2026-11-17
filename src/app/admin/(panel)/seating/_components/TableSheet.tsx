'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, RotateCcw, RotateCw, X } from 'lucide-react'
import { ATTENDANCE_LABEL, type Person } from '@/lib/seating/people'
import { CHAIRS, ROTATION_STEP, SHAPE_LABEL, TABLE_SHAPES, type SeatingTable, type TableShape } from '@/lib/seating/rules'
import { ConfirmButton, Group, Row, Segmented, Sheet, inputClass, labelClass } from '@/app/admin/_ui/primitives'
import type { TableDraft } from './api'

const SHAPE_OPTIONS = TABLE_SHAPES.map(shape => ({ value: shape, label: SHAPE_LABEL[shape] }))
/** One press of a turn button. */
const TURN = ROTATION_STEP * 3

function RoundButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.06] text-black/70 disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50">
      {children}
    </button>
  )
}

/** A name field that saves when you leave it or press Enter, and puts the old name back if left empty. */
export function LabelField({ id, label, value, onSave }: { id: string; label: string; value: string; onSave: (value: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = () => {
    const next = text.trim()
    if (!next) { setText(value); return }
    if (next !== value) onSave(next)
  }
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} value={text} maxLength={40} onChange={event => setText(event.target.value)} onBlur={commit}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} className={inputClass} />
    </div>
  )
}

interface TableSheetProps {
  table: SeatingTable
  /** The people at this table, in chair order. A missing person is a seat held by a removed guest. */
  seated: readonly { chair: number; person: Person | null; unseat: () => void }[]
  onChange: (changes: TableDraft) => void
  onDelete: () => void
  onClose: () => void
}

/** Everything about one table: its name, type, chairs, direction and who sits there. */
export function TableSheet({ table, seated, onChange, onDelete, onClose }: TableSheetProps) {
  const turn = (by: number) => onChange({ rotation: (table.rotation + by + 360) % 360 })
  return (
    <Sheet title={table.label} onClose={onClose}>
      <Group>
        <Row><LabelField id="table-label" label="Name or number" value={table.label} onSave={label => onChange({ label })} /></Row>
        <Row>
          <p className={labelClass}>Type</p>
          <Segmented<TableShape> value={table.shape} options={SHAPE_OPTIONS} onChange={shape => onChange({ shape })} label="Table type" />
        </Row>
        <Row className="flex items-center justify-between gap-4">
          <span className="text-[16px] text-black/85">Chairs</span>
          <span className="flex items-center gap-3">
            <RoundButton label="One chair fewer" onClick={() => onChange({ chairs: table.chairs - 1 })} disabled={table.chairs <= Math.max(CHAIRS.min, seated.length)}><Minus size={18} aria-hidden="true" /></RoundButton>
            <span className="w-7 text-center text-[17px] font-semibold tabular-nums" aria-live="polite">{table.chairs}</span>
            <RoundButton label="One chair more" onClick={() => onChange({ chairs: table.chairs + 1 })} disabled={table.chairs >= CHAIRS.max}><Plus size={18} aria-hidden="true" /></RoundButton>
          </span>
        </Row>
        {table.shape !== 'round' && (
          <Row className="flex items-center justify-between gap-4">
            <span className="text-[16px] text-black/85">Turn</span>
            <span className="flex items-center gap-3">
              <RoundButton label="Turn left" onClick={() => turn(-TURN)}><RotateCcw size={18} aria-hidden="true" /></RoundButton>
              <RoundButton label="Turn right" onClick={() => turn(TURN)}><RotateCw size={18} aria-hidden="true" /></RoundButton>
            </span>
          </Row>
        )}
      </Group>

      <Group label={`Seated here · ${seated.length} of ${table.chairs}`} footnote={seated.length >= table.chairs ? 'This table is full. Add a chair to seat someone else.' : undefined}>
        {seated.map(({ chair, person, unseat }) => (
          <Row key={chair} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-[16px] text-black/85">{person?.name ?? 'A guest no longer on the list'}</span>
              <span className="block text-[13px] text-black/45">{person ? ATTENDANCE_LABEL[person.attendance] : 'This seat is still held'}</span>
            </span>
            <RoundButton label={`Take ${person?.name ?? 'this seat'} off the table`} onClick={unseat}><X size={18} aria-hidden="true" /></RoundButton>
          </Row>
        ))}
        {!seated.length && <Row><p className="text-[15px] text-black/45">Nobody yet. Drag a name onto the table, or tap a name and then the table.</p></Row>}
      </Group>

      <div className="mt-6 flex justify-end">
        <ConfirmButton confirmText={seated.length ? `Delete and return ${seated.length} to the list` : 'Tap again to delete'} onConfirm={onDelete}>Delete table</ConfirmButton>
      </div>
    </Sheet>
  )
}
