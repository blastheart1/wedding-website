'use client'

import { useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NAV_LINKS } from '@/lib/constants'
import { navbarScrollState, sameNavbarScrollState, navbarVisualStyle } from '@/lib/navbar-visibility'
import { focusSectionAnchor } from '@/lib/section-anchors'
import { useWorldMotion } from '@/lib/site-motion'
import type { PublicConfig } from '@/lib/config'
import clsx from 'clsx'

interface NavbarProps {
  config: Pick<PublicConfig, 'partner1' | 'partner2'>
}

function readNavbarScrollState() {
  if (typeof window === 'undefined') return navbarScrollState(0, 0, 600)
  const hero = document.getElementById('home')
  const rect = hero?.getBoundingClientRect()
  return navbarScrollState(
    window.scrollY,
    rect ? rect.top + window.scrollY : 0,
    rect?.height || Math.max(window.innerHeight, 600),
  )
}

export function Navbar({ config }: NavbarProps) {
  const { reduced } = useWorldMotion()
  const [scrollState, setScrollState] = useState(() => navbarScrollState(0, 0, 600))
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const next = readNavbarScrollState()
      setScrollState(current => sameNavbarScrollState(current, next) ? current : next)
      if (next.scrolled || next.hidden) setMobileOpen(false)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    window.addEventListener('pageshow', update)
    const hero = document.getElementById('home')
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (hero) observer?.observe(hero)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('pageshow', update)
      observer?.disconnect()
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Do not focus an inert navbar or move the document back up after scrolling away.
      if (!readNavbarScrollState().hidden && menuRef.current?.contains(document.activeElement)) {
        menuToggleRef.current?.focus({ preventScroll: true })
      }
      setMobileOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const navHidden = scrollState.hidden
  const scrolled = scrollState.scrolled
  const menuVisible = mobileOpen && !navHidden

  const initials = `${config.partner1[0]} & ${config.partner2[0]}`
  const navLinks = NAV_LINKS.filter(l => l.href !== '#rsvp')

  return (
    <>
      {/* Keep CSS centering on the wrapper, separate from the pill's vertical transition. */}
      {/* ── Positioning wrapper — pure CSS, no Framer Motion ─────────────── */}
      <div
        className={clsx(
          'site-navbar fixed top-[18px] z-[900] pointer-events-none',
          // Mobile: 16 px gutter each side — no overflow, no transform needed
          'left-4 right-4',
          // Desktop: auto-width pill centered via left-50% + translateX(-50%)
          // This wrapper never animates, so its horizontal centering remains unchanged
          'md:left-1/2 md:right-auto md:-translate-x-1/2',
          'md:min-w-[760px] md:max-w-[900px]' ,
        )}
      >
        {/* The pill uses native CSS only, with final inline values set before its fade starts. */}
        <nav
          aria-label="Wedding navigation"
          aria-hidden={navHidden}
          {...((navHidden ? {inert: ""} : {}) as unknown as HTMLAttributes<HTMLElement>)}
          // One owner: no Framer/WAAPI completion handoff can expose stale opacity.
          style={{ ...navbarVisualStyle(navHidden, reduced), pointerEvents: navHidden ? 'none' : 'auto' }}
          className={clsx(
            'w-full flex items-center px-4 md:px-5 py-[10px] rounded-full',
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
                onClick={focusSectionAnchor}
                className="text-[16px] tracking-[1.2px] uppercase text-ink/80 hover:text-ink transition-colors whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right — flex-1 mirrors left section */}
          <div className="flex-1 flex items-center justify-end gap-2 md:gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              ref={menuToggleRef}
              type="button"
              aria-controls="wedding-mobile-menu"
              onClick={() => setMobileOpen(o => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="md:hidden flex flex-col justify-center gap-[5px] w-11 h-11 p-2 shrink-0"
            >
              <motion.span
                animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ duration: reduced ? 0 : 0.22 }}
                className="block h-px w-full bg-ink rounded-full origin-center"
              />
              <motion.span
                animate={{ opacity: mobileOpen ? 0 : 1, scaleX: mobileOpen ? 0 : 1 }}
                transition={{ duration: reduced ? 0 : 0.18 }}
                className="block h-px w-full bg-ink rounded-full"
              />
              <motion.span
                animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ duration: reduced ? 0 : 0.22 }}
                className="block h-px w-full bg-ink rounded-full origin-center"
              />
            </button>
          </div>
        </nav>
      </div>

      {/* ── Mobile dropdown ──────────────────────────────────────────────────── */}
      <div aria-hidden={!menuVisible} {...((!menuVisible ? {inert: ""} : {}) as unknown as HTMLAttributes<HTMLDivElement>)}>
      <AnimatePresence>
        {menuVisible && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="fixed inset-0 z-[898] md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              ref={menuRef}
              id="wedding-mobile-menu"
              key="menu"
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,   scale: 1    }}
              exit={{    opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: reduced ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={clsx(
                'fixed top-[76px] left-4 right-4 z-[899] md:hidden',
                'bg-cream/98 backdrop-blur-xl',
                'rounded-2xl',
                'shadow-[0_8px_40px_rgba(46,31,26,0.13)]',
                'overflow-hidden',
              )}
            >
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={event => { focusSectionAnchor(event); setMobileOpen(false) }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduced ? 0 : i * 0.05 + 0.05, duration: reduced ? 0 : 0.2 }}
                  className={clsx(
                    'flex items-center justify-center py-5',
                    'text-[16px] tracking-[3.5px] uppercase text-ink/80',
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
      </div>
    </>
  )
}
