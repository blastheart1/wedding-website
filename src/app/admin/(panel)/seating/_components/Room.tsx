'use client'

import { useEffect, useState } from 'react'
import { FLOOR, clamp } from '@/lib/seating/geometry'
import { Group, Row, Sheet, inputClass, labelClass } from '@/app/admin/_ui/primitives'

export interface RoomSize {
  /** Floor units: one unit is one centimetre. */
  width: number
  height: number
}

const metres = (units: number): string => (units / 100).toFixed(units % 100 === 0 ? 0 : 1)

/**
 * The hall's walls, drawn on the open floor so it is clear what space can
 * actually be used. It takes no clicks: the floor underneath behaves as usual.
 */
export function RoomOutline({ room }: { room: RoomSize }) {
  const door = Math.min(190, room.width * 0.3)
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 bg-[#F4F1EC] shadow-[0_0_0_10px_#2E1F1A,0_14px_40px_rgba(0,0,0,0.25)]" style={{ width: room.width, height: room.height }}>
      <p className="absolute left-3 top-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-black/40">
        The hall · {metres(room.width)} × {metres(room.height)} m
      </p>
      {/* The entrance, on the end wall nearest the bottom of the plan. */}
      <div className="absolute -bottom-[12px] h-[14px] bg-[#F4F1EC]" style={{ left: (room.width - door) / 2, width: door }} />
      <p className="absolute -bottom-10 left-0 right-0 text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-black/50">Entrance</p>
    </div>
  )
}

function MetresField({ id, label, units, onSave }: { id: string; label: string; units: number; onSave: (units: number) => void }) {
  const [text, setText] = useState(metres(units))
  useEffect(() => setText(metres(units)), [units])
  const commit = () => {
    const value = Number(text.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) { setText(metres(units)); return }
    const next = clamp(Math.round(value * 10) * 10, FLOOR.min, FLOOR.max)
    setText(metres(next))
    if (next !== units) onSave(next)
  }
  return (
    <div className="flex-1">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} inputMode="decimal" value={text} onChange={event => setText(event.target.value)} onBlur={commit}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} className={inputClass} />
    </div>
  )
}

/** The hall's size in metres. Tables and chairs are drawn to the same scale, so the plan shows what really fits. */
export function RoomSheet({ room, onChange, onClose }: { room: RoomSize; onChange: (room: RoomSize) => void; onClose: () => void }) {
  return (
    <Sheet title="Room size" onClose={onClose}>
      <Group footnote={`Between ${FLOOR.min / 100} and ${FLOOR.max / 100} metres each way. Everything on the plan is to scale: a round table for ten is about 1.7 m across, 3.3 m with its chairs. The entrance is drawn on the bottom wall.`}>
        <Row className="flex gap-3">
          <MetresField id="room-width" label="Width (m)" units={room.width} onSave={width => onChange({ ...room, width })} />
          <MetresField id="room-length" label="Length (m)" units={room.height} onSave={height => onChange({ ...room, height })} />
        </Row>
        <Row><p className="text-[15px] text-black/60">Floor area: {((room.width / 100) * (room.height / 100)).toFixed(0)} m²</p></Row>
      </Group>
    </Sheet>
  )
}
