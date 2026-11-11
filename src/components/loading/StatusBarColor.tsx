'use client'

import { useEffect } from 'react'
import { heroColorFromPixels, STATUS_COLORS, STATUS_EVENT, statusColorFor, type ColorProbe } from '@/lib/loading/status-color'

function probe(element: Element | null): ColorProbe | null {
  if (!element) return null
  return {
    matches: selector => element.matches(selector),
    background: getComputedStyle(element).backgroundColor,
    get parent() { return probe(element.parentElement) },
  }
}

/** Fixed chrome that floats over the page and must not decide the colour. */
const FLOATING = '.back-top-wrap, [data-sonner-toaster], nav, [data-status-ignore]'
/** Reading layout is not free, so the colour is re-read at most this often while scrolling. */
const UPDATE_EVERY_MS = 120
/** How often the hero's colour is re-read from the playing video. */
const VIDEO_EVERY_MS = 500

function elementAt(y: number): Element | null {
  const stack = document.elementsFromPoint(window.innerWidth / 2, y)
  return stack.find(element => !element.closest(FLOATING)) ?? null
}

/**
 * Keeps the browser's own bars in step with the page:
 *  - <meta name="theme-color"> takes the colour at the top edge of the screen, which iOS Safari
 *    and Android Chrome use for the status bar and toolbar;
 *  - the colour behind the page (shown when it is pulled past its top or bottom edge) follows
 *    whichever edge the guest is nearer to;
 *  - over the hero the colour is read from the video itself, so it changes as the video does.
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
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 4
    const pen = canvas.getContext('2d', { willReadFrequently: true })
    let heroColor: string | null = null
    let videoBlocked = false
    let timer = 0
    let last = 0

    /** Reads the top strip of the hero video. Fails quietly if the video cannot be read. */
    const sampleVideo = () => {
      const video = document.querySelector<HTMLVideoElement>('video[data-hero-video]')
      if (!pen || !video || videoBlocked || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return
      try {
        // The strip across the top tenth of the frame, squeezed into a few pixels.
        pen.drawImage(video, 0, 0, video.videoWidth, video.videoHeight * 0.1, 0, 0, canvas.width, canvas.height)
        heroColor = heroColorFromPixels(pen.getImageData(0, 0, canvas.width, canvas.height).data) ?? heroColor
      } catch {
        // A video without permission to be read taints the canvas. Keep the fixed colour and stop trying.
        videoBlocked = true
      }
    }

    const colorFor = (element: Element | null) => {
      const color = statusColorFor(probe(element))
      return color === STATUS_COLORS.hero && heroColor ? heroColor : color
    }

    const update = () => {
      timer = 0
      last = performance.now()
      const top = colorFor(elementAt(1))
      if (target.content !== top) target.content = top
      // Past the middle of the page, the colour behind the page matches the bottom edge instead.
      const nearEnd = window.scrollY + window.innerHeight / 2 > root.scrollHeight / 2
      const behind = nearEnd ? colorFor(elementAt(window.innerHeight - 2)) : top
      if (root.style.backgroundColor !== behind) root.style.backgroundColor = behind
    }
    const schedule = () => {
      if (timer) return
      timer = window.setTimeout(update, Math.max(0, UPDATE_EVERY_MS - (performance.now() - last)))
    }
    const tick = window.setInterval(() => {
      // Only while the hero is at the top and the tab is visible.
      if (document.hidden || window.scrollY > window.innerHeight) return
      const before = heroColor
      sampleVideo()
      if (heroColor !== before) schedule()
    }, VIDEO_EVERY_MS)

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener(STATUS_EVENT, schedule)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(tick)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener(STATUS_EVENT, schedule)
      root.style.backgroundColor = previousBackground
    }
  }, [])
  return null
}
