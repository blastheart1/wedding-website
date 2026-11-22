/**
 * How far a photo is from what the guest can see, measured down the page.
 * Zero means it is on screen. Photos ahead of the guest (below when scrolling
 * down, above when scrolling up) are the ones about to be reached; photos
 * already passed cost double, since going back is rarer.
 */
export function distanceFromView(top: number, bottom: number, viewTop: number, viewHeight: number, direction: 1 | -1 = 1): number {
  const viewBottom = viewTop + viewHeight
  if (bottom >= viewTop && top <= viewBottom) return 0
  if (direction === 1) return top > viewBottom ? top - viewBottom : (viewTop - bottom) * 2
  return bottom < viewTop ? viewTop - bottom : (top - viewBottom) * 2
}

/** The item closest to the view, or undefined when there are none. Ties keep page order. */
export function closestToView<T>(items: Iterable<T>, rangeOf: (item: T) => { top: number; bottom: number }, viewTop: number, viewHeight: number, direction: 1 | -1 = 1): T | undefined {
  let best: T | undefined
  let bestDistance = Infinity
  for (const item of items) {
    const { top, bottom } = rangeOf(item)
    const distance = distanceFromView(top, bottom, viewTop, viewHeight, direction)
    if (distance < bestDistance) { best = item; bestDistance = distance }
  }
  return best
}

/**
 * Where the top of the screen will be shortly, if the guest keeps going at this
 * speed (pixels per second, negative when scrolling up). A fast flick looks
 * further ahead, so photos are fetched for where the guest is heading, not
 * where they were a moment ago. Capped, so a stray spike cannot send it far off.
 */
export function predictedViewTop(scrollY: number, velocity: number, horizonMs = 1200, maxAhead = 5000): number {
  if (!Number.isFinite(velocity)) return scrollY
  const ahead = Math.max(-maxAhead, Math.min(maxAhead, (velocity * horizonMs) / 1000))
  return Math.max(0, scrollY + ahead)
}

/** A steadier speed from a new sample: recent movement counts most, a pause counts as zero. */
export function smoothedVelocity(previous: number, distance: number, elapsedMs: number, idleMs: number): number {
  if (elapsedMs <= 0) return previous
  if (idleMs > 150) return 0
  return previous * 0.4 + ((distance / elapsedMs) * 1000) * 0.6
}

/** True for a photo close enough to the predicted view that it should jump the network queue. */
export const isUrgent = (distance: number, viewHeight: number): boolean => distance <= viewHeight * 1.5
