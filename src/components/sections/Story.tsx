'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { STORY_CHAPTERS } from '@/lib/constants'
import { SectionHeader } from '@/components/ui/SectionHeader'
import clsx from 'clsx'

export function Story() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="story" className="bg-petal py-24 px-6">
      <SectionHeader eyebrow="Luis & Bee" heading="A story worth" headingItalic="telling" />

      <div
        ref={ref}
        className="grid grid-cols-2 md:grid-cols-3 gap-0 max-w-[860px] mx-auto"
        style={{ perspective: '1200px' }}
      >
        {STORY_CHAPTERS.map((chapter) => (
          <div key={chapter.id} className="flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 48, rotate: parseFloat(chapter.rotate) }}
              animate={inView ? {
                opacity: 1,
                y: 0,
                rotate: parseFloat(chapter.rotate),
              } : {}}
              transition={{
                duration: 0.7,
                delay: chapter.delay / 1000,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className={clsx(
                'instax-card bg-white relative cursor-pointer',
                'shadow-[0_4px_20px_rgba(46,31,26,0.09)]',
                'max-w-[200px] w-full',
                'p-3 pb-11'
              )}
              style={{ rotate: chapter.rotate.includes('-') ? `${parseFloat(chapter.rotate)}deg` : `${parseFloat(chapter.rotate)}deg` }}
            >
              {/* Photo area */}
              <div className={clsx('w-full aspect-square flex items-center justify-center mb-2 text-5xl', chapter.bg)}>
                {chapter.emoji}
              </div>

              {/* Caption */}
              <p className="font-display text-[12px] italic text-ink2 text-center leading-snug">
                {chapter.caption}
              </p>

              {/* Date stamp */}
              <span className="absolute bottom-[10px] right-3 text-[8px] tracking-[1.5px] text-muted">
                {chapter.stamp}
              </span>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  )
}
