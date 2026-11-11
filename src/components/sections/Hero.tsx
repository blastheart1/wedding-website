'use client'

import {openWeddingRsvp} from '@/lib/rsvp-dialog'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {useWorldMotion} from '@/lib/site-motion'
import {backgrounds} from '@/extra-assets'
import type { PublicConfig } from '@/lib/config'

interface HeroProps {
  config: Pick<PublicConfig, 'partner1' | 'partner2' | 'weddingDate' | 'location' | 'heroVideoUrl' | 'heroBgUrl'>
}

function formatWeddingDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const ease = [0.22, 1, 0.36, 1] as const

export function Hero({ config }: HeroProps) {
  const { partner1, partner2, weddingDate, location, heroVideoUrl, heroBgUrl } = config
  const displayDate  = formatWeddingDate(weddingDate)
  const hasVideo     = !!heroVideoUrl
  const hasBgImage   = !hasVideo && !!heroBgUrl
  const {reduced} = useWorldMotion()
  const backgroundRef = useRef<HTMLVideoElement>(null)
  const [modal, setModal] = useState(false)
  useEffect(() => {
    const video=backgroundRef.current
    if(!video)return
    if(reduced){video.pause();return}
    video.play().then(()=>{if(document.documentElement.dataset.siteMotion==='reduced')video.pause()}).catch(()=>{})
  }, [reduced])
  useEffect(() => { if (!modal) return; const prior = document.activeElement as HTMLElement; const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(false) }; document.addEventListener('keydown',handler); const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=old;prior?.focus()} },[modal])
  const modalVideoRef     = useRef<HTMLVideoElement>(null)

  const openModal  = () => setModal(true)
  const closeModal = () => {
    setModal(false)
    modalVideoRef.current?.pause()
  }

  // Text colours flip based on whether video or bg image (dark overlay) is present
  const hasDarkBg      = hasVideo || hasBgImage
  const textColor      = hasDarkBg ? 'text-white'        : 'text-ink'
  const subTextColor   = hasDarkBg ? 'text-white'     : 'text-muted'
  const roseNameColor  = hasDarkBg ? 'text-blush'        : 'text-rose'
  const ornamentColor  = hasDarkBg ? 'bg-white/40'       : 'bg-blush'
  const dateColor      = hasDarkBg ? 'text-white'     : 'text-ink2'
  const ghostBtnClass  = hasDarkBg
    ? 'border border-white/50 text-white hover:bg-white/10'
    : 'border border-rule text-ink hover:bg-petal hover:border-ink2'

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        id="home"
        className="relative flex items-center justify-center overflow-hidden"
        style={{ height: '100svh', minHeight: '600px' }}
      >
        {/* Background: video > static image > plain cream */}
        {hasVideo ? (
          <video
            key={heroVideoUrl}
            poster={backgrounds.storyBgUrl}
            ref={backgroundRef}
            autoPlay={!reduced}
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden="true"
            src={heroVideoUrl}
          />
        ) : hasBgImage ? (
          <>
            <img
              src={heroBgUrl}
              alt="Hero background"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-ink/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-cream" />
        )}

        {/* Dark overlay for video readability */}
        {hasVideo && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/65" />
        )}

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={reduced ? {duration:0} : { duration: 0.8, delay: 0.2, ease }}
            className={`text-[16px] tracking-[3px] uppercase mb-6 ${subTextColor}`}
          >
            Together forever
          </motion.p>

          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
            transition={reduced ? {duration:0} : { duration: 0.95, delay: 0.38, ease }}
            className={`font-display font-light leading-[0.95] mb-6 ${textColor}`}
            style={{ fontSize: 'clamp(64px, 10vw, 120px)' }}
          >
            <em className={`italic ${roseNameColor}`}>{partner1}</em>
            <br />& {partner2}
          </motion.h1>

          {/* Ornament + date */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={reduced ? {duration:0} : { duration: 0.8, delay: 0.55, ease }}
            className="flex items-center justify-center gap-5 mb-2"
          >
            <span className={`block w-11 h-px ${ornamentColor}`} />
            <span className={`font-display text-[27px] font-light italic tracking-[2px] ${dateColor}`}>
              {displayDate}
            </span>
            <span className={`block w-11 h-px ${ornamentColor}`} />
          </motion.div>

          {location && location !== 'TBA' && (
            <motion.p
              initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
              transition={reduced ? {duration:0} : { duration: 0.7, delay: 0.65, ease }}
              className={`text-[16px] tracking-[3px] uppercase mb-2 ${subTextColor}`}
            >
              {location}
            </motion.p>
          )}

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={reduced ? {duration:0} : { duration: 0.7, delay: 0.7, ease }}
            className={`text-[16px] tracking-[3px] uppercase mb-11 ${subTextColor}`}
          >
            Save the Date
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={reduced ? {duration:0} : { duration: 0.7, delay: 0.85, ease }}
            className="flex justify-center"
          >
            {/* Equal columns: the RSVP button always matches the width of the story button. */}
            <div className="inline-grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button type="button" onClick={openWeddingRsvp}
              className="flex w-full items-center justify-center border border-white/50 text-white text-[16px] tracking-[3px] uppercase px-8 py-[14px] rounded-sm hover:bg-white/10 transition-colors"
            >
              RSVP
            </button>

            {hasVideo ? (
              <button
                onClick={openModal}
                className={`flex w-full items-center justify-center gap-3 whitespace-nowrap text-[16px] tracking-[3px] uppercase px-8 py-[14px] rounded-sm transition-colors ${ghostBtnClass}`}
              >
                {/* Play icon */}
                <span className={`flex items-center justify-center w-5 h-5 rounded-full border ${hasVideo ? 'border-white/60' : 'border-ink/40'}`}>
                  <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor">
                    <path d="M1 1.5l6 3-6 3V1.5z" />
                  </svg>
                </span>
                Watch our story
              </button>
            ) : (
              <a
                href="#story"
                className={`flex w-full items-center justify-center whitespace-nowrap text-[16px] tracking-[3px] uppercase px-8 py-[14px] rounded-sm transition-colors ${ghostBtnClass}`}
              >
                Our Story
              </a>
            )}
            </div>
          </motion.div>
        </div>

        {/* ── Scroll cue ─────────────────────────────────────────────────── */}
        <motion.div
          initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
          transition={reduced ? {duration:0} : { delay: 1.4, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <motion.div
            animate={reduced ? {y:0} : { y: [0, 6, 0] }}
            transition={{ repeat: reduced ? 0 : Infinity, duration: reduced ? 0 : 1.8, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-2"
          >
            <div className={`w-px h-8 ${hasVideo ? 'bg-white/30' : 'bg-rule'}`} />
            <span className={`text-[14px] tracking-[3px] uppercase ${subTextColor}`}>Scroll</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Video modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <motion.div
            key="video-modal" role="dialog" aria-modal="true" aria-label="Our story video"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? {duration:0} : { duration: 0.3 }}
            className="fixed inset-0 z-[950] flex items-center justify-center bg-ink/95 backdrop-blur-md p-4 md:p-8"
            onClick={closeModal}
          >
            <motion.div
              initial={reduced ? false : { scale: 0.93, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{    scale: 0.93, opacity: 0 }}
              transition={reduced ? {duration:0} : { duration: 0.35, ease }}
              className="relative w-full max-w-5xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={closeModal}
                autoFocus
                aria-label="Close video"
                className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors text-[16px] tracking-[2px] uppercase flex items-center gap-2"
              >
                <span>Close</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>

              <video
                key={heroVideoUrl}
                ref={modalVideoRef}
                src={heroVideoUrl}
                controls
                autoPlay
                playsInline
                className="w-full rounded-sm aspect-video bg-ink"
                style={{ maxHeight: '80vh' }}
              />

              <p className="text-center mt-4 font-display italic text-white/50 text-[15px]">
                {partner1} & {partner2} — {displayDate}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
