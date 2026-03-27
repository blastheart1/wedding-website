'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { stagger, scaleReveal, fadeIn } from '@/lib/animations'
import type { GalleryPhotoData } from '@/types'
import clsx from 'clsx'

// Placeholder shown while photos are loading from DB
const PLACEHOLDER_SLOTS = [
  { id: -1, bg: 'bg-petal',   emoji: '🌸', span: true  },
  { id: -2, bg: 'bg-lavender',emoji: '💐', span: false },
  { id: -3, bg: 'bg-sage',    emoji: '🌿', span: false },
  { id: -4, bg: 'bg-peach',   emoji: '🌷', span: false },
  { id: -5, bg: 'bg-blush',   emoji: '✨', span: false },
]

export function Gallery() {
  const [photos,   setPhotos]   = useState<GalleryPhotoData[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lightbox, setLightbox] = useState<GalleryPhotoData | null>(null)

  useEffect(() => {
    fetch('/api/gallery')
      .then(r => r.json())
      .then(j => setPhotos(j.photos ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [])

  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const hasPhotos = !loading && photos.length > 0

  return (
    <section id="gallery" className="bg-sage py-24 px-6">
      <SectionHeader eyebrow="Luis & Bee" heading="Moments we" headingItalic="cherish" />

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      <motion.div
        ref={ref}
        className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-[880px] mx-auto"
        variants={stagger(0.08, 0)}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
      >
        {hasPhotos
          ? photos.map((photo, idx) => (
              <motion.div
                key={photo.id}
                variants={scaleReveal}
                onClick={() => setLightbox(photo)}
                className={clsx(
                  'overflow-hidden cursor-pointer relative group rounded-sm',
                  idx === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square',
                )}
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? `Wedding photo ${idx + 1}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {photo.caption && (
                  <div className="absolute inset-0 bg-ink/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <span className="text-white text-[11px] tracking-[2px] uppercase font-medium drop-shadow">
                      {photo.caption}
                    </span>
                  </div>
                )}
              </motion.div>
            ))
          : PLACEHOLDER_SLOTS.map((slot) => (
              <motion.div
                key={slot.id}
                variants={scaleReveal}
                className={clsx(
                  'overflow-hidden rounded-sm',
                  slot.span ? 'col-span-2 aspect-[2/1]' : 'aspect-square',
                )}
              >
                <div className={clsx(
                  'w-full h-full flex items-center justify-center',
                  loading ? 'animate-pulse bg-rule/40' : `${slot.bg} text-5xl`,
                )}>
                  {!loading && slot.emoji}
                </div>
              </motion.div>
            ))
        }
      </motion.div>

      {/* ── Lightbox ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            key="lightbox"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 bg-ink/85 z-50 flex items-center justify-center p-6"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              exit={{    scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white p-4 max-w-2xl w-full rounded-sm relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 text-muted hover:text-ink transition-colors text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
              <div className="relative w-full aspect-video">
                <Image
                  src={lightbox.url}
                  alt={lightbox.caption ?? 'Wedding photo'}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 672px"
                />
              </div>
              {lightbox.caption && (
                <p className="font-display italic text-ink2 text-center mt-3 text-[15px]">
                  {lightbox.caption}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
