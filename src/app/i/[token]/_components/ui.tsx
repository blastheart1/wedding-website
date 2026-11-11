import type { ReactNode } from 'react'
import clsx from 'clsx'

/** Small shared pieces for the guest invitation page: quiet grouped cards, no decoration. */

export function Group({ label, children, footnote }: { label?: string; children: ReactNode; footnote?: ReactNode }) {
  return (
    <section className="mt-8">
      {label && <h2 className="px-4 pb-2 font-sans text-[13px] font-medium uppercase tracking-[0.08em] text-ink2">{label}</h2>}
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(46,31,26,0.06)]">{children}</div>
      {footnote && <p className="px-4 pt-2 font-sans text-[13px] leading-snug text-ink2">{footnote}</p>}
    </section>
  )
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('border-t border-black/[0.06] px-4 py-3.5 first:border-t-0', className)}>{children}</div>
}

export const inputClass =
  'w-full rounded-xl bg-[#F5F2EE] px-4 py-3 font-sans text-[16px] text-ink placeholder:text-ink2/60 outline-none transition-shadow focus:ring-2 focus:ring-ink/25'

export const labelClass = 'mb-1.5 block font-sans text-[14px] text-ink2'

export function PrimaryButton({ children, disabled, type = 'button', onClick }: {
  children: ReactNode
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-full bg-ink px-6 py-3.5 font-sans text-[16px] font-medium text-cream transition-opacity active:opacity-80 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {children}
    </button>
  )
}

export function QuietButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-full bg-[#F5F2EE] px-6 py-3.5 font-sans text-[16px] font-medium text-ink transition-opacity active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {children}
    </button>
  )
}
