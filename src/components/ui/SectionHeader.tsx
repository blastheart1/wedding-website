'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/animations'

interface SectionHeaderProps {
  eyebrow:       string
  heading:       string
  headingItalic: string
}

export function SectionHeader({ eyebrow, heading, headingItalic }: SectionHeaderProps) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      className="text-center mb-14"
      variants={stagger(0.12, 0)}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
    >
      <motion.p
        variants={fadeUp}
        className="text-[10px] tracking-[5px] uppercase text-rose mb-3"
      >
        {eyebrow}
      </motion.p>

      <motion.h2
        variants={fadeUp}
        className="font-display font-light leading-[1.1] text-ink"
        style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
      >
        {heading} <em className="italic">{headingItalic}</em>
      </motion.h2>

      <motion.div variants={fadeUp} className="flex items-center justify-center gap-4 mt-5">
        <hr className="border-none border-t border-rule w-14" />
        <div className="w-[6px] h-[6px] rounded-full bg-rose opacity-50" />
        <hr className="border-none border-t border-rule w-14" />
      </motion.div>
    </motion.div>
  )
}
