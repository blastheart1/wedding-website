import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

interface FloorDragOptions {
  enabled: boolean
  /** Screen pixels per floor unit. */
  zoom: number
  /** Called while dragging with how far the pointer has moved, in floor units. */
  onDrag: (dx: number, dy: number) => void
  /** Called once when the drag ends. `moved` is false for a plain click. */
  onEnd: (moved: boolean) => void
}

const START_PX = 4

/**
 * Moves something on the floor with a mouse or a finger. The floor is zoomed,
 * so distances are converted from screen pixels to floor units here.
 */
export function useFloorDrag({ enabled, zoom, onDrag, onEnd }: FloorDragOptions) {
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { x: event.clientX, y: event.clientY, moved: false }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const origin = start.current
    if (!origin) return
    const dx = event.clientX - origin.x, dy = event.clientY - origin.y
    if (!origin.moved && Math.hypot(dx, dy) < START_PX) return
    origin.moved = true
    onDrag(dx / zoom, dy / zoom)
  }
  const finish = () => {
    const origin = start.current
    if (!origin) return
    start.current = null
    onEnd(origin.moved)
  }

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish }
}
