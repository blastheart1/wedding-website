'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import type { PublicConfig } from '@/lib/config'
import { stagger, fadeUp, fadeIn } from '@/lib/animations'
import {useWorldMotion} from '@/lib/site-motion'
import { CornerPeel } from '@/components/footer/CornerPeel'

interface FooterProps {
  config: Pick<PublicConfig, 'partner1' | 'partner2' | 'weddingDate' | 'location' | 'presentation'>
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
  const {reduced}=useWorldMotion()
  const reveal=reduced?{hidden:{opacity:1,y:0},visible:{opacity:1,y:0,transition:{duration:0}}}:fadeUp
  const { partner1, partner2, weddingDate, location } = config
  const displayDate = formatFooterDate(weddingDate)
  const initials    = `${partner1[0]} & ${partner2[0]}`

  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <footer className="wedding-footer relative bg-ink text-white text-center px-6 overflow-hidden min-h-screen flex flex-col items-center justify-center">
      <motion.div
        ref={ref}
        variants={stagger(reduced?0:0.12, 0)}
        initial={reduced?false:"hidden"}
        animate={reduced||inView ? 'visible' : 'hidden'}
      >
        <motion.span
          variants={reduced?reveal:fadeIn}
          className="font-display font-light italic text-white block mb-4"
          style={{ fontSize: '56px', letterSpacing: '10px' }}
        >
          {initials}
        </motion.span>

        <motion.p variants={reveal} className="text-[16px] tracking-[4px] uppercase opacity-80">
          {displayDate}
        </motion.p>

        {location && location !== 'TBA' && (
          <motion.p variants={reveal} className="text-[16px] tracking-[3px] uppercase opacity-80 mt-1">
            {location}
          </motion.p>
        )}

      </motion.div>
      {/* The maker's contact is tucked under a folded corner, out of the way of the names above. */}
      <CornerPeel email={config.presentation.footerContactEmail} url={config.presentation.footerContactUrl} />
    </footer>
  )
}
