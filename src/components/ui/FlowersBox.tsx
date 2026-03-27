'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlowerDef {
  src:   string
  alt:   string
  side:  'left' | 'right'
  /** % of container width from the edge */
  edge:  string
  /** % of container height from top */
  top:   string
  width: string
  /** How far off-screen it starts (px or %) */
  startX: number
  startY: number
  startRotate: number
  /** Viewport fraction that must be visible before triggering (0–1) */
  threshold?: number
}

interface FlowersBoxProps {
  flowers: FlowerDef[]
  className?: string
}

// ─── SingleFlower — each flower has its own independent scroll trigger ────────
function SingleFlower({ flower }: { flower: FlowerDef }) {
  const ref    = useRef<HTMLDivElement>(null)
  // Each flower fires independently — no shared inView state, no group pop
  const inView = useInView(ref, {
    once:   true,
    amount: flower.threshold ?? 0.15,
  })

  const xInitial = flower.side === 'left'
    ? -Math.abs(flower.startX)
    :  Math.abs(flower.startX)

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
      <motion.div
        initial={{ opacity: 0, x: xInitial, y: flower.startY, rotate: flower.startRotate }}
        animate={inView
          ? { opacity: 1, x: 0, y: 0, rotate: 0 }
          : { opacity: 0, x: xInitial, y: flower.startY, rotate: flower.startRotate }
        }
        transition={{ duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
      >
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
// Wrap any section with `position: relative` and drop a FlowersBox inside.
// Each flower animates in independently as the user scrolls past it.
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
// All positions are relative to the section that wraps the FlowersBox.

export const HERO_FLOWERS: FlowerDef[] = [
  {
    src: '/flowers/home-flowers-left.png',
    alt: 'Floral bouquet left',
    // edge is -50% of the image width so the straight-cut left side stays off-screen
    side: 'left', edge: '-5vw', top: '55%', width: 'clamp(120px, 18vw, 280px)',
    startX: 80, startY: 20, startRotate: -10,
    threshold: 0.05,
  },
  {
    src: '/flowers/home-petals-left.png',
    alt: 'Petals left',
    side: 'left', edge: '5%', top: '75%', width: 'clamp(70px, 9vw, 140px)',
    startX: 50, startY: 15, startRotate: -15,
    threshold: 0.1,
  },
  {
    src: '/flowers/home-flowers-right.png',
    alt: 'Floral bouquet right',
    side: 'right', edge: '-3%', top: '50%', width: 'clamp(110px, 16vw, 250px)',
    startX: 80, startY: 20, startRotate: 10,
    threshold: 0.05,
  },
]

export const STORY_FLOWERS: FlowerDef[] = [
  {
    src: '/flowers/s3-flower-left.png',
    alt: 'Promise flower left',
    side: 'left', edge: '-2%', top: '60%', width: 'clamp(90px, 13vw, 200px)',
    startX: 60, startY: 10, startRotate: -8,
    threshold: 0.2,
  },
  {
    src: '/flowers/s2-petals-right.png',
    alt: 'Petals right',
    side: 'right', edge: '2%', top: '70%', width: 'clamp(70px, 9vw, 140px)',
    startX: 50, startY: 15, startRotate: 6,
    threshold: 0.3,
  },
]

export const COUNTDOWN_FLOWERS: FlowerDef[] = [
  {
    src: '/flowers/s2-tulip-left.png',
    alt: 'Tulip left',
    side: 'left', edge: '-3%', top: '65%', width: 'clamp(100px, 15vw, 220px)',
    startX: 70, startY: 15, startRotate: -12,
    threshold: 0.25,
  },
  {
    src: '/flowers/s2-flower-right.png',
    alt: 'Flower right',
    side: 'right', edge: '-2%', top: '55%', width: 'clamp(80px, 11vw, 170px)',
    startX: 60, startY: 10, startRotate: 10,
    threshold: 0.25,
  },
]

export const GALLERY_FLOWERS: FlowerDef[] = [
  {
    src: '/flowers/home-petals-left.png',
    alt: 'Petals left',
    side: 'left', edge: '3%', top: '15%', width: 'clamp(60px, 8vw, 120px)',
    startX: 40, startY: -20, startRotate: 10,
    threshold: 0.1,
  },
  {
    src: '/flowers/s2-flower-right.png',
    alt: 'Flower right',
    side: 'right', edge: '-1%', top: '20%', width: 'clamp(80px, 11vw, 160px)',
    startX: 50, startY: -15, startRotate: -8,
    threshold: 0.2,
  },
  {
    src: '/flowers/s2-petals-right.png',
    alt: 'Petals right lower',
    side: 'right', edge: '4%', top: '55%', width: 'clamp(60px, 8vw, 110px)',
    startX: 40, startY: 20, startRotate: -12,
    threshold: 0.35,
  },
  {
    src: '/flowers/s6-tulip-left.png',
    alt: 'Tulip left lower',
    side: 'left', edge: '-2%', top: '60%', width: 'clamp(90px, 13vw, 190px)',
    startX: 60, startY: 20, startRotate: 8,
    threshold: 0.5,
  },
]
