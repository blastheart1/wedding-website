'use client'

import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, useInView } from 'framer-motion'
import {useWorldMotion} from '@/lib/site-motion'
import { STORY_CHAPTERS } from '@/lib/constants'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SectionBackground } from '@/components/ui/SectionBackground'
import type { StoryPhotoData, StoryChapter, SectionHeading } from '@/types'
import { DEFAULT_SECTION_HEADINGS } from '@/lib/constants'
import clsx from 'clsx'

interface StoryProps {
  bgUrl?:    string
  chapters?: StoryChapter[]
  heading?:  SectionHeading
}

export function Story({ bgUrl, chapters = STORY_CHAPTERS, heading = DEFAULT_SECTION_HEADINGS.story }: StoryProps) {
  const {reduced}=useWorldMotion()
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const [storyPhotos, setStoryPhotos] = useState<StoryPhotoData[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/story', { cache: 'no-store', signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error('Photos unavailable'); return res.json() })
      .then(data => { if (Array.isArray(data)) setStoryPhotos(data); else if (Array.isArray(data.photos)) setStoryPhotos(data.photos) })
      .catch(() => { /* Keep the accessible empty-state when media is unavailable. */ })
    return () => controller.abort()
  }, [])

  // Build a slot→photo map for quick lookup
  const photoBySlot = new Map<number, StoryPhotoData>()
  storyPhotos.forEach(p => photoBySlot.set(p.slot, p))

  return (
    <section id="story" className="relative min-h-[100svh] py-28 px-6">
      <SectionBackground imageUrl={bgUrl} fallbackColor="bg-petal" />

      <div className="relative z-10">
        <SectionHeader eyebrow={heading.eyebrow} heading={heading.heading} headingItalic={heading.italic} />

        <div
          ref={ref}
          className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-12 max-w-[1120px] mx-auto justify-items-center"
          style={{ perspective: '1200px' }}
        >
          {chapters.map((chapter) => {
            const deg   = parseFloat(chapter.rotate)
            const photo = photoBySlot.get(chapter.id)
            return (
              <motion.div
                key={chapter.id}
                initial={reduced?false:{ opacity: 0, y: 48, rotate: deg }}
                animate={reduced||inView ? { opacity: 1, y: 0, rotate: deg } : {}}
                whileHover={reduced?undefined:{ rotate: 0, y: -10, scale: 1.05, zIndex: 10 }}
                transition={{
                  duration: reduced?0:0.7,
                  delay: reduced?0:chapter.delay / 1000,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
                className={clsx(
                  'bg-white relative cursor-pointer',
                  'shadow-[0_4px_20px_rgba(46,31,26,0.09)]',
                  'hover:shadow-[0_20px_44px_rgba(46,31,26,0.13)]',
                  'max-w-[320px] w-full',
                  'p-3 pb-12',
                )}
              >
                {/* Photo area — uploaded photo or emoji fallback */}
                {photo ? (
                  <div className="relative w-full aspect-square bg-rule/20">
                    <Image
                      src={photo.url}
                      alt={photo.caption ?? chapter.caption}
                      fill
                      sizes="(max-width:640px) 44vw, 320px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className={clsx('w-full aspect-square flex items-center justify-center mb-2 text-5xl', chapter.bg)}>
                    {chapter.emoji}
                  </div>
                )}

                {/* Caption: photo caption takes priority over chapter default */}
                <p className="font-display text-[21px] italic text-ink2 text-center leading-snug mt-2">
                  {photo?.caption ?? chapter.caption}
                </p>

                {/* Date stamp */}
                <span className="absolute bottom-[10px] right-3 text-[14px] tracking-[1.5px] text-muted">
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
