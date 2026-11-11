'use client'

import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

/** The same top line on every admin page: a large title and, on the right, its actions. */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-black/90">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-black/50">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2 pb-1">{children}</div>}
    </header>
  )
}

interface IconButtonProps {
  icon: LucideIcon
  /** Read by screen readers and shown as a tooltip; icon-only buttons always need one. */
  label: string
  onClick?: () => void
  tone?: 'plain' | 'primary'
  disabled?: boolean
}

export function IconButton({ icon: Icon, label, onClick, tone = 'plain', disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        'flex h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-70 disabled:opacity-40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/60',
        tone === 'primary' ? 'bg-[#2E1F1A] text-white' : 'bg-black/[0.06] text-black/70',
      )}
    >
      <Icon size={20} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
