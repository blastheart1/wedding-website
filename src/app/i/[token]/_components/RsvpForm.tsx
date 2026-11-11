'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import type { InviteView } from '@/lib/invitations/types'
import { Group, Row, PrimaryButton, QuietButton, inputClass, labelClass } from './ui'

interface RsvpFormProps {
  token: string
  view: InviteView
  acknowledgement: string
  onSaved: (view: InviteView) => void
  onCancel?: () => void
}

type Attending = 'yes' | 'no' | ''

export function RsvpForm({ token, view, acknowledgement, onSaved, onCancel }: RsvpFormProps) {
  const previous = view.response
  const [attending, setAttending] = useState<Attending>(previous ? (previous.attending ? 'yes' : 'no') : '')
  const [partySize, setPartySize] = useState(previous?.attending ? Math.max(1, previous.partySize) : 1)
  const [companions, setCompanions] = useState<string[]>(previous?.companions ?? [])
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const changePartySize = (next: number) => {
    const size = Math.min(view.seats, Math.max(1, next))
    setPartySize(size)
    setCompanions(current => Array.from({ length: size - 1 }, (_unused, index) => current[index] ?? ''))
  }

  const setCompanion = (index: number, value: string) =>
    setCompanions(current => current.map((name, position) => (position === index ? value : name)))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!attending) return setError('Please tell us if you can make it.')
    if (!acknowledged) return setError('Please confirm you have read the reminders.')
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '')
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/invite/${token}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({
          attending,
          partySize: attending === 'yes' ? partySize : undefined,
          companions: attending === 'yes' ? companions.slice(0, partySize - 1) : [],
          dietary: text('dietary'),
          songRequest: text('songRequest'),
          message: text('message'),
          acknowledged: true,
        }),
      })
      const json: { success: boolean; data?: InviteView; error?: string } = await response.json()
      if (!json.success || !json.data) return setError(json.error ?? 'Something went wrong. Please try again.')
      onSaved(json.data)
    } catch {
      setError('We could not reach the server. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Group label="Your RSVP">
        <Row>
          <p id="attending-label" className={labelClass}>Will you be joining us?</p>
          <div role="radiogroup" aria-labelledby="attending-label" className="grid grid-cols-2 gap-1 rounded-xl bg-[#F5F2EE] p-1">
            {([['yes', 'Joyfully accept'], ['no', 'Regretfully decline']] as const).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={attending === value}
                onClick={() => { setAttending(value); setError('') }}
                className={clsx(
                  'rounded-lg px-3 py-2.5 font-sans text-[15px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
                  attending === value ? 'bg-white font-medium text-ink shadow-[0_1px_3px_rgba(46,31,26,0.14)]' : 'text-ink2',
                )}
              >
                {text}
              </button>
            ))}
          </div>
        </Row>

        {attending === 'yes' && view.seats > 1 && (
          <Row>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-sans text-[16px] text-ink">How many are coming?</p>
                <p className="font-sans text-[13px] text-ink2">Including you, up to {view.seats}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-[#F5F2EE] p-1">
                <button type="button" aria-label="One fewer guest" disabled={partySize <= 1} onClick={() => changePartySize(partySize - 1)}
                  className="h-9 w-9 rounded-full bg-white font-sans text-[20px] leading-none text-ink disabled:opacity-40">−</button>
                <output aria-live="polite" className="w-8 text-center font-sans text-[17px] font-medium tabular-nums text-ink">{partySize}</output>
                <button type="button" aria-label="One more guest" disabled={partySize >= view.seats} onClick={() => changePartySize(partySize + 1)}
                  className="h-9 w-9 rounded-full bg-white font-sans text-[20px] leading-none text-ink disabled:opacity-40">+</button>
              </div>
            </div>
          </Row>
        )}

        {attending === 'yes' && companions.slice(0, partySize - 1).map((name, index) => (
          <Row key={index}>
            <label className={labelClass} htmlFor={`companion-${index}`}>Guest {index + 2} full name</label>
            <input id={`companion-${index}`} className={inputClass} value={name} maxLength={255} autoComplete="off"
              onChange={event => setCompanion(index, event.target.value)} required />
          </Row>
        ))}

        {attending === 'yes' && (
          <>
            <Row>
              <label className={labelClass} htmlFor="dietary">Dietary needs (optional)</label>
              <input id="dietary" name="dietary" className={inputClass} maxLength={500} defaultValue={previous?.dietary ?? ''} />
            </Row>
            <Row>
              <label className={labelClass} htmlFor="songRequest">A song to get you dancing (optional)</label>
              <input id="songRequest" name="songRequest" className={inputClass} maxLength={255} defaultValue={previous?.songRequest ?? ''} />
            </Row>
          </>
        )}

        {attending && (
          <Row>
            <label className={labelClass} htmlFor="message">A note for us (optional)</label>
            <textarea id="message" name="message" rows={3} className={clsx(inputClass, 'resize-none')} maxLength={2000} defaultValue={previous?.message ?? ''} />
          </Row>
        )}
      </Group>

      <Group>
        <Row>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={acknowledged} onChange={event => { setAcknowledged(event.target.checked); setError('') }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[#2E1F1A]" />
            <span className="font-sans text-[15px] leading-snug text-ink">{acknowledgement}</span>
          </label>
        </Row>
      </Group>

      <p role="alert" aria-live="assertive" className="min-h-[1.5rem] px-4 pt-3 font-sans text-[14px] text-rosedark">{error}</p>

      <div className="mt-2 space-y-3">
        <PrimaryButton type="submit" disabled={busy}>{busy ? 'Sending…' : previous ? 'Save changes' : 'Send RSVP'}</PrimaryButton>
        {onCancel && <QuietButton onClick={onCancel}>Cancel</QuietButton>}
      </div>
    </form>
  )
}
