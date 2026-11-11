import { useEffect, type RefObject } from 'react'

/** How much the fold is pressed flat for each pixel the page is pulled past its end, and the most it can lose. */
const PRESS_PER_PIXEL = 0.5
const MAX_PRESS = 46
/** The most the fold can spring open past its resting size on the way back. */
const MAX_LIFT = 60
/** The spring that carries the fold back: loose enough to swing open past its resting size before settling. */
const STIFFNESS = 200
const DAMPING = 8
/** How hard one notch of a wheel or trackpad presses the fold when the page itself cannot move further. */
const WHEEL_PUSH = 5
const REST = 0.3

const reducedMotion = () =>
  document.documentElement.dataset.siteMotion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Keeps the folded corner in the corner of the screen at the end of the page,
 * and lets it react to the page's bounce the way a loose flap of paper would:
 * pulling the page up past its end presses the fold flat, and letting go lets
 * it spring open past its resting size before it settles.
 *
 * Browsers report the bounce differently. Safari moves the scroll position
 * past the end, so the fold follows that. Others hold the position still, so
 * the push is read from the wheel or the finger instead.
 */
export function useCornerBounce(corner: RefObject<HTMLElement>): void {
  useEffect(() => {
    const element = corner.current
    if (!element) return
    let atEnd = false
    let scrollReportsBounce = false
    let target = 0, size = 0, speed = 0
    let frame = 0, last = 0
    let touchStart: number | null = null

    const pastEnd = () => window.scrollY + window.innerHeight - document.documentElement.scrollHeight
    const draw = () => {
      element.style.setProperty('--bounce', `${size.toFixed(1)}px`)
      element.dataset.bouncing = String(Math.abs(size) > REST || target !== 0)
    }
    const step = (now: number) => {
      const elapsed = Math.min(0.032, (now - last) / 1000)
      last = now
      speed += ((target - size) * STIFFNESS - speed * DAMPING) * elapsed
      size = Math.min(MAX_LIFT, Math.max(-MAX_PRESS, size + speed * elapsed))
      const resting = target === 0 && Math.abs(size) < REST && Math.abs(speed) < 4
      if (resting) { size = 0; speed = 0 }
      draw()
      frame = resting ? 0 : requestAnimationFrame(step)
    }
    const wake = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(step) } }
    const pull = (pixels: number) => { target = -Math.min(MAX_PRESS, Math.max(0, pixels) * PRESS_PER_PIXEL); wake() }

    const onScroll = () => {
      const over = pastEnd()
      atEnd = over >= -1
      element.dataset.pinned = String(atEnd)
      if (over > 1) scrollReportsBounce = true
      if (scrollReportsBounce && !reducedMotion()) pull(over)
    }
    const onWheel = (event: WheelEvent) => {
      if (!atEnd || scrollReportsBounce || event.deltaY <= 0 || reducedMotion()) return
      speed = Math.max(-900, speed - event.deltaY * WHEEL_PUSH)
      wake()
    }
    const onTouchStart = (event: TouchEvent) => {
      // A touch on the corner itself is a drag of the fold, not a scroll.
      touchStart = atEnd && !element.contains(event.target as Node) ? event.touches[0].clientY : null
    }
    const onTouchMove = (event: TouchEvent) => {
      if (touchStart === null || scrollReportsBounce || reducedMotion()) return
      pull(atEnd ? touchStart - event.touches[0].clientY : 0)
    }
    const onTouchEnd = () => { touchStart = null; if (!scrollReportsBounce) pull(0) }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      element.style.removeProperty('--bounce')
    }
  }, [corner])
}
