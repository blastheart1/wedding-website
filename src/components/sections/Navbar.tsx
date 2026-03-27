'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { NAV_LINKS } from '@/lib/constants'
import type { PublicConfig } from '@/lib/config'
import clsx from 'clsx'

interface NavbarProps {
  config: Pick<PublicConfig, 'partner1' | 'partner2'>
}

export function Navbar({ config }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const initials = `${config.partner1[0]} & ${config.partner2[0]}`

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={clsx(
        'fixed top-[18px] left-1/2 -translate-x-1/2 z-[900]',
        'flex items-center gap-8 px-8 py-[11px] rounded-full',
        'border border-rule transition-all duration-300',
        scrolled
          ? 'bg-cream/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(46,31,26,0.1)]'
          : 'bg-cream/90 backdrop-blur-lg shadow-[0_2px_16px_rgba(46,31,26,0.06)]',
      )}
    >
      <span className="font-display text-[17px] font-semibold text-ink tracking-[4px]">
        {initials}
      </span>

      {NAV_LINKS.filter(l => l.href !== '#rsvp').map(link => (
        <a
          key={link.href}
          href={link.href}
          className="hidden md:block text-[10px] tracking-[2.5px] uppercase text-ink/50 hover:text-ink transition-colors"
        >
          {link.label}
        </a>
      ))}

      <a
        href="#rsvp"
        className="bg-rose text-white text-[10px] tracking-[2px] uppercase font-medium px-5 py-2 rounded-full hover:bg-rosedark transition-colors"
      >
        RSVP
      </a>
    </motion.nav>
  )
}
