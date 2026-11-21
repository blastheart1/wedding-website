/** Move keyboard focus to the destination while leaving native fragment
 * navigation in charge of scrolling, reduced motion, URL and Back/Forward. */
type AnchorActivation = {
  button: number
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  defaultPrevented: boolean
  currentTarget: Pick<HTMLAnchorElement, 'getAttribute'>
}

export function focusSectionAnchor(event: AnchorActivation, doc: Document = document): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
  const href = event.currentTarget.getAttribute('href')
  const targetContext = event.currentTarget.getAttribute('target')
  if (!href?.startsWith('#') || href.length < 2 || (targetContext && targetContext !== '_self')) return false
  let id: string
  try { id = decodeURIComponent(href.slice(1)) } catch { return false }
  const target = doc.getElementById(id)
  if (!target) return false
  const temporaryTabIndex = !target.hasAttribute('tabindex')
  if (temporaryTabIndex) {
    target.setAttribute('tabindex', '-1')
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
  }
  // Do not preventDefault, call scrollIntoView, or mutate history here. The
  // browser still follows the real href and honors the page's scroll behavior.
  target.focus({ preventScroll: true })
  return doc.activeElement === target
}

/** True when a pinned (sticky-stage) section lies between where the page is now
 * and the top of the target. Smooth scrolling through those would play the pinned
 * animation, so such jumps should land instantly. Pure: positions are passed in. */
export function crossesPinnedSection(
  from: number,
  to: number,
  pinned: ReadonlyArray<{ top: number; bottom: number }>,
): boolean {
  const low = Math.min(from, to), high = Math.max(from, to)
  return pinned.some(range => range.bottom > low && range.top < high)
}

/** Navbar jump: if the way to the target passes a pinned section, scroll there
 * instantly (no smooth travel through it) and then restore smooth scrolling.
 * Native fragment navigation still does the actual scroll, URL and history. */
export function jumpPastPinnedSections(event: Pick<AnchorActivation, 'currentTarget'>, doc: Document = document, win: Window = window): boolean {
  const href = event.currentTarget.getAttribute('href')
  if (!href?.startsWith('#') || href.length < 2) return false
  const target = doc.getElementById(decodeURIComponent(href.slice(1)))
  if (!target) return false
  const here = win.scrollY
  const pinned = [...doc.querySelectorAll<HTMLElement>('#gallery, .wedding-journey')].map(element => {
    const rect = element.getBoundingClientRect()
    return { top: rect.top + here, bottom: rect.bottom + here }
  })
  const destination = target.getBoundingClientRect().top + here
  if (!crossesPinnedSection(here, destination, pinned)) return false
  const root = doc.documentElement
  const previous = root.style.scrollBehavior
  root.style.scrollBehavior = 'auto'
  win.setTimeout(() => { root.style.scrollBehavior = previous }, 400)
  return true
}
