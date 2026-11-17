'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SYSTEM_FONT } from './primitives'

export const ADMIN_AREAS: readonly { href: string; label: string }[] = [
  { href: '/admin/invitations', label: 'Invitations' },
  { href: '/admin/rsvps', label: 'RSVPs' },
  { href: '/admin/seating', label: 'Seat plan' },
  { href: '/admin/settings', label: 'Site settings' },
  { href: '/admin/gallery', label: 'Gallery' },
  { href: '/admin/story', label: 'Story' },
  { href: '/admin/faq', label: 'FAQ' },
  { href: '/admin/quiz', label: 'Quiz' },
]

interface AdminShellProps {
  partner1: string
  partner2: string
  children: ReactNode
}

/** One frame for every admin area: a sidebar on larger screens, a swipeable tab row on a phone. */
export function AdminShell({ partner1, partner2, children }: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined)
    router.push('/admin/login')
  }

  // On the seat plan the floor needs the whole screen, so the sidebar tucks away behind a flap on the
  // left edge. It slides out when the flap is pointed at or pressed, and hides again when left.
  const tucked = isActive('/admin/seating')
  const [open, setOpen] = useState(false)
  const closing = useRef(0)
  const sidebar = useRef<HTMLElement>(null)
  // While tucked away the menu is out of reach of the keyboard and screen readers too.
  useEffect(() => { sidebar.current?.toggleAttribute('inert', tucked && !open) }, [tucked, open])
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => () => window.clearTimeout(closing.current), [])
  const reveal = () => { window.clearTimeout(closing.current); setOpen(true) }
  const hideSoon = () => { window.clearTimeout(closing.current); closing.current = window.setTimeout(() => setOpen(false), 350) }

  const names = <span className="text-[17px] font-semibold tracking-tight text-black/90">{partner1} &amp; {partner2}</span>

  return (
    <div style={SYSTEM_FONT} className="min-h-screen bg-[#F2F2F7] text-black/85 md:flex">
      <aside
        id="admin-sidebar"
        onMouseEnter={tucked ? reveal : undefined}
        onMouseLeave={tucked ? hideSoon : undefined}
        onFocus={tucked ? reveal : undefined}
        onBlur={tucked ? hideSoon : undefined}
        ref={sidebar}
        className={clsx(
          'hidden border-r border-black/[0.07] md:flex md:h-screen md:w-[232px] md:shrink-0 md:flex-col md:px-3 md:py-7',
          tucked
            ? ['md:fixed md:left-0 md:top-0 md:z-40 md:bg-[#F2F2F7] md:transition-transform md:duration-200 motion-reduce:md:transition-none', open ? 'md:translate-x-0 md:shadow-[8px_0_30px_rgba(0,0,0,0.18)]' : 'md:-translate-x-full']
            : 'md:sticky md:top-0',
        )}
      >
        <div className="px-3 pb-6">{names}<p className="text-[13px] text-black/45">Wedding admin</p></div>
        <nav aria-label="Admin areas" className="flex flex-col gap-0.5">
          {ADMIN_AREAS.map(area => (
            <Link key={area.href} href={area.href} aria-current={isActive(area.href) ? 'page' : undefined}
              className={clsx(
                'rounded-lg px-3 py-2 text-[15px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50',
                isActive(area.href) ? 'bg-white font-medium text-black/90 shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-black/65 hover:bg-black/[0.04]',
              )}>
              {area.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5">
          <a href="/" target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-[15px] text-black/65 hover:bg-black/[0.04]">View site</a>
          <button type="button" onClick={logout} className="rounded-lg px-3 py-2 text-left text-[15px] text-black/65 hover:bg-black/[0.04]">Log out</button>
        </div>
      </aside>

      {tucked && (
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : reveal())}
          onMouseEnter={reveal}
          onMouseLeave={hideSoon}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          aria-label={open ? 'Hide the menu' : 'Show the menu'}
          title={open ? 'Hide the menu' : 'Menu'}
          data-admin-flap="true"
          className={clsx(
            'fixed top-1/2 z-40 hidden h-20 w-5 -translate-y-1/2 items-center justify-center rounded-r-lg bg-[#2E1F1A] text-white shadow-[2px_0_8px_rgba(0,0,0,0.25)] transition-[left] duration-200 motion-reduce:transition-none md:flex',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/60',
            open ? 'left-[232px]' : 'left-0',
          )}
        >
          {open ? <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" /> : <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />}
        </button>
      )}

      <div className="sticky top-0 z-30 border-b border-black/[0.07] bg-[#F2F2F7]/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          {names}
          <button type="button" onClick={logout} className="text-[15px] text-black/55">Log out</button>
        </div>
        <nav aria-label="Admin areas" className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ADMIN_AREAS.map(area => (
            <Link key={area.href} href={area.href} aria-current={isActive(area.href) ? 'page' : undefined}
              className={clsx(
                'shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] transition-colors',
                isActive(area.href) ? 'bg-white font-medium text-black/90 shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-black/60',
              )}>
              {area.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-1">
        {/* The seat plan is a floor to work on: it gets the full width and height of the screen. */}
        <div className={clsx('mx-auto w-full', tucked ? 'max-w-none px-4 pb-6 pt-5 md:pl-9 md:pr-5' : 'max-w-[980px] px-4 pb-24 pt-6 md:px-10 md:pt-10')}>{children}</div>
      </main>
    </div>
  )
}
