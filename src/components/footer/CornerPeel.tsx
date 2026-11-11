'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Mail, X } from 'lucide-react'
import { EspressoGame } from './EspressoGame'
import { useCornerBounce } from './useCornerBounce'

interface CornerPeelProps {
  email: string
  url: string
}

/** closed: just the folded corner. dragging: the corner follows a finger. open: fully peeled. closing: folding back. */
type Stage = 'closed' | 'dragging' | 'open' | 'closing'

const OPEN_HASH = '#coffee'
/** Length of the peel, matching the transition in globals.css. */
const PEEL_MS = 700
/** A press becomes a drag after this much movement, and a drag opens the page once the fold is this big. */
const DRAG_START_PX = 8
const DRAG_OPEN_PX = 120
const PEEL_SIZE = '--peel'

const stillMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.siteMotion === 'reduced'

/** How big the fold is when its tip is under this point: the average distance in from the corner. */
const foldSize = (x: number, y: number) => Math.max(0, ((window.innerWidth - x) + (window.innerHeight - y)) / 2) * 1.15

/**
 * A folded corner at the bottom of the page. Tapping it, or dragging it back
 * with a finger, reveals who made the site and an espresso to dial in and pull.
 */
export function CornerPeel({ email, url }: CornerPeelProps) {
  const [stage, setStage] = useState<Stage>('closed')
  // Follows `stage` one frame later, so the sheet is on screen before its peel starts.
  const [peeled, setPeeled] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const modal = useRef(false)
  const press = useRef<{ x: number; y: number; dragging: boolean; size: number } | null>(null)
  const dragged = useRef(false)
  const corner = useRef<HTMLButtonElement>(null)
  useCornerBounce(corner)

  useEffect(() => {
    const fromHash = () => { if (window.location.hash === OPEN_HASH) setStage('open') }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  const close = useCallback(() => {
    setStage(current => (current === 'closed' ? current : 'closing'))
    if (window.location.hash === OPEN_HASH) history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  // The sheet is a native dialog. While a finger drags the corner it is shown plainly; once
  // open it becomes modal, so it traps focus, closes on Escape and returns focus to the corner.
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (stage === 'dragging') {
      if (!element.open) element.show()
      return
    }
    if (stage === 'open') {
      if (element.open && !modal.current) element.close()
      if (!element.open) { element.showModal(); modal.current = true }
      const frame = requestAnimationFrame(() => { element.style.removeProperty(PEEL_SIZE); setPeeled(true) })
      return () => cancelAnimationFrame(frame)
    }
    if (stage === 'closing') {
      element.style.removeProperty(PEEL_SIZE)
      setPeeled(false)
      // Let the corner fold back before the sheet is taken away.
      const timer = window.setTimeout(() => {
        if (element.open) element.close()
        modal.current = false
        setStage('closed')
      }, stillMotion() ? 0 : PEEL_MS)
      return () => window.clearTimeout(timer)
    }
  }, [stage])

  // Dragging: the fold follows the finger; letting go past a small fold opens the page, otherwise it falls back.
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (stage !== 'closed' || (event.pointerType === 'mouse' && event.button !== 0)) return
    press.current = { x: event.clientX, y: event.clientY, dragging: false, size: 0 }
    dragged.current = false
    const move = (moved: PointerEvent) => {
      const state = press.current
      if (!state) return
      if (!state.dragging) {
        if (Math.hypot(moved.clientX - state.x, moved.clientY - state.y) < DRAG_START_PX) return
        state.dragging = true
        dragged.current = true
        setStage('dragging')
      }
      state.size = foldSize(moved.clientX, moved.clientY)
      dialog.current?.style.setProperty(PEEL_SIZE, `${state.size}px`)
    }
    const end = (ended: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      const state = press.current
      press.current = null
      if (!state?.dragging) return
      setStage(ended.type === 'pointerup' && state.size >= DRAG_OPEN_PX ? 'open' : 'closing')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const onClick = () => {
    // The click that ends a drag is not a tap.
    if (dragged.current) { dragged.current = false; return }
    setStage('open')
  }

  if (!email && !url) return null

  return (
    <>
      <button ref={corner} type="button" className="corner-peel" aria-label="Peel back the corner of the page" aria-haspopup="dialog"
        onPointerDown={onPointerDown} onClick={onClick}>
        <span className="corner-peel-under" aria-hidden="true" />
        <span className="corner-peel-flap" aria-hidden="true" />
      </button>

      <dialog ref={dialog} className="peel-dialog" aria-label="About this site" data-open={peeled} data-stage={stage}
        onCancel={event => { event.preventDefault(); close() }}>
        <div className="peel-sheet">
          <EspressoGame mounted={stage !== 'closed'} />
          <button type="button" className="peel-close" onClick={close} aria-label="Fold the corner back">
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>

          <p className="peel-contact">
            <span>Want something like this?</span>
            {url && <a href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https:\/\//, '')}</a>}
            {email && (
              <a href={`mailto:${email}`} className="peel-mail" aria-label="Send an email">
                <Mail size={18} strokeWidth={1.8} aria-hidden="true" />
              </a>
            )}
          </p>
        </div>
        <span className="peel-flap" aria-hidden="true" />
      </dialog>
    </>
  )
}
