'use client'

import { useEffect, useRef, useState } from 'react'
import type { InviteView } from '@/lib/invitations/types'
import { Group, Row, QuietButton } from './ui'
import { RsvpForm } from './RsvpForm'
import { YourTable } from './YourTable'

export interface InviteExperienceProps {
  token: string
  initialView: InviteView
  couple: { partner1: string; partner2: string; date: string }
  dos: string[]
  donts: string[]
  acknowledgement: string
  faqs: { id: number; question: string; answer: string }[]
}

const joinNames = (names: readonly string[]): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

function seatsLine(view: InviteView): string {
  // The couple's own list names who the invitation includes; otherwise it is just a number.
  if (view.plusOnes?.length) return `Your invitation includes you and ${joinNames(view.plusOnes)}.`
  if (view.plus === 0) return 'This invitation is reserved for you.'
  return `Your invitation includes you and ${view.plus} ${view.plus === 1 ? 'guest' : 'guests'}.`
}

function ResponseSummary({ view, onEdit }: { view: InviteView; onEdit: () => void }) {
  const response = view.response
  if (!response) return null
  // On a closed list, whoever was not ticked has given up their seat.
  const notComing = (view.plusOnes ?? []).filter((_name, position) => !(response.bringing ?? []).includes(position))
  return (
    <>
      <Group label="Your RSVP" footnote={view.canEdit
        ? (view.deadline ? `You can change your answer until ${view.deadline}.` : 'You can change your answer any time.')
        : 'The RSVP deadline has passed. Please contact us for any changes.'}>
        <Row>
          <p className="font-serif text-[26px] leading-tight text-ink">
            {response.attending ? 'We will see you there.' : 'We will miss you.'}
          </p>
          <p className="mt-1 font-sans text-[15px] text-ink2">
            {response.attending
              ? `${response.partySize} ${response.partySize === 1 ? 'seat' : 'seats'} confirmed`
              : 'You let us know you cannot make it.'}
          </p>
        </Row>
        {response.attending && response.companions.length > 0 && (
          <Row>
            <p className="font-sans text-[13px] text-ink2">Coming with you</p>
            <p className="break-words font-sans text-[16px] text-ink">{response.companions.join(', ')}</p>
          </Row>
        )}
        {response.attending && notComing.length > 0 && (
          <Row>
            <p className="font-sans text-[13px] text-ink2">Not coming (these seats are released)</p>
            <p className="break-words font-sans text-[16px] text-ink">{notComing.join(', ')}</p>
          </Row>
        )}
        {response.dietary && (
          <Row>
            <p className="font-sans text-[13px] text-ink2">Dietary needs</p>
            <p className="font-sans text-[16px] text-ink">{response.dietary}</p>
          </Row>
        )}
      </Group>
      {view.canEdit && <div className="mt-5"><QuietButton onClick={onEdit}>Edit response</QuietButton></div>}
    </>
  )
}

export function InviteExperience({ token, initialView, couple, dos, donts, acknowledgement, faqs }: InviteExperienceProps) {
  const [view, setView] = useState(initialView)
  const [editing, setEditing] = useState(!initialView.response && initialView.canEdit)
  const [saved, setSaved] = useState(false)
  const banner = useRef<HTMLDivElement>(null)
  // After sending, the confirmation is what the guest sees and what a screen reader announces.
  useEffect(() => { if (saved) banner.current?.focus({ preventScroll: true }) }, [saved])

  // Counted only when the page runs in a real browser; link-preview robots never get here.
  useEffect(() => {
    fetch(`/api/invite/${token}/open`, { method: 'POST', keepalive: true, referrerPolicy: 'no-referrer' }).catch(() => undefined)
  }, [token])

  return (
    <main className="mx-auto min-h-screen w-full max-w-[560px] pb-[max(4rem,calc(env(safe-area-inset-bottom)+2rem))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(3rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <header className="px-4 text-center">
        <p className="font-sans text-[13px] uppercase tracking-[0.14em] text-ink2">{couple.partner1} &amp; {couple.partner2}</p>
        <h1 className="mt-3 font-serif text-[40px] leading-[1.1] text-ink">Welcome, {view.firstName}</h1>
        <p className="mt-3 font-sans text-[16px] leading-relaxed text-ink2">
          We would love to celebrate with you on {couple.date}.<br />{seatsLine(view)}
        </p>
      </header>

      {view.seating && <YourTable seating={view.seating} />}

      {saved && view.response && (
        <div ref={banner} role="status" tabIndex={-1} className="mt-6 rounded-2xl bg-ink px-5 py-4 text-center font-sans text-[16px] leading-snug text-cream outline-none">
          {view.response.attending ? 'Thank you. Your RSVP is in.' : 'Thank you for letting us know.'}
        </div>
      )}

      {(dos.length > 0 || donts.length > 0) && (
        <>
          {dos.length > 0 && (
            <Group label="Please do">
              {dos.map(item => <Row key={item}><p className="font-sans text-[16px] leading-snug text-ink">{item}</p></Row>)}
            </Group>
          )}
          {donts.length > 0 && (
            <Group label="Please don't">
              {donts.map(item => <Row key={item}><p className="font-sans text-[16px] leading-snug text-ink">{item}</p></Row>)}
            </Group>
          )}
        </>
      )}

      {faqs.length > 0 && (
        <Group label="Questions">
          {faqs.map(faq => (
            <details key={faq.id} className="group border-t border-black/[0.06] first:border-t-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 font-sans text-[16px] text-ink [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink2/70 transition-transform group-open:-rotate-[135deg]" />
              </summary>
              <p className="whitespace-pre-line px-4 pb-4 font-sans text-[15px] leading-relaxed text-ink2">{faq.answer}</p>
            </details>
          ))}
        </Group>
      )}

      {editing && view.canEdit ? (
        <RsvpForm
          token={token}
          view={view}
          acknowledgement={acknowledgement}
          onSaved={next => { setView(next); setEditing(false); setSaved(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          onCancel={view.response ? () => setEditing(false) : undefined}
        />
      ) : view.response ? (
        <ResponseSummary view={view} onEdit={() => { setSaved(false); setEditing(true) }} />
      ) : (
        <Group label="Your RSVP">
          <Row><p className="font-sans text-[16px] text-ink">The RSVP deadline has passed. Please contact us and we will help you.</p></Row>
        </Group>
      )}

      <p className="mt-10 text-center font-sans text-[14px] text-ink2">
        <a href="/" className="inline-flex min-h-[44px] items-center underline underline-offset-4">Visit the wedding site</a>
      </p>
    </main>
  )
}
