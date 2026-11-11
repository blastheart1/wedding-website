'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { SYSTEM_FONT } from './primitives'

export const ADMIN_AREAS: readonly { href: string; label: string }[] = [
  { href: '/admin/invitations', label: 'Invitations' },
  { href: '/admin/rsvps', label: 'RSVPs' },
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

  const names = <span className="text-[17px] font-semibold tracking-tight text-black/90">{partner1} &amp; {partner2}</span>

  return (
    <div style={SYSTEM_FONT} className="min-h-screen bg-[#F2F2F7] text-black/85 md:flex">
      <aside className="hidden border-r border-black/[0.07] md:sticky md:top-0 md:flex md:h-screen md:w-[232px] md:shrink-0 md:flex-col md:px-3 md:py-7">
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
        <div className="mx-auto w-full max-w-[980px] px-4 pb-24 pt-6 md:px-10 md:pt-10">{children}</div>
      </main>
    </div>
  )
}
