'use client'

import { useId, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { toast } from 'sonner'
import { errorMessage, uploadImage } from '../_lib/api'
import { Button, Row, inputClass, labelClass } from './primitives'

interface TextRowProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: ReactNode
  /** Number of lines; more than one renders a text area. */
  rows?: number
  type?: 'text' | 'url' | 'email'
  maxLength?: number
}

/** A labelled text field as one row of a group. */
export function TextRow({ label, value, onChange, placeholder, hint, rows = 1, type = 'text', maxLength }: TextRowProps) {
  const id = useId()
  return (
    <Row>
      <label className={labelClass} htmlFor={id}>{label}</label>
      {rows > 1
        ? <textarea id={id} rows={rows} value={value} placeholder={placeholder} maxLength={maxLength} onChange={event => onChange(event.target.value)} className={clsx(inputClass, 'resize-y')} />
        : <input id={id} type={type} value={value} placeholder={placeholder} maxLength={maxLength} onChange={event => onChange(event.target.value)} className={inputClass} />}
      {hint && <p className="mt-1.5 text-[13px] leading-snug text-black/45">{hint}</p>}
    </Row>
  )
}

/** An on/off switch as one row of a group. */
export function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Row>
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-[16px] text-black/85">{label}</span>
          {hint && <span className="block text-[13px] leading-snug text-black/45">{hint}</span>}
        </span>
        <span className="relative inline-flex shrink-0">
          <input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} className="peer sr-only" />
          <span className="h-[31px] w-[51px] rounded-full bg-black/15 transition-colors peer-checked:bg-[#2E1F1A] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black/60" />
          <span className="pointer-events-none absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
    </Row>
  )
}

interface ImageRowProps {
  label: string
  hint?: string
  url: string
  folder: string
  onChange: (url: string) => void
}

/** A picture setting: thumbnail, upload, and remove. The change applies when the page is saved. */
export function ImageRow({ label, hint, url, folder, onChange }: ImageRowProps) {
  const [busy, setBusy] = useState(false)
  const upload = async (file: File) => {
    setBusy(true)
    try {
      onChange((await uploadImage(file, folder)).url)
      toast.success('Uploaded. Save to apply.')
    } catch (problem) {
      toast.error(errorMessage(problem))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Row className="flex items-center gap-3">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/[0.05] text-[11px] text-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : 'None'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] text-black/85">{label}</span>
        {hint && <span className="block text-[13px] text-black/45">{hint}</span>}
      </span>
      <label className={clsx('cursor-pointer rounded-full bg-black/[0.055] px-4 py-2.5 text-[15px] font-medium text-black/85', busy && 'pointer-events-none opacity-40')}>
        {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = '' }} />
      </label>
      {url && <Button tone="danger" onClick={() => onChange('')}>Remove</Button>}
    </Row>
  )
}

/** Shown while a page's data is loading, or when it could not be loaded. */
export function LoadState({ loading, error }: { loading: boolean; error: string }) {
  if (!loading && !error) return null
  return <p className="py-16 text-center text-[15px] text-black/50">{error || 'Loading…'}</p>
}
