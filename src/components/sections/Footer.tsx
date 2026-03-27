'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import type { PublicConfig } from '@/lib/config'
import { stagger, fadeUp, fadeIn } from '@/lib/animations'

interface FooterProps {
  config: Pick<PublicConfig, 'partner1' | 'partner2' | 'weddingDate' | 'location'>
}

function formatFooterDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function Footer({ config }: FooterProps) {
  const { partner1, partner2, weddingDate, location } = config
  const displayDate = formatFooterDate(weddingDate)
  const initials    = `${partner1[0]} & ${partner2[0]}`

  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <footer className="bg-ink text-white text-center px-6 overflow-hidden min-h-screen flex flex-col items-center justify-center">
      <motion.div
        ref={ref}
        variants={stagger(0.12, 0)}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
      >
        <motion.span
          variants={fadeIn}
          className="font-display font-light italic text-white block mb-4"
          style={{ fontSize: '56px', letterSpacing: '10px' }}
        >
          {initials}
        </motion.span>

        <motion.p variants={fadeUp} className="text-[9px] tracking-[4px] uppercase opacity-40">
          {displayDate}
        </motion.p>

        {location && location !== 'TBA' && (
          <motion.p variants={fadeUp} className="text-[9px] tracking-[3px] uppercase opacity-30 mt-1">
            {location}
          </motion.p>
        )}

        <motion.p variants={fadeUp} className="text-[9px] tracking-[2px] uppercase opacity-20 mt-4">
          Made with love 🌸
        </motion.p>
      </motion.div>
    </footer>
  )
}
