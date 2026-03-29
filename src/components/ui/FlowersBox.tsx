'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlowerDef {
  src:   string
  alt:   string
  side:  'left' | 'right'
  /** CSS value from the edge (e.g. '-5vw', '3%') */
  edge:  string
  /** CSS top value (e.g. '55%', '200px') */
  top:   string
  width: string
  /** How far off-screen it starts (px) */
  startX: number
  startY: number
  startRotate: number
  /** @deprecated — scroll-driven animation ignores threshold */
  threshold?: number
}

interface FlowersBoxProps {
  flowers: FlowerDef[]
  className?: string
}

// ─── SingleFlower — scroll-relative: rewinds when scrolling back up ───────────
function SingleFlower({ flower }: { flower: FlowerDef }) {
  const ref = useRef<HTMLDivElement>(null)

  // scrollYProgress: 0 = flower just entering viewport from bottom,
  //                  1 = flower center at ~60% down the viewport
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'center 60%'],
  })

  const xInitial = flower.side === 'left'
    ? -Math.abs(flower.startX)
    :  Math.abs(flower.startX)

  // Map scroll → visual — naturally rewinds when scrolling back up
  const opacity = useTransform(scrollYProgress, [0, 0.45], [0, 1])
  const x       = useTransform(scrollYProgress, [0, 0.7],  [xInitial, 0])
  const y       = useTransform(scrollYProgress, [0, 0.7],  [flower.startY, 0])
  const rotate  = useTransform(scrollYProgress, [0, 0.7],  [flower.startRotate, 0])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top:      flower.top,
        [flower.side]: flower.edge,
        width:    flower.width,
        pointerEvents: 'none',
      }}
    >
      <motion.div style={{ opacity, x, y, rotate }}>
        <Image
          src={flower.src}
          alt={flower.alt}
          width={400}
          height={400}
          style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
        />
      </motion.div>
    </div>
  )
}

// ─── FlowersBox ────────────────────────────────────────────────────────────────
export function FlowersBox({ flowers, className = '' }: FlowersBoxProps) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none overflow-visible ${className}`}
      style={{ zIndex: 0 }}
    >
      {flowers.map((f, i) => (
        <SingleFlower key={i} flower={f} />
      ))}
    </div>
  )
}

// ─── Pre-built flower sets ─────────────────────────────────────────────────────

export const HERO_FLOWERS: FlowerDef[] = [
  {
    src: '/flowers/home-flowers-left.png',
    alt: 'Floral bouquet left',
    side: 'left', edge: '-5vw', top: '55%', width: 'clamp(120px, 18vw, 280px)',
    startX: 80, startY: 20, startRotate: -10,
  },
  {
    src: '/flowers/home-petals-left.png',
    alt: 'Petals left',
    side: 'left', edge: '5%', top: '75%', width: 'clamp(70px, 9vw, 140px)',
    startX: 50, startY: 15, startRotate: -15,
  },
  {
    src: '/flowers/home-flowers-right.png',
    alt: 'Floral bouquet right',
    side: 'right', edge: '-3%', top: '50%', width: 'clamp(110px, 16vw, 250px)',
    startX: 80, startY: 20, startRotate: 10,
  },
]

export const STORY_FLOWERS: FlowerDef[] = [
  {
    src: '/flowers/s3-flower-left.png',
    alt: 'Promise flower left',
    side: 'left', edge: '-2%', top: '60%', width: 'clamp(90px, 13vw, 200px)',
    startX: 60, startY: 10, startRotate: -8,
  },
  {
    src: '/flowers/s2-petals-right.png',
    alt: 'Petals right',
    side: 'right', edge: '2%', top: '70%', width: 'clamp(70px, 9vw, 140px)',
    startX: 50, startY: 15, startRotate: 6,
  },
]

export const COUNTDOWN_FLOWERS: FlowerDef[] = [
  {
    src: '/flowers/s2-tulip-left.png',
    alt: 'Tulip left',
    side: 'left', edge: '-3%', top: '65%', width: 'clamp(100px, 15vw, 220px)',
    startX: 70, startY: 15, startRotate: -12,
  },
  {
    src: '/flowers/s2-flower-right.png',
    alt: 'Flower right',
    side: 'right', edge: '-2%', top: '55%', width: 'clamp(80px, 11vw, 170px)',
    startX: 60, startY: 10, startRotate: 10,
  },
]

export const GALLERY_FLOWERS: FlowerDef[] = [
  {
    src: '/flowers/home-petals-left.png',
    alt: 'Petals left',
    side: 'left', edge: '3%', top: '15%', width: 'clamp(60px, 8vw, 120px)',
    startX: 40, startY: -20, startRotate: 10,
  },
  {
    src: '/flowers/s2-flower-right.png',
    alt: 'Flower right',
    side: 'right', edge: '-1%', top: '20%', width: 'clamp(80px, 11vw, 160px)',
    startX: 50, startY: -15, startRotate: -8,
  },
  {
    src: '/flowers/s2-petals-right.png',
    alt: 'Petals right lower',
    side: 'right', edge: '4%', top: '55%', width: 'clamp(60px, 8vw, 110px)',
    startX: 40, startY: 20, startRotate: -12,
  },
  {
    src: '/flowers/s6-tulip-left.png',
    alt: 'Tulip left lower',
    side: 'left', edge: '-2%', top: '60%', width: 'clamp(90px, 13vw, 190px)',
    startX: 60, startY: 20, startRotate: 8,
  },
]
