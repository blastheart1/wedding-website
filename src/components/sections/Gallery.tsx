'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  motion, useScroll, useTransform, useSpring, useInView, AnimatePresence,
  type MotionValue,
} from 'framer-motion'
import { SectionHeader }    from '@/components/ui/SectionHeader'
import { SectionBackground } from '@/components/ui/SectionBackground'
import { fadeIn }            from '@/lib/animations'
import type { GalleryPhotoData } from '@/types'
import clsx from 'clsx'

// ─── Gallery flower overlay — fixed-position, scroll-driven ──────────────────
// Each flower pops in at a different scrollYProgress threshold so they
// appear one-by-one as the user scrolls through the instax stack.
const GALLERY_OVERLAY_FLOWERS = [
  { src: '/flowers/home-petals-left.png',   style: { left: '1vw',   bottom: '22vh', width: 'clamp(90px,11vw,160px)'  }, threshold: [0.12, 0.18] as [number,number], rotate: -8  },
  { src: '/flowers/s2-flower-right.png',    style: { right: '1vw',  bottom: '28vh', width: 'clamp(100px,13vw,180px)' }, threshold: [0.28, 0.34] as [number,number], rotate: 10  },
  { src: '/flowers/s2-lily-right.png',      style: { right: '2vw',  bottom: '8vh',  width: 'clamp(110px,14vw,200px)' }, threshold: [0.44, 0.50] as [number,number], rotate: -6  },
  { src: '/flowers/s3-flower-left.png',     style: { left: '2vw',   bottom: '10vh', width: 'clamp(100px,13vw,185px)' }, threshold: [0.60, 0.66] as [number,number], rotate: 7   },
  { src: '/flowers/s2-petals-right.png',    style: { right: '3vw',  bottom: '44vh', width: 'clamp(70px, 9vw, 130px)' }, threshold: [0.74, 0.80] as [number,number], rotate: -10 },
  { src: '/flowers/home-flowers-left.png',  style: { left: '-4.5vw', bottom: '38vh', width: 'clamp(110px,15vw,200px)' }, threshold: [0.84, 0.90] as [number,number], rotate: 5   },
]

function GalleryFlowers({
  scrollYProgress,
  scrollOffscreen,
  stickyEndFraction,
}: {
  scrollYProgress:   MotionValue<number>
  // tracks 0→1 as the entire section scrolls from entering to fully above viewport
  scrollOffscreen:   MotionValue<number>
  // fraction of scrollOffscreen at which the sticky phase ends (~total/(total+1))
  stickyEndFraction: number
}) {
  // After the sticky phase the section scrolls up — flowers must follow in lockstep.
  // No spring here: we want pixel-perfect sync with the section leaving the viewport.
  // scrollOffscreen goes stickyEndFraction→1 as the section scrolls exactly 1vh off-screen.
  const exitY = useTransform(scrollOffscreen, [stickyEndFraction, 1.0], ['0vh', '-110vh'])

  return (
    <>
      {GALLERY_OVERLAY_FLOWERS.map((f, i) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const rawOpacity = useTransform(scrollYProgress, f.threshold, [0, 1])
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity    = useSpring(rawOpacity, { stiffness: 120, damping: 20 })
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const scale      = useTransform(rawOpacity, [0, 1], [0.72, 1])
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const rotate     = useTransform(rawOpacity, [0, 1], [f.rotate * 2, 0])

        return (
          <motion.div
            key={i}
            style={{
              position: 'fixed',
              pointerEvents: 'none',
              zIndex: 5,
              opacity,
              scale,
              rotate,
              y: exitY,  // sweep upward in lockstep with the section
              ...f.style,
            }}
          >
            <Image
              src={f.src}
              alt="Decorative flower"
              width={300}
              height={300}
              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
              priority={false}
            />
          </motion.div>
        )
      })}
    </>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROTATIONS = [-4, 3, -2.5, 5, -1.5, 3.5, -3, 2, -5, 4, -2, 3.5]

const PLACEHOLDER_SLOTS = [
  { id: -1, bg: 'bg-petal',    emoji: '🌸' },
  { id: -2, bg: 'bg-lavender', emoji: '💐' },
  { id: -3, bg: 'bg-sage',     emoji: '🌿' },
  { id: -4, bg: 'bg-peach',    emoji: '🌷' },
  { id: -5, bg: 'bg-blush',    emoji: '✨' },
]

// ─── Single stacking card ─────────────────────────────────────────────────────
function StackCard({
  photo,
  placeholder,
  index,
  total,
  scrollYProgress,
  onClick,
}: {
  photo?:       GalleryPhotoData
  placeholder?: typeof PLACEHOLDER_SLOTS[number]
  index:        number
  total:        number
  scrollYProgress: MotionValue<number>
  onClick?:     () => void
}) {
  const rotation = ROTATIONS[index % ROTATIONS.length]

  // +1 denominator adds a "rest" period at the end where all cards are stacked
  const N = total + 1
  const entryStart = index / N        // when this card begins flying in
  const entryMid   = (index + 0.5) / N // when it fully lands
  // Avoid duplicate "0" in the input range (index 0 has entryStart === 0) — framer-motion
  // useTransform mis-interpolates duplicate keys and breaks the stack animation.
  const yRangeStart = Math.max(entryStart, 0.001)

  // Slide up from below during entry segment, stay at 0 afterward
  const y = useTransform(
    scrollYProgress,
    [0, yRangeStart, entryMid, 1],
    ['115%', '115%', '0%', '0%'],
  )

  // Older cards scale down as newer ones stack on top
  const cardsAbove = total - 1 - index
  const finalScale = Math.max(0.82, 1 - cardsAbove * 0.028)
  const scale = useTransform(
    scrollYProgress,
    [entryMid, 1],
    [1, finalScale],
    { clamp: true },
  )

  return (
    <motion.div
      style={{ y, scale, rotate: rotation, zIndex: index + 1 }}
      className="absolute inset-0 flex items-center justify-center"
      onClick={onClick}
    >
      <motion.div
        whileHover={onClick ? { y: -10, boxShadow: '0 24px 60px rgba(46,31,26,0.22)' } : undefined}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={clsx(
          'bg-white p-3 pb-14 w-[210px] sm:w-[312px]',
          'shadow-[0_8px_40px_rgba(46,31,26,0.14)]',
          onClick && 'cursor-pointer select-none',
        )}
      >
        {photo ? (
          <div className="relative w-full aspect-square bg-rule/20">
            <Image
              src={photo.url}
              alt={photo.caption ?? `Photo ${index + 1}`}
              fill
              sizes="(max-width: 640px) 210px, 312px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className={clsx(
            'w-full aspect-square flex items-center justify-center text-5xl',
            placeholder?.bg ?? 'bg-petal',
          )}>
            {placeholder?.emoji ?? '🌸'}
          </div>
        )}
        {photo?.caption && (
          <p className="font-display italic text-ink2 text-[12px] text-center mt-2 leading-snug">
            {photo.caption}
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Animated scroll hint (fades out as stack begins) ─────────────────────────
function ScrollHint({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  const opacity = useTransform(scrollYProgress, [0, 0.12], [1, 0])
  return (
    <motion.div
      style={{ opacity }}
      className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-20"
    >
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        className="flex flex-col items-center gap-2"
      >
        <div className="w-px h-11 bg-ink/20" />
        <span className="text-[12px] tracking-[4px] uppercase text-muted">Scroll to stack</span>
      </motion.div>
    </motion.div>
  )
}

// ─── Progress bar (how many cards have landed) ────────────────────────────────
function StackProgress({
  total,
  scrollYProgress,
}: {
  total: number
  scrollYProgress: MotionValue<number>
}) {
  const width = useTransform(
    scrollYProgress,
    [0, (total - 0.5) / (total + 1)],
    ['0%', '100%'],
    { clamp: true },
  )
  return (
    <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-32 h-[2px] bg-ink/10 z-20">
      <motion.div style={{ width }} className="h-full bg-rose/60" />
    </div>
  )
}

// ─── Main Gallery ─────────────────────────────────────────────────────────────
export function Gallery({ bgUrl }: { bgUrl?: string }) {
  const [photos,   setPhotos]   = useState<GalleryPhotoData[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/gallery', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setPhotos(j.photos ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [])

  const trackRef = useRef<HTMLElement>(null)

  // 0→1 during the sticky phase only (end end = section bottom at viewport bottom)
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', 'end end'],
  })

  // 0→1 from section entering to completely scrolled above viewport (end start)
  // This covers both the sticky phase AND the post-sticky natural scroll.
  const { scrollYProgress: scrollOffscreen } = useScroll({
    target: trackRef,
    offset: ['start start', 'end start'],
  })

  const bottleInView = useInView(trackRef, { once: true, amount: 0.05 })

  const hasPhotos = !loading && photos.length > 0
  // Show at most 10 photos in the stack; beyond that still loads in gallery grid
  const stackItems  = hasPhotos ? photos.slice(0, 10) : PLACEHOLDER_SLOTS
  const total       = stackItems.length

  const lightboxPhoto = lightbox !== null && hasPhotos ? photos[lightbox] : null

  const prevPhoto = () => setLightbox(i => (i !== null && i > 0 ? i - 1 : i))
  const nextPhoto = () => setLightbox(i => (i !== null && i < photos.length - 1 ? i + 1 : i))

  return (
    <>
      {/* Fixed flower overlays — appear one-by-one, exit with the section */}
      <GalleryFlowers
        scrollYProgress={scrollYProgress}
        scrollOffscreen={scrollOffscreen}
        stickyEndFraction={total / (total + 1)}
      />

      {/*
       * ── Sticky scroll stack ──────────────────────────────────────────────
       *
       * The "track" div is (total + 1) × 100 vh tall — giving the browser
       * scroll real-estate. The inner div is `sticky top-0 h-screen`, so it
       * stays pinned while the user scrolls through the track. Cards animate
       * in one-by-one driven by scrollYProgress [0 → 1].
       *
       * This pattern is called a "scroll-pinned sticky stack".
       */}
      <section
        id="gallery"
        ref={trackRef}
        style={{ height: `${(total + 1) * 100}svh` }}
        className="relative"
      >
        <div className="sticky top-0 h-[100svh] min-h-0 relative flex flex-col overflow-hidden">
          <SectionBackground imageUrl={bgUrl} fallbackColor="bg-sage" overlayClass="bg-white/20" />

          {/* Champagne bottle — lower-left, behind all instax cards (z-index 0) */}
          <motion.div
            initial={{ opacity: 0, x: -80, y: 40, rotate: -18 }}
            animate={bottleInView ? { opacity: 1, x: 0, y: 0, rotate: -6 } : {}}
            transition={{ duration: 1.0, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ position: 'absolute', bottom: '-18%', left: '-12%', width: 'clamp(780px, 120vw, 1400px)', zIndex: 0 }}
          >
            <Image
              src="/champagne-bottle.png"
              alt="Champagne bottle"
              width={600}
              height={1000}
              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          </motion.div>

          {/* Section header — visible at top of sticky viewport */}
          <div className="relative z-10 shrink-0 pt-16 pb-4">
            <SectionHeader
              eyebrow="Luis & Bee"
              heading="Moments we"
              headingItalic="cherish"
            />
          </div>

          {/* Stack arena — cards positioned absolutely inside here */}
          <div className="relative z-10 flex-1 min-h-0 min-w-0">
            {stackItems.map((item, i) =>
              hasPhotos ? (
                <StackCard
                  key={(item as GalleryPhotoData).id}
                  photo={item as GalleryPhotoData}
                  index={i}
                  total={total}
                  scrollYProgress={scrollYProgress}
                  onClick={() => setLightbox(i)}
                />
              ) : (
                <StackCard
                  key={(item as typeof PLACEHOLDER_SLOTS[number]).id}
                  placeholder={item as typeof PLACEHOLDER_SLOTS[number]}
                  index={i}
                  total={total}
                  scrollYProgress={scrollYProgress}
                />
              ),
            )}
          </div>

          <ScrollHint scrollYProgress={scrollYProgress} />
          <StackProgress total={total} scrollYProgress={scrollYProgress} />
        </div>
      </section>

      {/* ── Lightbox with prev/next navigation ───────────────────────────── */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            key="lightbox"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 bg-ink/92 z-[950] flex items-center justify-center p-4 md:p-8"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{    scale: 0.93, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative max-w-2xl w-full"
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={() => setLightbox(null)}
                aria-label="Close"
                className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors text-[11px] tracking-[2px] uppercase flex items-center gap-2"
              >
                Close
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              <div className="bg-white p-4">
                <div className="relative w-full aspect-video">
                  <Image
                    src={lightboxPhoto.url}
                    alt={lightboxPhoto.caption ?? 'Wedding photo'}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 672px"
                  />
                </div>
                {lightboxPhoto.caption && (
                  <p className="font-display italic text-ink2 text-center mt-3 text-[15px]">
                    {lightboxPhoto.caption}
                  </p>
                )}
              </div>

              {/* Prev / Next */}
              {photos.length > 1 && (
                <div className="flex items-center justify-between mt-4 px-1">
                  <button
                    onClick={prevPhoto}
                    disabled={lightbox === 0}
                    className="text-white/60 hover:text-white disabled:opacity-25 transition-colors text-[10px] tracking-[2px] uppercase"
                  >
                    ← Prev
                  </button>
                  <span className="text-white/40 text-[10px] tracking-[2px]">
                    {(lightbox ?? 0) + 1} / {photos.length}
                  </span>
                  <button
                    onClick={nextPhoto}
                    disabled={lightbox === photos.length - 1}
                    className="text-white/60 hover:text-white disabled:opacity-25 transition-colors text-[10px] tracking-[2px] uppercase"
                  >
                    Next →
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
