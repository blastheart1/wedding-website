'use client'

import { useState, type FormEvent } from 'react'

interface FindStatusProps {
  couple: { partner1: string; partner2: string }
  contactEmail: string
}

interface LookupResult {
  found: boolean
  responded: boolean
  delivery: 'email' | 'manual' | 'recent' | null
}

function resultCopy(result: LookupResult): { title: string; body: string } {
  if (!result.found) {
    return {
      title: 'We could not find that',
      body: 'Try the other email address or mobile number you use. If you were invited and still cannot find yourself, contact us and we will sort it out.',
    }
  }
  const status = result.responded ? 'We have your RSVP.' : 'We have not received your RSVP yet.'
  const next =
    result.delivery === 'email' ? 'We have emailed your personal link to you again. Open it to view or change your answer.'
    : result.delivery === 'manual' ? 'We have let the couple know, and they will message you your personal link.'
    : 'Your link was sent a few minutes ago. Please check your messages, or contact us.'
  return { title: 'You are on our list', body: `${status} ${next}` }
}

export function FindStatus({ couple, contactEmail }: FindStatusProps) {
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !contact.trim()) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/invite/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact }),
      })
      const json: { success: boolean; data?: LookupResult; error?: string } = await response.json()
      if (json.success && json.data) setResult(json.data)
      else setError(json.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('We could not reach the server. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const copy = result && resultCopy(result)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-6 py-16">
      <p className="text-center font-sans text-[13px] uppercase tracking-[0.14em] text-ink2">{couple.partner1} &amp; {couple.partner2}</p>
      <h1 className="mt-3 text-center font-serif text-[36px] leading-tight text-ink">Check your RSVP</h1>
      <p className="mt-3 text-center font-sans text-[16px] leading-relaxed text-ink2">
        Enter the email address or mobile number we have for you. It has to match exactly.
      </p>

      <form onSubmit={submit} noValidate className="mt-8">
        <label htmlFor="find-contact" className="mb-1.5 block px-1 font-sans text-[14px] text-ink2">Email or mobile number</label>
        <input
          id="find-contact"
          value={contact}
          onChange={event => { setContact(event.target.value); setError('') }}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          maxLength={255}
          className="w-full rounded-xl bg-white px-4 py-3.5 font-sans text-[16px] text-ink outline-none transition-shadow focus:ring-2 focus:ring-ink/25"
        />
        <p role="alert" aria-live="assertive" className="min-h-[1.5rem] px-1 pt-2 font-sans text-[14px] text-rosedark">{error}</p>
        <button type="submit" disabled={busy || !contact.trim()}
          className="mt-1 w-full rounded-full bg-ink px-6 py-3.5 font-sans text-[16px] font-medium text-cream transition-opacity active:opacity-80 disabled:opacity-50">
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>

      {copy && (
        <section aria-live="polite" className="mt-8 rounded-2xl bg-white px-5 py-5 shadow-[0_1px_2px_rgba(46,31,26,0.06)]">
          <h2 className="font-serif text-[24px] leading-tight text-ink">{copy.title}</h2>
          <p className="mt-2 font-sans text-[15px] leading-relaxed text-ink2">{copy.body}</p>
        </section>
      )}

      <p className="mt-10 text-center font-sans text-[14px] text-ink2">
        {contactEmail && <><a href={`mailto:${contactEmail}`} className="underline underline-offset-4">Contact us</a><span className="px-2">·</span></>}
        <a href="/" className="underline underline-offset-4">Back to the wedding site</a>
      </p>
    </main>
  )
}
