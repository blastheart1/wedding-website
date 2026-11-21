/**
 * How far a photo is from what the guest can see, measured down the page.
 * Zero means it is on screen. Photos below the screen are the ones about to
 * be scrolled to; photos already passed cost double, since going back is rarer.
 */
export function distanceFromView(top: number, bottom: number, viewTop: number, viewHeight: number): number {
  const viewBottom = viewTop + viewHeight
  if (bottom >= viewTop && top <= viewBottom) return 0
  return top > viewBottom ? top - viewBottom : (viewTop - bottom) * 2
}

/** The item closest to the view, or undefined when there are none. Ties keep page order. */
export function closestToView<T>(items: Iterable<T>, rangeOf: (item: T) => { top: number; bottom: number }, viewTop: number, viewHeight: number): T | undefined {
  let best: T | undefined
  let bestDistance = Infinity
  for (const item of items) {
    const { top, bottom } = rangeOf(item)
    const distance = distanceFromView(top, bottom, viewTop, viewHeight)
    if (distance < bestDistance) { best = item; bestDistance = distance }
  }
  return best
}
