'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, RotateCcw, RotateCw } from 'lucide-react'
import type { Person } from '@/lib/seating/people'
import { CHAIRS, ROTATION_STEP, SHAPE_LABEL, TABLE_SHAPES, normaliseRotation, type SeatingTable, type TableShape } from '@/lib/seating/rules'
import { ConfirmButton, Group, Row, Segmented, Sheet, inputClass, labelClass } from '@/app/admin/_ui/primitives'
import type { TableDraft } from './api'
import { NameField, type SeatedPerson } from './NameField'

const SHAPE_OPTIONS = TABLE_SHAPES.map(shape => ({ value: shape, label: SHAPE_LABEL[shape] }))

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

/** A slider for the table's direction: any whole degree. It saves when let go, not on every step of the drag. */
function TurnSlider({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => { if (draft !== value) onSave(draft) }
  return (
    <input type="range" min={0} max={359} step={1} value={draft} aria-label="Direction in degrees"
      onChange={event => setDraft(Number(event.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit}
      className="h-8 min-w-0 flex-1 accent-[#2E1F1A]" />
  )
}

interface TableSheetProps {
  table: SeatingTable
  /** The people at this table, in chair order. */
  seated: readonly SeatedPerson[]
  /** Everyone who could be seated here: on the list and not already at this table. */
  candidates: readonly Person[]
  seatOf: ReadonlyMap<string, string>
  onSeat: (key: string) => boolean
  onChange: (changes: TableDraft) => void
  onDelete: () => void
  onClose: () => void
}

/** Everything about one table: who sits there, its name, type, chairs and direction. */
export function TableSheet({ table, seated, candidates, seatOf, onSeat, onChange, onDelete, onClose }: TableSheetProps) {
  const turn = (by: number) => onChange({ rotation: normaliseRotation(table.rotation + by) })
  return (
    <Sheet title={table.label} onClose={onClose}>
      <Group label={`Seated here · ${seated.length} of ${table.chairs}`}>
        <Row>
          <NameField tableLabel={table.label} seated={seated} candidates={candidates} seatOf={seatOf} full={seated.length >= table.chairs} onSeat={onSeat} />
        </Row>
      </Group>

      <Group label="Table">
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
        {table.shape !== 'round' && <Row>
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-[16px] text-black/85">Turn</span>
            <span className="w-11 shrink-0 text-right text-[15px] tabular-nums text-black/55">{table.rotation}°</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <RoundButton label="Turn left 15 degrees" onClick={() => turn(-ROTATION_STEP)}><RotateCcw size={18} aria-hidden="true" /></RoundButton>
            <TurnSlider value={table.rotation} onSave={rotation => onChange({ rotation })} />
            <RoundButton label="Turn right 15 degrees" onClick={() => turn(ROTATION_STEP)}><RotateCw size={18} aria-hidden="true" /></RoundButton>
          </div>
        </Row>}
      </Group>

      <div className="mt-6 flex justify-end">
        <ConfirmButton confirmText={seated.length ? `Delete and return ${seated.length} to the list` : 'Tap again to delete'} onConfirm={onDelete}>Delete table</ConfirmButton>
      </div>
    </Sheet>
  )
}
