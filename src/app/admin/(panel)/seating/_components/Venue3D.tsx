'use client'

import { useEffect, useRef, useState } from 'react'
import type { Assignment, SeatingTable } from '@/lib/seating/rules'
import type { FloorShape } from '@/lib/seating/schemas'
import type { VenueScene, Viewpoint } from '@/world/venue/venue-scene'

interface Venue3DProps {
  room: { width: number; height: number }
  tables: readonly SeatingTable[]
  assignments: readonly Assignment[]
  shapes: readonly FloorShape[]
}

const VIEWS: readonly { value: Viewpoint; label: string }[] = [
  { value: 'overview', label: 'From above' },
  { value: 'entrance', label: 'From the entrance' },
  { value: 'head', label: 'From the head table' },
]

/** The hall in 3D with the plan's tables inside. Drag to look around; the buttons jump to useful places to stand. */
export function Venue3D({ room, tables, assignments, shapes }: Venue3DProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<VenueScene | null>(null)
  const latest = useRef({ room, tables, assignments, shapes })
  latest.current = { room, tables, assignments, shapes }
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const target = canvas.current
    if (!target) return
    let disposed = false
    let observer: ResizeObserver | null = null
    import('@/world/venue/venue-scene')
      .then(({ createVenueScene }) => {
        if (disposed) return
        const created = createVenueScene(target, latest.current)
        scene.current = created
        const fit = () => { const box = target.getBoundingClientRect(); created.resize(Math.max(1, box.width), Math.max(1, box.height)) }
        observer = new ResizeObserver(fit)
        observer.observe(target)
        fit()
      })
      .catch(() => { if (!disposed) setUnavailable(true) })
    return () => {
      disposed = true
      observer?.disconnect()
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  // Follow the plan: any change to the room, the tables or who sits where is redrawn.
  useEffect(() => { scene.current?.update({ room, tables, assignments, shapes }) }, [room, tables, assignments, shapes])

  if (unavailable) {
    return <p className="flex h-full items-center justify-center rounded-xl bg-[#D3D5DD] px-6 text-center text-[15px] text-black/60">This device cannot draw the 3D hall. The plan view shows the same layout.</p>
  }
  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl bg-[#DBE8EE]">
      <canvas ref={canvas} className="block h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-label="The reception hall in 3D with the tables from the plan" />
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
        {VIEWS.map(view => (
          <button key={view.value} type="button" onClick={() => scene.current?.lookFrom(view.value)}
            className="rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-black/80 shadow-[0_1px_6px_rgba(0,0,0,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/60">
            {view.label}
          </button>
        ))}
      </div>
      <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[12px] text-black/65">
        {(room.width / 100).toFixed(1)} × {(room.height / 100).toFixed(1)} m · sizes estimated from the venue video
      </p>
    </div>
  )
}
