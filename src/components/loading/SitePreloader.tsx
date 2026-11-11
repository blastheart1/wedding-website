'use client'

import { useEffect, useRef, useState } from 'react'
import { progressOf, stageLabel, TIMING, visitedCookie } from '@/lib/loading/assets'
import { preloadSite } from '@/lib/loading/preload'
import { STATUS_EVENT } from '@/lib/loading/status-color'

interface SitePreloaderProps {
  partner1: string
  partner2: string
  date: string
  /** True when the visitor's cookie says they have been here before. */
  returning: boolean
}

type Phase = 'loading' | 'opening' | 'gone'

/**
 * The welcome a guest sees while the site gets ready. It covers the page,
 * loads every asset, then parts like a pair of doors. It can never trap
 * anyone: there is a skip button, a hard time limit, and CSS and noscript
 * fallbacks that remove it if the script fails.
 */
export function SitePreloader({ partner1, partner2, date, returning }: SitePreloaderProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [offerSkip, setOfferSkip] = useState(false)
  const opened = useRef(false)

  const open = useRef(() => {
    if (opened.current) return
    opened.current = true
    document.cookie = visitedCookie(window.location.protocol === 'https:')
    const reduced = document.documentElement.dataset.siteMotion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setPhase('opening')
    window.setTimeout(() => setPhase('gone'), reduced ? 250 : TIMING.exitMs)
  })

  useEffect(() => {
    const started = performance.now()
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'

    const skipTimer = window.setTimeout(() => setOfferSkip(true), TIMING.offerSkipAfterMs)
    const capTimer = window.setTimeout(() => open.current(), TIMING.hardCapMs)

    preloadSite(() => import('@/world/WeddingWorld'), weight => setProgress(current => Math.max(current, progressOf(weight)))).then(() => {
      setProgress(1)
      const minimum = returning ? 0 : TIMING.minFirstVisitMs
      window.setTimeout(() => open.current(), Math.max(0, minimum - (performance.now() - started)))
    })

    return () => {
      window.clearTimeout(skipTimer)
      window.clearTimeout(capTimer)
      root.style.overflow = previousOverflow
    }
  }, [returning])

  // Give the page back as soon as the doors start to open, and let the status bar colour follow.
  useEffect(() => {
    if (phase !== 'loading') document.documentElement.style.overflow = ''
    window.dispatchEvent(new Event(STATUS_EVENT))
  }, [phase])

  if (phase === 'gone') return null
  const percent = Math.round(progress * 100)

  return (
    <div className="site-preloader" data-phase={phase} role="status" aria-live="polite" aria-busy={phase === 'loading'}>
      <div className="site-preloader-door site-preloader-door-left" aria-hidden="true" />
      <div className="site-preloader-door site-preloader-door-right" aria-hidden="true" />
      <div className="site-preloader-content">
        <p className="site-preloader-kicker">{returning ? 'Welcome back' : date}</p>
        <p className="site-preloader-names">{partner1} <em>&amp;</em> {partner2}</p>
        <div className="site-preloader-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        <p className="site-preloader-status">
          <span>{stageLabel(progress)}</span>
          <span aria-hidden="true" className="site-preloader-percent">{percent}%</span>
          <span className="sr-only">, {percent} percent loaded</span>
        </p>
        {offerSkip && phase === 'loading' && (
          <button type="button" className="site-preloader-skip" onClick={() => open.current()}>Enter now</button>
        )}
      </div>
    </div>
  )
}
