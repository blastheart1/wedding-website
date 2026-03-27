'use client'

import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, useInView } from 'framer-motion'
import { STORY_CHAPTERS } from '@/lib/constants'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { StoryPhotoData } from '@/types'
import clsx from 'clsx'

interface StoryProps {
  bgUrl?: string
}

export function Story({ bgUrl }: StoryProps) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const [storyPhotos, setStoryPhotos] = useState<StoryPhotoData[]>([])

  useEffect(() => {
    fetch('/api/story')
      .then(r => r.json())
      .then(j => setStoryPhotos(j.photos ?? []))
      .catch(() => setStoryPhotos([]))
  }, [])

  // Build a slot→photo map for quick lookup
  const photoBySlot = new Map<number, StoryPhotoData>()
  storyPhotos.forEach(p => photoBySlot.set(p.slot, p))

  return (
    <section id="story" className="relative py-24 px-6">
      {/* Background: image + overlay, or plain color fallback */}
      {bgUrl ? (
        <>
          <div className="absolute inset-0">
            <Image
              src={bgUrl}
              alt="Story section background"
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
          <div className="absolute inset-0 bg-white/65" />
        </>
      ) : (
        <div className="absolute inset-0 bg-petal" />
      )}

      <div className="relative z-10">
        <SectionHeader eyebrow="Luis & Bee" heading="A story worth" headingItalic="telling" />

        <div
          ref={ref}
          className="grid grid-cols-2 sm:grid-cols-3 gap-0 max-w-[860px] mx-auto justify-items-center"
          style={{ perspective: '1200px' }}
        >
          {STORY_CHAPTERS.map((chapter) => {
            const deg   = parseFloat(chapter.rotate)
            const photo = photoBySlot.get(chapter.id)
            return (
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, y: 48, rotate: deg }}
                animate={inView ? { opacity: 1, y: 0, rotate: deg } : {}}
                whileHover={{ rotate: 0, y: -10, scale: 1.05, zIndex: 10 }}
                transition={{
                  duration: 0.7,
                  delay: chapter.delay / 1000,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
                className={clsx(
                  'bg-white relative cursor-pointer',
                  'shadow-[0_4px_20px_rgba(46,31,26,0.09)]',
                  'hover:shadow-[0_20px_44px_rgba(46,31,26,0.13)]',
                  'max-w-[200px] w-full',
                  'p-3 pb-11',
                )}
              >
                {/* Photo area — uploaded photo or emoji fallback */}
                {photo ? (
                  <div className="relative w-full aspect-square bg-rule/20">
                    <Image
                      src={photo.url}
                      alt={photo.caption ?? chapter.caption}
                      fill
                      sizes="200px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className={clsx('w-full aspect-square flex items-center justify-center mb-2 text-5xl', chapter.bg)}>
                    {chapter.emoji}
                  </div>
                )}

                {/* Caption: photo caption takes priority over chapter default */}
                <p className="font-display text-[12px] italic text-ink2 text-center leading-snug mt-2">
                  {photo?.caption ?? chapter.caption}
                </p>

                {/* Date stamp */}
                <span className="absolute bottom-[10px] right-3 text-[8px] tracking-[1.5px] text-muted">
                  {chapter.stamp}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
