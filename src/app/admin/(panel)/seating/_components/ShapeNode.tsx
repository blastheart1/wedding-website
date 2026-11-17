'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { clamp, snap } from '@/lib/seating/geometry'
import type { FloorShape } from '@/lib/seating/schemas'
import { useFloorDrag } from './useFloorDrag'

interface ShapeNodeProps {
  shape: FloorShape
  room: { width: number; height: number }
  /** Locked: shapes cannot be moved or resized. */
  locked: boolean
  zoom: number
  onOpen: (id: string) => void
  onChange: (shape: FloorShape) => void
}

const MIN_SIZE = 40

/** A labelled block on the floor (stage, dance floor, entrance). Nobody sits at it. */
export function ShapeNode({ shape, room, locked, zoom, onOpen, onChange }: ShapeNodeProps) {
  const [draft, setDraft] = useState<FloorShape | null>(null)
  const shown = draft ?? shape
  const arranging = !locked

  const move = useFloorDrag({
    enabled: arranging,
    zoom,
    onDrag: (dx, dy) => setDraft({ ...shape, x: clamp(snap(shape.x + dx), 0, room.width), y: clamp(snap(shape.y + dy), 0, room.height) }),
    onEnd: moved => { if (moved && draft) onChange(draft); else onOpen(shape.id); setDraft(null) },
  })
  const resize = useFloorDrag({
    enabled: arranging,
    zoom,
    onDrag: (dx, dy) => setDraft({ ...shape, width: clamp(snap(shape.width + dx * 2), MIN_SIZE, 2000), height: clamp(snap(shape.height + dy * 2), MIN_SIZE, 2000) }),
    onEnd: moved => { if (moved && draft) onChange(draft); setDraft(null) },
  })

  return (
    <div className="group absolute" data-floor-item="true" style={{ left: shown.x - shown.width / 2, top: shown.y - shown.height / 2, width: shown.width, height: shown.height, zIndex: draft ? 4 : 0 }}>
      <div
        role="button"
        tabIndex={0}
        {...move}
        onClick={arranging ? undefined : () => onOpen(shape.id)}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(shape.id) } }}
        aria-label={`${shape.label}. Press to edit`}
        className={clsx(
          'flex h-full w-full select-none items-center justify-center rounded-lg bg-[#B9BBC6] px-2 text-center text-[13px] font-semibold uppercase tracking-[0.06em] text-black/70 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/60',
          arranging ? 'cursor-move touch-none' : 'cursor-pointer',
        )}
      >
        <span className="truncate">{shape.label}</span>
      </div>
      {arranging && (
        <div {...resize} aria-hidden="true" title="Drag to resize" className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize touch-none rounded-full bg-[#2E1F1A] opacity-0 shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
      )}
    </div>
  )
}
