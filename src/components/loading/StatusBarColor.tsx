'use client'

import { useEffect } from 'react'
import { STATUS_EVENT, statusColorFor, type ColorProbe } from '@/lib/loading/status-color'

function probe(element: Element | null): ColorProbe | null {
  if (!element) return null
  return {
    matches: selector => element.matches(selector),
    background: getComputedStyle(element).backgroundColor,
    get parent() { return probe(element.parentElement) },
  }
}

/** Fixed chrome that floats over the page and must not decide the colour. */
const FLOATING = '.back-top-wrap, [data-sonner-toaster]'

function colorAtTop(): string {
  const stack = document.elementsFromPoint(window.innerWidth / 2, 1)
  const top = stack.find(element => !element.closest(FLOATING)) ?? null
  return statusColorFor(probe(top))
}

/**
 * Keeps <meta name="theme-color"> matched to the section under the status bar
 * (the Dynamic Island area on an iPhone), updating as the guest scrolls.
 */
export function StatusBarColor() {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    const target = meta
    const root = document.documentElement
    const previousBackground = root.style.backgroundColor
    let frame = 0
    const update = () => {
      frame = 0
      const color = colorAtTop()
      if (target.content !== color) target.content = color
      // The area revealed when the page is pulled past its top edge takes the same colour.
      if (root.style.backgroundColor !== color) root.style.backgroundColor = color
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener(STATUS_EVENT, schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener(STATUS_EVENT, schedule)
      root.style.backgroundColor = previousBackground
    }
  }, [])
  return null
}
