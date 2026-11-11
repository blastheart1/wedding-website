'use client'

import { useState, type FormEvent } from 'react'
import { statusCopy } from '@/lib/invitations/status-copy'
import { useStatusCheck } from '@/components/rsvp/useStatusCheck'

interface FindStatusProps {
  couple: { partner1: string; partner2: string }
  contactEmail: string
  deadline: string
}

const fieldClass = 'w-full rounded-xl bg-white px-4 py-3.5 font-sans text-[16px] text-ink outline-none transition-shadow focus:ring-2 focus:ring-ink/25'
const buttonClass = 'w-full rounded-full bg-ink px-6 py-3.5 font-sans text-[16px] font-medium text-cream transition-opacity active:opacity-80 disabled:opacity-50'

export function FindStatus({ couple, contactEmail, deadline }: FindStatusProps) {
  const status = useStatusCheck()
  const [asking, setAsking] = useState(false)
  const copy = status.result && statusCopy(status.result, deadline)

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-6 py-16">
      <p className="text-center font-sans text-[13px] uppercase tracking-[0.14em] text-ink2">{couple.partner1} &amp; {couple.partner2}</p>
      <h1 className="mt-3 text-center font-serif text-[36px] leading-tight text-ink">Check your RSVP</h1>
      <p className="mt-3 text-center font-sans text-[16px] leading-relaxed text-ink2">
        Enter the email address or mobile number we have for you. It has to match exactly.
      </p>

      <form onSubmit={check} noValidate className="mt-8">
        <label htmlFor="find-contact" className="mb-1.5 block px-1 font-sans text-[14px] text-ink2">Email or mobile number</label>
        <input id="find-contact" value={status.contact} onChange={event => status.setContact(event.target.value)}
          autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="email" maxLength={255} className={fieldClass} />
        <p role="alert" aria-live="assertive" className="min-h-[1.5rem] px-1 pt-2 font-sans text-[14px] text-rosedark">{status.error}</p>
        <button type="submit" disabled={status.busy || !status.contact.trim()} className={`mt-1 ${buttonClass}`}>{status.busy && !asking ? 'Checking…' : 'Check'}</button>
      </form>

      {copy && (
        <section aria-live="polite" className="mt-8 rounded-2xl bg-white px-5 py-5 shadow-[0_1px_2px_rgba(46,31,26,0.06)]">
          <h2 className="font-serif text-[24px] leading-tight text-ink">{copy.title}</h2>
          <p className="mt-2 font-sans text-[15px] leading-relaxed text-ink2">{copy.body}</p>
          {copy.canRequestChange && !status.changeSent && !asking && (
            <button type="button" onClick={() => setAsking(true)} className="mt-3 font-sans text-[15px] text-ink underline underline-offset-4">Ask us to change something</button>
          )}
          {copy.canRequestChange && asking && !status.changeSent && (
            <form onSubmit={sendChange} noValidate className="mt-4">
              <label htmlFor="find-change-note" className="mb-1.5 block font-sans text-[14px] text-ink2">What would you like to change?</label>
              <textarea id="find-change-note" name="note" rows={3} maxLength={500} required disabled={status.busy} className={`${fieldClass} resize-none bg-[#F5F2EE]`} />
              <button type="submit" disabled={status.busy} className={`mt-3 ${buttonClass}`}>{status.busy ? 'Sending…' : 'Send to the couple'}</button>
            </form>
          )}
          {status.changeSent && <p className="mt-3 font-sans text-[15px] leading-relaxed text-ink">Thank you. We have your note and will get back to you.</p>}
        </section>
      )}

      <p className="mt-10 text-center font-sans text-[14px] text-ink2">
        {contactEmail && <><a href={`mailto:${contactEmail}`} className="underline underline-offset-4">Contact us</a><span className="px-2">·</span></>}
        <a href="/" className="underline underline-offset-4">Back to the wedding site</a>
      </p>
    </main>
  )
}
