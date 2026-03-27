import type { Variants } from 'framer-motion'

// ─── Easing curves ────────────────────────────────────────────────────────────
const ease = [0.22, 1, 0.36, 1] as const   // expo out — feels natural & elegant

// ─── Base variants ────────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.85, ease } },
}

export const fadeDown: Variants = {
  hidden:  { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0,   transition: { duration: 0.7, ease } },
}

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.7, ease: 'easeOut' } },
}

export const scaleReveal: Variants = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1,    transition: { duration: 0.75, ease } },
}

// Instax-card spring pop
export const cardPop: Variants = {
  hidden:  { opacity: 0, y: 48, scale: 0.92 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.7, ease: [0.34, 1.56, 0.64, 1] },
  },
}

// ─── Container that staggers children ─────────────────────────────────────────

export const stagger = (delay = 0.08, delayStart = 0): Variants => ({
  hidden:  {},
  visible: { transition: { staggerChildren: delay, delayChildren: delayStart } },
})

// ─── Convenience: apply once-on-scroll via useInView ─────────────────────────
// Usage in a component:
//   const ref = useRef(null)
//   const inView = useInView(ref, { once: true, margin: '-80px' })
//   <motion.div ref={ref} variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} />
