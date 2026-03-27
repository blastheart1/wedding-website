'use client'

import { motion } from 'framer-motion'
import type { PublicConfig } from '@/lib/config'

interface HeroProps {
  config: Pick<PublicConfig, 'partner1' | 'partner2' | 'weddingDate' | 'location'>
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
  const { partner1, partner2, weddingDate, location } = config
  const displayDate = formatWeddingDate(weddingDate)

  return (
    <div id="home" className="relative bg-white flex flex-col items-center overflow-hidden">

      {/* ── Top floral garland ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="floral-banner w-full h-[200px] md:h-[240px] flex-shrink-0"
      />

      {/* ── Names & date ──────────────────────────────────────────────── */}
      <div className="relative z-10 text-center px-8 py-16 md:py-20 bg-white w-full">

        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease }}
          className="text-[10px] tracking-[6px] uppercase text-muted mb-6"
        >
          Together forever
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, delay: 0.38, ease }}
          className="font-display font-light leading-[0.95] text-ink mb-6"
          style={{ fontSize: 'clamp(64px, 10vw, 120px)' }}
        >
          <em className="text-rose italic">{partner1}</em>
          <br />& {partner2}
        </motion.h1>

        {/* Ornament + date */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55, ease }}
          className="flex items-center justify-center gap-5 mb-2"
        >
          <span className="block w-11 h-px bg-blush" />
          <span className="font-display text-[19px] font-light italic text-ink2 tracking-[2px]">
            {displayDate}
          </span>
          <span className="block w-11 h-px bg-blush" />
        </motion.div>

        {location && location !== 'TBA' && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.65, ease }}
            className="text-[11px] tracking-[3px] uppercase text-muted mb-2"
          >
            {location}
          </motion.p>
        )}

        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease }}
          className="text-[10px] tracking-[5px] uppercase text-muted mb-11"
        >
          Save the Date
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.85, ease }}
          className="flex gap-4 justify-center flex-wrap"
        >
          <a
            href="#rsvp"
            className="bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium px-8 py-[14px] rounded-sm hover:bg-rosedark transition-colors"
          >
            RSVP
          </a>
          <a
            href="#story"
            className="border border-rule text-ink text-[10px] tracking-[3px] uppercase px-8 py-[14px] rounded-sm hover:bg-petal hover:border-ink2 transition-colors"
          >
            Our Story
          </a>
        </motion.div>
      </div>

      {/* ── Bottom floral garland (mirrored) ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.1, ease: 'easeOut' }}
        className="floral-banner-flip w-full h-[200px] md:h-[240px] flex-shrink-0"
      />

      {/* ── Scroll cue ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="absolute bottom-[200px] md:bottom-[240px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 mb-2"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2"
        >
          <div className="w-px h-8 bg-rule" />
          <span className="text-[9px] tracking-[3px] uppercase text-muted">Scroll</span>
        </motion.div>
      </motion.div>
    </div>
  )
}
