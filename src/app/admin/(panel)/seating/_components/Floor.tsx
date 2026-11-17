'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Focus, ZoomIn, ZoomOut } from 'lucide-react'
import { FLOOR, clamp, zoomAbout, type FloorView } from '@/lib/seating/geometry'

/** Far enough out to see a whole venue and its grounds; close enough in to read every name. */
export const ZOOM = { min: 0.05, max: 2, step: 1.25 } as const

/** Where an empty spot of the floor was clicked: in floor units, and in pixels from the floor's top left corner. */
export interface FloorSpot {
  x: number
  y: number
  left: number
  top: number
}

export interface FloorHandle {
  /** The size of the floor on screen, in pixels. */
  frame: () => { width: number; height: number }
}

interface FloorProps {
  view: FloorView
  onView: (view: FloorView) => void
  /** Centres the view on everything on the floor. */
  onCentre: () => void
  /** A click on empty floor (not the end of a drag). */
  onBlankClick: (spot: FloorSpot) => void
  /** Drawn over the floor without moving or zooming with it: the add menu, the empty message. */
  overlay?: ReactNode
  children: ReactNode
}

function ZoomButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="flex h-9 w-9 items-center justify-center text-black/75 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50">
      {children}
    </button>
  )
}

const PAN_START_PX = 4

/**
 * An open floor with no edges: drag empty floor to move across it, scroll to
 * move, pinch or Ctrl/Cmd + wheel to zoom about the pointer, click empty floor
 * to add something there. Everything on it is positioned in floor units
 * (one unit is one centimetre) and drawn as one layer.
 */
export const Floor = forwardRef<FloorHandle, FloorProps>(function Floor({ view, onView, onCentre, onBlankClick, overlay, children }, ref) {
  const frame = useRef<HTMLDivElement>(null)
  const pan = useRef<{ x: number; y: number; viewX: number; viewY: number; moved: boolean } | null>(null)
  const latest = useRef(view)
  latest.current = view
  useImperativeHandle(ref, () => ({ frame: () => ({ width: frame.current?.clientWidth ?? 0, height: frame.current?.clientHeight ?? 0 }) }))

  const zoomTo = (zoom: number, point?: { x: number; y: number }) => {
    const box = frame.current
    const centre = point ?? { x: (box?.clientWidth ?? 0) / 2, y: (box?.clientHeight ?? 0) / 2 }
    onView(zoomAbout(latest.current, clamp(zoom, ZOOM.min, ZOOM.max), centre))
  }

  // The wheel moves across the floor; with Ctrl/Cmd (or a trackpad pinch) it zooms about the pointer.
  useEffect(() => {
    const box = frame.current
    if (!box) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const current = latest.current
      if (event.ctrlKey || event.metaKey) {
        const rect = box.getBoundingClientRect()
        const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.01), ZOOM.min, ZOOM.max)
        onView(zoomAbout(current, zoom, { x: event.clientX - rect.left, y: event.clientY - rect.top }))
      } else {
        onView({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY })
      }
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [onView])

  const isBlank = (target: EventTarget) => !(target as HTMLElement).closest('[data-floor-item]')
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.pointerType === 'mouse' && event.button !== 0) || !isBlank(event.target)) return
    pan.current = { x: event.clientX, y: event.clientY, viewX: latest.current.x, viewY: latest.current.y, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pan.current
    if (!start) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (!start.moved && Math.hypot(dx, dy) < PAN_START_PX) return
    start.moved = true
    onView({ ...latest.current, x: start.viewX + dx, y: start.viewY + dy })
  }
  // Cleared after the click that ends the drag has been seen, so a drag never counts as a click.
  const onPointerUp = () => { window.setTimeout(() => { pan.current = null }, 0) }
  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = frame.current
    if (!box || pan.current?.moved || !isBlank(event.target)) return
    const rect = box.getBoundingClientRect(), current = latest.current
    const left = event.clientX - rect.left, top = event.clientY - rect.top
    onBlankClick({ x: (left - current.x) / current.zoom, y: (top - current.y) / current.zoom, left, top })
  }

  // Grid lines every half metre, with a heavier line every metre once zoomed in enough to tell them apart.
  const cell = FLOOR.grid * 5 * view.zoom
  const fine = cell >= 8
  const size = fine ? cell : cell * 4
  return (
    <div
      ref={frame}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      data-seating-floor="true"
      className="relative h-full min-h-0 cursor-grab touch-none overflow-hidden rounded-xl bg-[#D3D5DD] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)] active:cursor-grabbing"
      style={{
        backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.085) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.085) 1px, transparent 1px)',
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div className="absolute left-0 top-0 h-0 w-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }} data-seating-layer="true">
        {children}
      </div>
      {overlay}
      <div data-floor-item="true" className="absolute bottom-3 right-3 flex cursor-default items-center overflow-hidden rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.28)]">
        <ZoomButton label="Zoom out" onClick={() => zoomTo(view.zoom / ZOOM.step)} disabled={view.zoom <= ZOOM.min}><ZoomOut size={18} aria-hidden="true" /></ZoomButton>
        <span className="w-11 text-center text-[12px] font-medium tabular-nums text-black/70" aria-live="off">{Math.round(view.zoom * 100)}%</span>
        <ZoomButton label="Zoom in" onClick={() => zoomTo(view.zoom * ZOOM.step)} disabled={view.zoom >= ZOOM.max}><ZoomIn size={18} aria-hidden="true" /></ZoomButton>
        <ZoomButton label="Centre on the tables" onClick={onCentre}><Focus size={17} aria-hidden="true" /></ZoomButton>
      </div>
    </div>
  )
})
