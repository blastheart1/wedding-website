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
