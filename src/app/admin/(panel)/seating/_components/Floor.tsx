'use client'

import { forwardRef, type ReactNode } from 'react'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { FLOOR } from '@/lib/seating/geometry'

export const ZOOM = { min: 0.3, max: 1.6, step: 0.15 } as const

interface FloorProps {
  room: { width: number; height: number }
  zoom: number
  onZoom: (zoom: number) => void
  onFit: () => void
  onBackgroundClick: () => void
  children: ReactNode
}

function ZoomButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="flex h-9 w-9 items-center justify-center text-black/65 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50">
      {children}
    </button>
  )
}

/**
 * The room. It scrolls in both directions and zooms; everything inside is
 * positioned in floor units and scaled as one layer.
 */
export const Floor = forwardRef<HTMLDivElement, FloorProps>(function Floor({ room, zoom, onZoom, onFit, onBackgroundClick, children }, ref) {
  const grid = FLOOR.grid * 5
  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl bg-[#E9E9EE]">
      <div ref={ref} className="h-full overflow-auto overscroll-contain" data-seating-floor="true">
        {/* Centred when the whole room fits; scrolls from the top left when it does not. */}
        <div className="mx-auto" style={{ width: room.width * zoom, height: room.height * zoom }}>
          <div
            onClick={onBackgroundClick}
            className="relative origin-top-left bg-[#FAFAFC]"
            style={{
              width: room.width, height: room.height, transform: `scale(${zoom})`,
              backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.045) 1px, transparent 1px)',
              backgroundSize: `${grid}px ${grid}px`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 flex items-center overflow-hidden rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.18)]">
        <ZoomButton label="Zoom out" onClick={() => onZoom(zoom - ZOOM.step)} disabled={zoom <= ZOOM.min}><ZoomOut size={18} aria-hidden="true" /></ZoomButton>
        <span className="w-11 text-center text-[12px] tabular-nums text-black/55" aria-live="off">{Math.round(zoom * 100)}%</span>
        <ZoomButton label="Zoom in" onClick={() => onZoom(zoom + ZOOM.step)} disabled={zoom >= ZOOM.max}><ZoomIn size={18} aria-hidden="true" /></ZoomButton>
        <ZoomButton label="Fit the whole room" onClick={onFit}><Maximize size={17} aria-hidden="true" /></ZoomButton>
      </div>
    </div>
  )
})
