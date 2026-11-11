'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { PublicConfig } from '@/lib/config'
import { statusCopy } from '@/lib/invitations/status-copy'
import { useStatusCheck } from '@/components/rsvp/useStatusCheck'

/**
 * The site's RSVP button. RSVPs happen through each guest's personal link, so
 * this dialog checks a guest's status by exact email or mobile number, sends
 * their link again, and lets a guest who has replied ask for a change.
 */
export function RSVPDialog({ config }: { config: PublicConfig }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const status = useStatusCheck()

  useEffect(() => {
    const show = () => { returnFocus.current = document.activeElement as HTMLElement; setOpen(true) }
    const hash = () => { if (window.location.hash === '#rsvp') show() }
    window.addEventListener('open-wedding-rsvp', show)
    window.addEventListener('hashchange', hash)
    hash()
    return () => { window.removeEventListener('open-wedding-rsvp', show); window.removeEventListener('hashchange', hash) }
  }, [])

  useEffect(() => {
    if (!open || !dialog.current) return
    const element = dialog.current
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    field.current?.focus()
    return () => { element.close(); document.body.style.overflow = overflow; returnFocus.current?.focus({ preventScroll: true }) }
  }, [open])

  const close = () => { setOpen(false); setAsking(false); status.reset() }

  function check(event: FormEvent) {
    event.preventDefault()
    setAsking(false)
    if (status.contact.trim()) status.check()
  }

  function sendChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const note = String(new FormData(event.currentTarget).get('note') ?? '').trim()
    if (note) status.requestChange(note)
  }

  const copy = status.result && statusCopy(status.result, config.rsvpDeadline)

  return <dialog ref={dialog} className="rsvp-dialog" aria-labelledby="rsvp-dialog-title" onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close() } }}>
    <div className="rsvp-dialog-content">
      <button type="button" className="dialog-close" onClick={close}>Close</button>
      <p className="detail-kicker">{config.partner1} &amp; {config.partner2}</p>
      <h2 id="rsvp-dialog-title" className="font-display">{config.sectionHeadings.rsvp.heading} <em>{config.sectionHeadings.rsvp.italic}</em></h2>
      <p className="field-help">RSVPs are by personal invitation. If you have your link, open it to reply. Otherwise check your invitation here.{config.rsvpDeadline ? ` Please RSVP by ${config.rsvpDeadline}.` : ''}</p>
      {status.error && <p className="field-error" role="alert">{status.error}</p>}

      <form onSubmit={check} noValidate aria-busy={status.busy}>
        <label className="field-label" htmlFor="invitation-search">Email or mobile number</label>
        <input ref={field} id="invitation-search" className="rsvp-input" autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="email" maxLength={255}
          value={status.contact} onChange={event => status.setContact(event.target.value)} disabled={status.busy} />
        <p className="field-help">Use the one we have for you. It has to match exactly.</p>
        <button className="wedding-button" disabled={status.busy || !status.contact.trim()}>{status.busy && !asking ? 'Checking…' : 'Check my invitation'}</button>
      </form>

      {copy && <div className="rsvp-complete" role="status" aria-live="polite">
        <h3 className="font-display">{copy.title}</h3>
        <p>{copy.body}</p>
        {copy.canRequestChange && !status.changeSent && !asking && <button type="button" className="text-link" onClick={() => setAsking(true)}>Ask us to change something</button>}
        {copy.canRequestChange && asking && !status.changeSent && <form onSubmit={sendChange} noValidate aria-busy={status.busy}>
          <label className="field-label" htmlFor="rsvp-change-note">What would you like to change?</label>
          <textarea id="rsvp-change-note" name="note" className="rsvp-input" rows={3} maxLength={500} required disabled={status.busy} />
          <p className="field-help">We will read this and get back to you. To change it yourself, use your personal link.</p>
          <button className="wedding-button" disabled={status.busy}>{status.busy ? 'Sending…' : 'Send to the couple'}</button>
        </form>}
        {status.changeSent && <p>Thank you. We have your note and will get back to you.</p>}
      </div>}
    </div>
  </dialog>
}
export function openWeddingRsvp() { window.dispatchEvent(new CustomEvent('open-wedding-rsvp')) }
