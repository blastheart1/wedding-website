'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'
import type { PublicConfig } from '@/lib/config'
import type { GuestVerification } from '@/types'

const responseSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.').max(255),
  email: z.string().trim().toLowerCase().email('Please enter a valid email.').max(255),
  attending: z.enum(['yes', 'no'], { errorMap: () => ({ message: 'Please tell us whether you can join us.' }) }),
  dietary: z.string().trim().max(500), songRequest: z.string().trim().max(255), message: z.string().trim().max(2000),
})
const denial: Record<string, string> = {
  blocked: "We’re unable to process this invitation. Please contact the couple directly.",
  not_invited: 'This celebration is by invitation only. Please use the email on your invitation or contact the couple.',
  already_rsvped: 'This invitation has already replied. Please contact the couple to make changes.',
}

export function RSVPDialog({ config }: { config: PublicConfig }) {
  const dialog = useRef<HTMLDialogElement>(null), lookup = useRef<HTMLInputElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null), request = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [error, setError] = useState('')
  const [guest, setGuest] = useState<GuestVerification | null>(null), [complete, setComplete] = useState(false)
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState<Record<string, string>>({})
  const pending = useRef(false)
  useEffect(() => {
    const show = () => { returnFocus.current = document.activeElement as HTMLElement; setOpen(true) }
    const hash = () => { if (window.location.hash === '#rsvp') show() }
    window.addEventListener('open-wedding-rsvp', show); window.addEventListener('hashchange', hash); hash()
    return () => { window.removeEventListener('open-wedding-rsvp', show); window.removeEventListener('hashchange', hash); request.current?.abort() }
  }, [])
  useEffect(() => {
    if (!open || !dialog.current) return
    const element = dialog.current, overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'; lookup.current?.focus()
    return () => { element.close(); document.body.style.overflow = overflow; returnFocus.current?.focus({ preventScroll: true }) }
  }, [open])
  const close = () => {
    request.current?.abort(); request.current = null; pending.current = false
    setOpen(false); setQuery(''); setGuest(null); setError(''); setErrors({}); setComplete(false); setBusy(false)
  }
  const searchAgain = () => { setGuest(null); setError(''); setErrors({}); requestAnimationFrame(() => lookup.current?.focus()) }
  async function verify(event: FormEvent) {
    event.preventDefault(); if (pending.current) return
    const parsed = responseSchema.shape.email.safeParse(query)
    if (!parsed.success) { setError(parsed.error.issues[0].message); lookup.current?.focus(); return }
    pending.current = true; setBusy(true); setError('')
    const controller = new AbortController(); request.current = controller
    try {
      const response = await fetch('/api/rsvp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: parsed.data }), signal: controller.signal })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'We could not check your invitation. Please try again.')
      if (!result.data.allowed) { setError(denial[result.data.reason] || 'Please contact the couple about your invitation.'); return }
      setQuery(parsed.data); setGuest(result.data); requestAnimationFrame(() => document.getElementById('rsvp-name')?.focus())
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Connection problem. Please try again.') }
    finally { if (request.current === controller) { pending.current = false; setBusy(false) } }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current || complete) return
    const result = responseSchema.safeParse({ ...Object.fromEntries(new FormData(event.currentTarget)), email: query })
    if (!result.success) {
      const mapped: Record<string, string> = {}; for (const issue of result.error.issues) mapped[String(issue.path[0])] = issue.message
      setErrors(mapped); requestAnimationFrame(() => document.getElementById(Object.keys(mapped)[0] === 'attending' ? 'attendance-yes' : `rsvp-${Object.keys(mapped)[0]}`)?.focus()); return
    }
    pending.current = true; setBusy(true); setError(''); setErrors({})
    const controller = new AbortController(); request.current = controller
    try {
      const response = await fetch('/api/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result.data), signal: controller.signal })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'We could not save your RSVP. Please try again.')
      setComplete(true); requestAnimationFrame(() => document.getElementById('rsvp-complete')?.focus())
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Connection problem. Please try again.') }
    finally { if (request.current === controller) { pending.current = false; setBusy(false) } }
  }
  return <dialog ref={dialog} className="rsvp-dialog" aria-labelledby="rsvp-dialog-title" onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close() } }}>
    <div className="rsvp-dialog-content">
      <button type="button" className="dialog-close" onClick={close}>Close</button>
      <p className="detail-kicker">{config.partner1} &amp; {config.partner2}</p>
      <h2 id="rsvp-dialog-title" className="font-display">{config.sectionHeadings.rsvp.heading} <em>{config.sectionHeadings.rsvp.italic}</em></h2>
      {config.rsvpDeadline && <p className="field-help">Please RSVP by {config.rsvpDeadline}.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {!guest && !complete && <form onSubmit={verify} noValidate aria-busy={busy}>
        <label className="field-label" htmlFor="invitation-search">Email on your invitation</label>
        <input ref={lookup} id="invitation-search" className="rsvp-input" type="email" autoComplete="email" maxLength={255} value={query} onChange={event => { setQuery(event.target.value); setError('') }} required disabled={busy} />
        <p className="field-help">Use the email address associated with your invitation. Received a personal link? Open it instead, or <a className="text-link" href="/rsvp/find">check your RSVP status</a>.</p>
        <button className="wedding-button" disabled={busy}>{busy ? 'Checking…' : 'Find invitation'}</button>
      </form>}
      {guest && !complete && <form onSubmit={submit} noValidate aria-busy={busy}>
        <div className="invitation-match"><p>{query}</p>{guest.seats && <p>Your invitation reserves {guest.seats} {guest.seats === 1 ? 'seat' : 'seats'}.</p>}<button type="button" className="text-link" onClick={searchAgain} disabled={busy}>Use another email</button></div>
        <label className="field-label" htmlFor="rsvp-name">Full name</label>
        <input id="rsvp-name" className="rsvp-input" name="name" defaultValue={guest.name || ''} maxLength={255} autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} required />
        {errors.name && <p id="name-error" role="alert" className="field-error">{errors.name}</p>}
        <fieldset className="attendance" aria-describedby={errors.attending ? 'attendance-error' : undefined}><legend>Will you be joining us?</legend><label><input id="attendance-yes" type="radio" name="attending" value="yes" required />Joyfully accepts</label><label><input type="radio" name="attending" value="no" />Regretfully declines</label></fieldset>
        {errors.attending && <p id="attendance-error" className="field-error" role="alert">{errors.attending}</p>}
        <label className="field-label" htmlFor="rsvp-dietary">Dietary needs (optional)</label><input id="rsvp-dietary" name="dietary" className="rsvp-input" maxLength={500} />
        <label className="field-label" htmlFor="rsvp-songRequest">A song to get you dancing (optional)</label><input id="rsvp-songRequest" name="songRequest" className="rsvp-input" maxLength={255} />
        <label className="field-label" htmlFor="rsvp-message">A little note for us (optional)</label><textarea id="rsvp-message" name="message" className="rsvp-input" rows={3} maxLength={2000} />
        <button className="wedding-button" disabled={busy}>{busy ? 'Sending…' : 'Send RSVP'}</button>
      </form>}
      {complete && <div className="rsvp-complete" id="rsvp-complete" tabIndex={-1}><h3 className="font-display">Thank you for replying.</h3><p>Your RSVP has been received.</p><button type="button" className="wedding-button" onClick={close}>Done</button></div>}
    </div>
  </dialog>
}
