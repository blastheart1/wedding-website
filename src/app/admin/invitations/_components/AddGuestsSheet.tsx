'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { parseBulkLines } from '@/lib/invitations/admin-schemas'
import { errorMessage, invitationsApi, type BulkResult } from './api'
import { Button, ConfirmButton, Group, Row, Segmented, Sheet, inputClass, labelClass } from './ui'

type Mode = 'one' | 'many'

const MODES = [{ value: 'one', label: 'One guest' }, { value: 'many', label: 'Paste a list' }] as const

function summarise(result: BulkResult): string {
  const skipped = result.skipped.length
  return `${result.created} added${skipped ? `, ${skipped} skipped (contact already has an invitation)` : ''}`
}

export function AddGuestsSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<Mode>('one')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [list, setList] = useState('')
  const parsed = parseBulkLines(list)

  const finish = (message: string) => { toast.success(message); onChanged(); onClose() }
  const guard = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError('')
    try { await work() } catch (problem) { setError(errorMessage(problem)) } finally { setBusy(false) }
  }

  function addOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '')
    guard(async () => {
      await invitationsApi.create({ guestName: text('guestName'), email: text('email'), phone: text('phone'), seats: Number(text('plus') || 0) + 1 })
      finish('Guest added')
    })
  }

  const addMany = () => guard(async () => {
    const guests = parsed.guests.map(guest => ({ guestName: guest.guestName, email: guest.email ?? '', phone: guest.phone ?? '', seats: guest.seats }))
    finish(summarise(await invitationsApi.createMany(guests)))
  })

  return (
    <Sheet title="Add guests" onClose={onClose}>
      <div className="pt-4"><Segmented label="How to add" value={mode} options={MODES} onChange={setMode} /></div>

      {mode === 'one' ? (
        <form onSubmit={addOne}>
          <Group footnote="Email and phone are optional. They let the guest find their status if they lose the link, and email lets you send the invitation from here.">
            <Row><label className={labelClass} htmlFor="add-name">Name</label><input id="add-name" name="guestName" className={inputClass} maxLength={255} required autoFocus /></Row>
            <Row><label className={labelClass} htmlFor="add-email">Email (optional)</label><input id="add-email" name="email" type="email" className={inputClass} maxLength={255} /></Row>
            <Row><label className={labelClass} htmlFor="add-phone">Phone (optional)</label><input id="add-phone" name="phone" type="tel" className={inputClass} maxLength={40} placeholder="0917 123 4567" /></Row>
            <Row><label className={labelClass} htmlFor="add-plus">Plus (extra guests they may bring)</label><input id="add-plus" name="plus" type="number" min={0} max={19} defaultValue={0} className={inputClass} /></Row>
          </Group>
          <p role="alert" className="min-h-[1.25rem] px-4 pt-2 text-[13px] text-[#B3261E]">{error}</p>
          <Button type="submit" tone="primary" disabled={busy} className="mt-2 w-full">Add guest</Button>
        </form>
      ) : (
        <>
          <Group footnote="One guest per line: Name, email or phone, plus. Only the name is required. Example: Maria Santos, maria@example.com, 2">
            <Row>
              <label className={labelClass} htmlFor="add-list">Guest list</label>
              <textarea id="add-list" rows={8} className={`${inputClass} resize-none`} value={list} onChange={event => setList(event.target.value)} />
            </Row>
          </Group>
          {parsed.errors.length > 0 && (
            <Group label="Lines to fix">
              {parsed.errors.slice(0, 8).map(issue => (
                <Row key={`${issue.line}-${issue.message}`}><p className="text-[14px] text-black/75">{issue.line ? `Line ${issue.line}: ` : ''}{issue.message}</p></Row>
              ))}
            </Group>
          )}
          <p role="alert" className="min-h-[1.25rem] px-4 pt-2 text-[13px] text-[#B3261E]">{error}</p>
          <Button tone="primary" disabled={busy || parsed.guests.length === 0 || parsed.errors.length > 0} onClick={addMany} className="mt-2 w-full">
            {parsed.guests.length ? `Add ${parsed.guests.length} ${parsed.guests.length === 1 ? 'guest' : 'guests'}` : 'Add guests'}
          </Button>
        </>
      )}

      <Group label="From the older guest list" footnote="Creates an invitation for every allowed guest on the email guest list who does not have one yet. Nothing on that list is changed.">
        <Row>
          <ConfirmButton tone="plain" confirmText="Tap again to import" disabled={busy}
            onConfirm={() => guard(async () => finish(summarise(await invitationsApi.importGuestList())))}>Import guest list</ConfirmButton>
        </Row>
      </Group>
    </Sheet>
  )
}
