'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { FLOOR } from '@/lib/seating/geometry'

export const ZOOM = { min: 0.3, max: 1.6, step: 0.15 } as const

/** Where an empty spot of the floor was clicked: in floor units, and in pixels from the floor's top left corner. */
export interface FloorSpot {
  x: number
  y: number
  left: number
  top: number
}

interface FloorProps {
  room: { width: number; height: number }
  zoom: number
  onZoom: (zoom: number) => void
  onFit: () => void
  /** A click on empty floor (not the end of a drag). */
  onBlankClick: (spot: FloorSpot) => void
  /** Drawn over the floor without scrolling or zooming with it: the add menu. */
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
 * The room. Drag empty floor to move around it, scroll or use the buttons to
 * zoom, click empty floor to add something there. Everything inside is
 * positioned in floor units and scaled as one layer.
 */
export const Floor = forwardRef<HTMLDivElement, FloorProps>(function Floor({ room, zoom, onZoom, onFit, onBlankClick, overlay, children }, ref) {
  const scroller = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => scroller.current as HTMLDivElement)
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const zoomNow = useRef(zoom)
  zoomNow.current = zoom
  const grid = FLOOR.grid * 5

  // Pinch on a trackpad, or Ctrl/Cmd with the wheel, zooms instead of scrolling the page.
  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      onZoom(zoomNow.current * (event.deltaY < 0 ? 1.08 : 1 / 1.08))
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [onZoom])

  const onBlank = (event: ReactPointerEvent) => !(event.target as HTMLElement).closest('[data-floor-item]')
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = scroller.current
    // A finger already scrolls the floor natively; this is for the mouse.
    if (!box || event.pointerType !== 'mouse' || event.button !== 0 || !onBlank(event)) return
    pan.current = { x: event.clientX, y: event.clientY, left: box.scrollLeft, top: box.scrollTop, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pan.current, box = scroller.current
    if (!start || !box) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (!start.moved && Math.hypot(dx, dy) < PAN_START_PX) return
    start.moved = true
    box.scrollLeft = start.left - dx
    box.scrollTop = start.top - dy
  }
  const onPointerUp = () => { window.setTimeout(() => { pan.current = null }, 0) }
  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = scroller.current
    if (!box || pan.current?.moved || (event.target as HTMLElement).closest('[data-floor-item]')) return
    const layer = event.currentTarget.getBoundingClientRect(), frame = box.getBoundingClientRect()
    onBlankClick({
      x: (event.clientX - layer.left) / zoomNow.current,
      y: (event.clientY - layer.top) / zoomNow.current,
      left: event.clientX - frame.left,
      top: event.clientY - frame.top,
    })
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl bg-[#B4B6C1] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]">
      <div ref={scroller} className="h-full overflow-auto overscroll-contain" data-seating-floor="true">
        {/* Centred when the whole room fits; scrolls from the top left when it does not. */}
        <div className="mx-auto" style={{ width: room.width * zoom, height: room.height * zoom }}>
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onClick}
            data-seating-room="true"
            className="relative origin-top-left cursor-grab bg-[#DFE0E7] active:cursor-grabbing"
            style={{
              width: room.width, height: room.height, transform: `scale(${zoom})`,
              backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.09) 1px, transparent 1px)',
              backgroundSize: `${grid}px ${grid}px`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
      {overlay}
      <div className="absolute bottom-3 right-3 flex items-center overflow-hidden rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.28)]">
        <ZoomButton label="Zoom out" onClick={() => onZoom(zoom - ZOOM.step)} disabled={zoom <= ZOOM.min}><ZoomOut size={18} aria-hidden="true" /></ZoomButton>
        <span className="w-11 text-center text-[12px] font-medium tabular-nums text-black/70" aria-live="off">{Math.round(zoom * 100)}%</span>
        <ZoomButton label="Zoom in" onClick={() => onZoom(zoom + ZOOM.step)} disabled={zoom >= ZOOM.max}><ZoomIn size={18} aria-hidden="true" /></ZoomButton>
        <ZoomButton label="Fit the whole room" onClick={onFit}><Maximize size={17} aria-hidden="true" /></ZoomButton>
      </div>
    </div>
  )
})
