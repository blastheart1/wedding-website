'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NAV_LINKS } from '@/lib/constants'
import type { PublicConfig } from '@/lib/config'
import clsx from 'clsx'

interface NavbarProps {
  config: Pick<PublicConfig, 'partner1' | 'partner2'>
}

export function Navbar({ config }: NavbarProps) {
  const [scrolled,   setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [atTop,      setAtTop]      = useState(true)
  const [inGallery,  setInGallery]  = useState(false)
  const [idle,       setIdle]       = useState(false)

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 40)
      if (window.scrollY > 40) setMobileOpen(false)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    setAtTop(window.scrollY === 0)
    const handler = () => {
      setAtTop(window.scrollY === 0)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const galleryEl = document.getElementById('gallery')
    if (!galleryEl) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInGallery(entry.isIntersecting)
      },
      { threshold: 0.15 },
    )
    observer.observe(galleryEl)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (window.scrollY > 0) {
      timer = setTimeout(() => setIdle(true), 3000)
    }

    const handler = () => {
      if (timer) clearTimeout(timer)
      setIdle(false)
      if (window.scrollY > 0) {
        timer = setTimeout(() => setIdle(true), 3000)
      }
    }

    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      window.removeEventListener('scroll', handler)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const navHidden = !atTop && (inGallery || idle)

  const initials = `${config.partner1[0]} & ${config.partner2[0]}`
  const navLinks = NAV_LINKS.filter(l => l.href !== '#rsvp')

  return (
    <>
      {/*
       * ── Root cause fix ────────────────────────────────────────────────────
       *
       * Problem 1 — transform conflict:
       *   Framer Motion writes its own inline `transform` when animating y/opacity.
       *   This overwrites Tailwind's `--tw-translate-x` CSS variable, so
       *   `-translate-x-1/2` silently stops centering once the animation runs.
       *
       * Problem 2 — overflow-x: hidden on body:
       *   `body { overflow-x: hidden }` can turn the body into a scroll container
       *   in some browsers, causing `position: fixed` children to be positioned
       *   relative to the body width instead of the viewport.
       *
       * Solution: split positioning and animation across two elements.
       *   - The outer <div> is a plain element (Framer Motion never touches it),
       *     so `left-1/2 -translate-x-1/2` always works correctly.
       *   - The inner <motion.nav> only animates opacity/y — no transform classes.
       *
       * Mobile fix: `left-4 right-4` (16 px gutters) instead of calc(100%-32px)
       * so the pill never overflows the viewport.
       */}

      {/* ── Positioning wrapper — pure CSS, no Framer Motion ─────────────── */}
      <div
        className={clsx(
          'fixed top-[18px] z-[900]',
          // Mobile: 16 px gutter each side — no overflow, no transform needed
          'left-4 right-4',
          // Desktop: auto-width pill centered via left-50% + translateX(-50%)
          // This div is NEVER animated by Framer Motion, so the transform is safe
          'md:left-1/2 md:right-auto md:-translate-x-1/2',
          'md:min-w-[600px] md:max-w-[720px]',
        )}
      >
        {/* ── Animated pill — only y/opacity, no transform classes ─────── */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={navHidden ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ pointerEvents: navHidden ? 'none' : 'auto' }}
          className={clsx(
            'w-full flex items-center px-4 md:px-5 py-[10px] rounded-full',
            'border border-rule transition-all duration-300',
            scrolled
              ? 'bg-cream/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(46,31,26,0.1)]'
              : 'bg-cream/90 backdrop-blur-lg shadow-[0_2px_16px_rgba(46,31,26,0.06)]',
          )}
        >
          {/* Left — flex-1 so it equals the right section width */}
          <div className="flex-1 flex items-center min-w-0">
            <span className="font-display text-[15px] md:text-[16px] font-semibold text-ink tracking-[3px] md:tracking-[4px] whitespace-nowrap">
              {initials}
            </span>
          </div>

          {/* Center — desktop nav links, natural width, always centered */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="text-[10px] tracking-[2.5px] uppercase text-ink/50 hover:text-ink transition-colors whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right — flex-1 mirrors left section */}
          <div className="flex-1 flex items-center justify-end gap-2 md:gap-3 min-w-0">
            <a
              href="#rsvp"
              className="bg-rose text-white text-[9px] md:text-[10px] tracking-[2px] uppercase font-medium px-4 md:px-5 py-[8px] md:py-[9px] rounded-full hover:bg-rosedark transition-colors whitespace-nowrap"
            >
              RSVP
            </a>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="md:hidden flex flex-col justify-center gap-[5px] w-5 h-5 shrink-0"
            >
              <motion.span
                animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.22 }}
                className="block h-px w-full bg-ink rounded-full origin-center"
              />
              <motion.span
                animate={{ opacity: mobileOpen ? 0 : 1, scaleX: mobileOpen ? 0 : 1 }}
                transition={{ duration: 0.18 }}
                className="block h-px w-full bg-ink rounded-full"
              />
              <motion.span
                animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.22 }}
                className="block h-px w-full bg-ink rounded-full origin-center"
              />
            </button>
          </div>
        </motion.nav>
      </div>

      {/* ── Mobile dropdown ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[898] md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              key="menu"
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,   scale: 1    }}
              exit={{    opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={clsx(
                'fixed top-[76px] left-4 right-4 z-[899] md:hidden',
                'bg-cream/98 backdrop-blur-xl',
                'border border-rule rounded-2xl',
                'shadow-[0_8px_40px_rgba(46,31,26,0.13)]',
                'overflow-hidden',
              )}
            >
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 + 0.05, duration: 0.2 }}
                  className={clsx(
                    'flex items-center justify-center py-5',
                    'text-[10px] tracking-[3.5px] uppercase text-ink/60',
                    'hover:text-ink hover:bg-petal transition-colors',
                    i < navLinks.length - 1 && 'border-b border-rule',
                  )}
                >
                  {link.label}
                </motion.a>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
