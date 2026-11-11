'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {useWorldMotion} from '@/lib/site-motion'
import { fadeUp, stagger } from '@/lib/animations'

interface SectionHeaderProps {
  eyebrow:       string
  heading:       string
  headingItalic: string
}

export function SectionHeader({ eyebrow, heading, headingItalic }: SectionHeaderProps) {
  const {reduced}=useWorldMotion()
  const reveal=reduced?{hidden:{opacity:1,y:0},visible:{opacity:1,y:0,transition:{duration:0}}}:fadeUp
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      className="text-center mb-14"
      variants={stagger(reduced?0:0.12, 0)}
      initial={reduced?false:"hidden"}
      animate={reduced||inView ? 'visible' : 'hidden'}
    >
      <motion.p
        variants={reveal}
        className="text-[16px] tracking-[3px] uppercase text-rose mb-3"
      >
        {eyebrow}
      </motion.p>

      <motion.h2
        variants={reveal}
        className="font-display font-normal leading-[1.1] text-ink"
        style={{ fontSize: 'clamp(42px, 5vw, 68px)' }}
      >
        {heading} <em className="italic">{headingItalic}</em>
      </motion.h2>

      <motion.div variants={reveal} className="flex items-center justify-center gap-4 mt-5">
        <hr className="border-none border-t border-black/15 w-14" />
        <div className="w-[6px] h-[6px] rounded-full bg-black/15" />
        <hr className="border-none border-t border-black/15 w-14" />
      </motion.div>
    </motion.div>
  )
}
