'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { MotionConfig, motion, AnimatePresence } from 'framer-motion'
import type { PublicConfig } from '@/lib/config'
import { SiteMotionProvider, useWorldMotion } from '@/lib/site-motion'
import { Hero } from '@/components/sections/Hero'
import { Navbar } from '@/components/sections/Navbar'
import { Story } from '@/components/sections/Story'
import { Countdown } from '@/components/sections/Countdown'
import { Details } from '@/components/sections/Details'
import { Gallery } from '@/components/sections/Gallery'
import { Footer } from '@/components/sections/Footer'
import { FAQSection } from '@/components/sections/FAQSection'
import { GamesSection } from '@/components/sections/GamesSection'
import { RSVPDialog } from '@/components/sections/RSVPDialog'
import { WeddingJourney } from '@/world/Journey'
import { arrowUp } from '@/extra-assets'
import { afterPhotosSettled } from '@/lib/loading/photo-warmer'

/** The 3D engine never waits longer than this for the photos. */
const ENGINE_LATEST_MS = 15000

const WorldEngine = dynamic(() => import('@/world/WeddingWorld'), { ssr: false })

function Content({ config }: { config: PublicConfig }) {
  const { reduced } = useWorldMotion()
  const [backTop, setBackTop] = useState(false)
  const [worldReady, setWorldReady] = useState(false)
  useEffect(() => {
    const hero = document.getElementById('home')
    if (!hero) return
    const observer = new IntersectionObserver(([entry]) => setBackTop(!entry.isIntersecting))
    observer.observe(hero)
    // Photos come first: the 3D engine and its model start once the photos are in, or sooner
    // if a 3D scene comes close to the screen, or after a time limit, so it never blocks them.
    const start = () => setWorldReady(true)
    const scenes = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) start() }, { rootMargin: '200% 0px' })
    document.querySelectorAll('[data-wedding-scene]').forEach(scene => scenes.observe(scene))
    const idle = () => { if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 2000 }); else start() }
    const cancel = afterPhotosSettled(idle)
    const latest = window.setTimeout(start, ENGINE_LATEST_MS)
    return () => { observer.disconnect(); scenes.disconnect(); cancel(); window.clearTimeout(latest) }
  }, [])
  useEffect(() => {
    const trap = (event: KeyboardEvent) => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
      if (!dialog || event.key !== 'Tab') return
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],video[controls],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(item => item.getClientRects().length)
      const first = items[0], last = items[items.length - 1]
      if (!first) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [])
  return <MotionConfig reducedMotion={reduced ? 'always' : 'user'} transition={reduced ? { duration: 0 } : undefined}>
    <a className="skip-link" href="#details">Skip to wedding details</a>
    <main>
      <Navbar config={config} />
      <div className="section-shell"><Hero config={config} /></div>
      <div className="section-shell"><Story bgUrl={config.storyBgUrl} chapters={config.storyChapters} heading={config.sectionHeadings.story} /></div>
      <div className="section-shell"><Countdown config={config} heading={config.sectionHeadings.countdown} /></div>
      <Details config={config} bgUrl={config.detailsBgUrl} />
      <Gallery bgUrl={config.galleryBgUrl} heading={config.sectionHeadings.gallery} />
      <WeddingJourney config={config} />
      <FAQSection bgUrl={config.faqBgUrl} heading={config.sectionHeadings.faq} />
      {config.presentation.showGames && <GamesSection />}
      <Footer config={config} />
    </main>
    <div className="back-top-wrap"><AnimatePresence>{backTop && <motion.button className="back-top" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? {} : { opacity: 0, y: 12 }} onClick={() => document.getElementById('home')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })} aria-label="Back to top"><img src={arrowUp} alt="" />Top</motion.button>}</AnimatePresence></div>
    <RSVPDialog config={config} />
    {worldReady && <WorldEngine />}
  </MotionConfig>
}

export function WeddingSite({ config }: { config: PublicConfig }) {
  return <SiteMotionProvider><Content config={config} /></SiteMotionProvider>
}
