'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'

/** Shared dashboard pieces: grouped lists, quiet buttons and a sheet. System font, neutral greys. */

export const SYSTEM_FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif' }

export function Group({ label, footnote, children }: { label?: string; footnote?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      {label && <h3 className="px-4 pb-1.5 text-[13px] uppercase tracking-[0.04em] text-black/45">{label}</h3>}
      <div className="overflow-hidden rounded-xl bg-white">{children}</div>
      {footnote && <p className="px-4 pt-1.5 text-[13px] leading-snug text-black/45">{footnote}</p>}
    </section>
  )
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('border-t border-black/[0.07] px-4 py-3 first:border-t-0', className)}>{children}</div>
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Row className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[16px] text-black/85">{label}</span>
      <span className="min-w-0 break-words text-right text-[16px] text-black/50">{value}</span>
    </Row>
  )
}

export const inputClass =
  'w-full rounded-lg bg-black/[0.045] px-3 py-2.5 text-[16px] text-black/85 placeholder:text-black/35 outline-none focus:ring-2 focus:ring-black/20'

export const labelClass = 'mb-1 block text-[13px] text-black/50'

type Tone = 'primary' | 'plain' | 'danger'

const TONES: Record<Tone, string> = {
  primary: 'bg-[#2E1F1A] text-white',
  plain: 'bg-black/[0.055] text-black/85',
  danger: 'bg-black/[0.055] text-[#B3261E]',
}

export function Button({ children, onClick, tone = 'plain', disabled, type = 'button', className }: {
  children: ReactNode
  onClick?: () => void
  tone?: Tone
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'rounded-full px-4 py-2.5 text-[15px] font-medium transition-opacity active:opacity-70 disabled:opacity-40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/60',
        TONES[tone], className,
      )}
    >
      {children}
    </button>
  )
}

/** A button that asks for a second tap instead of opening a system alert. */
export function ConfirmButton({ children, confirmText, onConfirm, tone = 'danger', disabled }: {
  children: ReactNode
  confirmText: string
  onConfirm: () => void
  tone?: Tone
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(timer)
  }, [armed])
  return (
    <Button tone={tone} disabled={disabled} onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }}>
      {armed ? confirmText : children}
    </Button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 overflow-x-auto rounded-[10px] bg-black/[0.06] p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          role="tab"
          type="button"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            'flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50',
            value === option.value ? 'bg-white font-medium text-black/90 shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-black/60',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Bottom sheet on a phone, centred card on a larger screen. Built on the native dialog for focus and Escape. */
export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
      style={SYSTEM_FONT}
      className={clsx('m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl bg-[#F2F2F7] p-0 text-black/85 backdrop:bg-black/35 sm:m-auto sm:rounded-2xl', wide ? 'sm:max-w-[820px]' : 'sm:max-w-[560px]')}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-black/[0.07] bg-[#F2F2F7] px-4 py-3">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-black/[0.06] p-1.5 text-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-4 pb-8">{children}</div>
      </div>
    </dialog>
  )
}
