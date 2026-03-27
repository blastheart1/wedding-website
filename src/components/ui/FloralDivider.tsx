'use client'

import { useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'

// ─── FloralBand ───────────────────────────────────────────────────────────────
// Scroll-parallax garland band. Fades in as it enters viewport and
// moves slightly as you scroll past — giving an organic "pop-out" feel.
export function FloralBand({ height = 140, flip = false }: { height?: number; flip?: boolean }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const inView = useInView(ref, { once: true, margin: '-5%' })

  const y       = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 0.88, 0.88, 0])

  return (
    <div ref={ref} style={{ height, overflow: 'hidden', position: 'relative' }}>
      <motion.div
        style={{
          y,
          opacity,
          scaleY:             flip ? -1 : 1,
          position:           'absolute',
          inset:              0,
          backgroundImage:    "url('/flowers/garland.webp')",
          backgroundSize:     'cover',
          backgroundPosition: 'center 40%',
          backgroundRepeat:   'no-repeat',
        }}
        initial={{ scaleX: 0.7 }}
        animate={inView ? { scaleX: 1 } : {}}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

// ─── FloralPop ────────────────────────────────────────────────────────────────
// Decorative petal row that springs into view on scroll — each petal
// animates with a slight overshoot (spring ease) for a lively feel.
const PETALS = ['🌸', '🌺', '🌷', '🌼', '🌻']

export function FloralPop({ className = '' }: { className?: string }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })

  return (
    <div ref={ref} className={`flex items-center justify-center gap-5 py-5 ${className}`}>
      {PETALS.map((petal, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -25, opacity: 0 }}
          animate={inView ? { scale: 1, rotate: 0, opacity: 1 } : {}}
          transition={{
            delay:    i * 0.07,
            duration: 0.5,
            ease:     [0.34, 1.56, 0.64, 1],
          }}
          className="text-2xl select-none"
        >
          {petal}
        </motion.span>
      ))}
    </div>
  )
}

// ─── Legacy FloralDivider (kept for any existing imports) ─────────────────────
export function FloralDivider({ height = 120, flip = false, opacity = 0.85 }: {
  height?:  number
  flip?:    boolean
  opacity?: number
}) {
  return <FloralBand height={height} flip={flip} />
}
