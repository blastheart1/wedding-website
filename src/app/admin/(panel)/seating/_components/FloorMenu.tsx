'use client'

import { useEffect, useRef } from 'react'
import { SHAPE_LABEL, TABLE_SHAPES, type TableShape } from '@/lib/seating/rules'

interface FloorMenuProps {
  /** Pixels from the floor's top left corner. */
  left: number
  top: number
  onAddTable: (shape: TableShape) => void
  onAddShape: () => void
  onClose: () => void
}

const WIDTH = 208
const itemClass = 'block w-full px-3.5 py-2 text-left text-[15px] text-black/85 hover:bg-black/[0.06] focus-visible:bg-black/[0.06] focus-visible:outline-none'

/** The small menu that appears where empty floor was clicked: add a table of a chosen type, or a labelled shape, right there. */
export function FloorMenu({ left, top, onAddTable, onAddShape, onClose }: FloorMenuProps) {
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const onDown = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) onClose() }
    document.addEventListener('keydown', onKey)
    // Registered after this click has finished, so the click that opened the menu does not close it.
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', onDown), 0)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [onClose])

  return (
    <div ref={menu} role="menu" aria-label="Add to the floor here" data-seating-menu="true"
      className="absolute z-20 overflow-hidden rounded-xl bg-white py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.28),0_0_0_1px_rgba(0,0,0,0.08)]"
      style={{ width: WIDTH, left: `clamp(8px, ${left}px, calc(100% - ${WIDTH + 8}px))`, top: `clamp(8px, ${top}px, calc(100% - 250px))` }}>
      <p className="px-3.5 pb-1 pt-1.5 text-[12px] uppercase tracking-[0.05em] text-black/45">Add a table here</p>
      {TABLE_SHAPES.map(shape => (
        <button key={shape} type="button" role="menuitem" className={itemClass} onClick={() => onAddTable(shape)}>{SHAPE_LABEL[shape]} table</button>
      ))}
      <div className="my-1 border-t border-black/[0.08]" />
      <button type="button" role="menuitem" className={itemClass} onClick={onAddShape}>Stage, dance floor or other shape</button>
    </div>
  )
}
