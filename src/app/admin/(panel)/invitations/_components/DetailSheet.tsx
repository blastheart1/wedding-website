'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage, invitationsApi, type InvitationDetail, type ShareChannel, type UpdateAction } from './api'
import { channelLabel, eventLabel, formatWhen, smsLink, statusText } from './status'
import { Button, ConfirmButton, Field, Group, Row, Sheet, inputClass, labelClass } from '@/app/admin/_ui/primitives'

interface DetailSheetProps {
  id: number
  emailEnabled: boolean
  emailSimulated: boolean
  onClose: () => void
  onChanged: () => void
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(done)
  } catch {
    toast.error('Copying is blocked in this browser. Select the text and copy it by hand.')
  }
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function DetailSheet({ id, emailEnabled, emailSimulated, onClose, onChanged }: DetailSheetProps) {
  const [detail, setDetail] = useState<InvitationDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    try {
      setDetail(await invitationsApi.detail(id))
      setError('')
    } catch (problem) {
      setError(errorMessage(problem))
    }
  }, [id])

  useEffect(() => { load() }, [load])

  /** Runs one change, then refreshes this sheet and the list behind it. */
  const run = async (work: () => Promise<unknown>, done: string) => {
    if (busy) return
    setBusy(true)
    try {
      await work()
      toast.success(done)
      await load()
      onChanged()
    } catch (problem) {
      toast.error(errorMessage(problem))
    } finally {
      setBusy(false)
    }
  }
  const update = (input: UpdateAction, done: string) => run(() => invitationsApi.update(input), done)

  if (!detail) {
    return (
      <Sheet title="Invitation" onClose={onClose}>
        <p className="py-10 text-center text-[15px] text-black/50">{error || 'Loading…'}</p>
      </Sheet>
    )
  }

  const { invitation, link, qrSvg, shareMessage, preview } = detail
  const active = invitation.status === 'active'
  const markSent = (channel: ShareChannel) => update({ action: 'shared', id, channel }, `Marked as sent via ${channelLabel(channel)}`)

  const share = async () => {
    if (!navigator.share) return copy(shareMessage, 'Message copied. Paste it into Messenger or Instagram.')
    try {
      await navigator.share({ text: shareMessage })
    } catch {
      // The share sheet was dismissed; nothing was sent.
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '')
    await update({ action: 'edit', id, guestName: text('guestName'), email: text('email'), phone: text('phone'), seats: Number(text('plus')) + 1 }, 'Saved')
    setEditing(false)
  }

  return (
    <Sheet title={invitation.guestName} onClose={onClose}>
      {invitation.linkRequestedAt && (
        <Group>
          <Row><p className="text-[15px] text-black/85">This guest asked for their link or a change on {formatWhen(invitation.linkRequestedAt)}. See the timeline, then send their link again below.</p></Row>
        </Group>
      )}

      <Group label="Link and QR" footnote={active ? undefined : 'This link is revoked. Guests who open it see the neutral "not active" page.'}>
        <Row className="flex flex-col items-center gap-3 py-5">
          <div className="h-48 w-48 overflow-hidden rounded-xl" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="max-w-full select-all break-all text-center text-[13px] text-black/55">{link}</p>
        </Row>
        <Row className="flex flex-wrap gap-2">
          <Button onClick={() => copy(link, 'Link copied')}>Copy link</Button>
          <Button onClick={() => copy(shareMessage, 'Message copied')}>Copy message</Button>
          <Button onClick={share}>Share</Button>
          <a href={invitationsApi.qrPngUrl(id)} className="rounded-full bg-black/[0.055] px-4 py-2.5 text-[15px] font-medium text-black/85">QR as PNG</a>
          <Button onClick={() => download(`invitation-${id}.svg`, qrSvg, 'image/svg+xml')}>QR as SVG</Button>
        </Row>
      </Group>

      <Group label="Send" footnote="Messenger, Instagram and text messages are sent by you, not from here. Copy or share the message, send it, then mark it so the time is recorded.">
        {invitation.email && (
          <Row className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-[16px] text-black/85">{invitation.email}</span>
            <Button tone="primary" disabled={busy || !active || !emailEnabled}
              onClick={() => run(() => invitationsApi.sendEmail([id], Boolean(invitation.sentAt)), emailSimulated ? 'Simulated: nothing was sent' : 'Email sent')}>
              {emailSimulated ? 'Simulate email' : invitation.sentAt ? 'Resend email' : 'Send email'}
            </Button>
          </Row>
        )}
        <Row className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-black/50">{emailEnabled ? 'See the email before it goes out' : 'Email sending is not set up yet. You can still see the email.'}</span>
          <a href={invitationsApi.emailPreviewUrl(id)} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-black/[0.055] px-4 py-2.5 text-[15px] font-medium text-black/85">Preview email</a>
        </Row>
        {invitation.phone && (
          <Row className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-[16px] text-black/85">{invitation.phone}</span>
            <a href={smsLink(invitation.phone, shareMessage)} className="shrink-0 rounded-full bg-black/[0.055] px-4 py-2.5 text-[15px] font-medium text-black/85">Open in Messages</a>
          </Row>
        )}
        <Row className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[15px] text-black/50">Mark as sent via</span>
          <Button disabled={busy || !active} onClick={() => markSent('messenger')}>Messenger</Button>
          <Button disabled={busy || !active} onClick={() => markSent('instagram')}>Instagram</Button>
          <Button disabled={busy || !active} onClick={() => markSent('sms')}>SMS</Button>
          <Button disabled={busy || !active} onClick={() => markSent('other')}>Other</Button>
        </Row>
      </Group>

      <Group label="Link preview" footnote="What Messenger and Instagram show when this link is pasted. Edit the wording in Settings.">
        <Row>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.image} alt="" className="aspect-[1200/630] w-full rounded-lg bg-black/[0.04] object-cover" />
          <p className="mt-2 text-[15px] font-medium text-black/85">{preview.title}</p>
          <p className="text-[13px] leading-snug text-black/50">{preview.description}</p>
        </Row>
      </Group>

      {editing ? (
        <form onSubmit={saveEdit}>
          <Group label="Guest">
            <Row><label className={labelClass} htmlFor="edit-name">Name</label><input id="edit-name" name="guestName" className={inputClass} defaultValue={invitation.guestName} maxLength={255} required /></Row>
            <Row><label className={labelClass} htmlFor="edit-email">Email (optional)</label><input id="edit-email" name="email" type="email" className={inputClass} defaultValue={invitation.email ?? ''} maxLength={255} /></Row>
            <Row><label className={labelClass} htmlFor="edit-phone">Phone (optional)</label><input id="edit-phone" name="phone" type="tel" className={inputClass} defaultValue={invitation.phone ?? ''} maxLength={40} /></Row>
            <Row><label className={labelClass} htmlFor="edit-plus">Plus (extra guests they may bring)</label><input id="edit-plus" name="plus" type="number" min={0} max={19} className={inputClass} defaultValue={invitation.seats - 1} required /></Row>
          </Group>
          <div className="mt-4 flex gap-2"><Button type="submit" tone="primary" disabled={busy}>Save</Button><Button onClick={() => setEditing(false)}>Cancel</Button></div>
        </form>
      ) : (
        <Group label="Guest">
          <Field label="Status" value={statusText(invitation)} />
          <Field label="Email" value={invitation.email ?? 'None'} />
          <Field label="Phone" value={invitation.phone ?? 'None'} />
          <Field label="Plus" value={invitation.seats - 1} />
          <Field label="Sent" value={invitation.sentAt ? `${formatWhen(invitation.sentAt)} · ${channelLabel(invitation.lastChannel)}` : 'Not yet'} />
          <Field label="Opened" value={invitation.firstOpenedAt ? `${formatWhen(invitation.firstOpenedAt)} · ${invitation.openCount} ${invitation.openCount === 1 ? 'visit' : 'visits'}` : 'Not yet'} />
          <Row><Button onClick={() => setEditing(true)}>Edit details</Button></Row>
        </Group>
      )}

      {invitation.response && (
        <Group label="Response">
          <Field label="Answer" value={invitation.response.attending ? 'Attending' : 'Declined'} />
          <Field label="Received" value={formatWhen(invitation.respondedAt)} />
          {invitation.response.updatedAt && invitation.response.updatedAt !== invitation.respondedAt && <Field label="Last changed" value={formatWhen(invitation.response.updatedAt)} />}
          {invitation.response.attending && <Field label="Seats used" value={`${invitation.response.partySize} of ${invitation.seats}`} />}
          {invitation.response.companions.length > 0 && <Field label="Bringing" value={invitation.response.companions.join(', ')} />}
          {invitation.response.dietary && <Field label="Dietary" value={invitation.response.dietary} />}
          {invitation.response.songRequest && <Field label="Song" value={invitation.response.songRequest} />}
          {invitation.response.message && <Field label="Note" value={invitation.response.message} />}
        </Group>
      )}

      <Group label="Timeline">
        {invitation.events.length === 0 && <Row><p className="text-[15px] text-black/50">Nothing yet.</p></Row>}
        {invitation.events.map(event => (
          <Row key={event.id} className="flex items-baseline justify-between gap-4">
            <span className="text-[15px] text-black/85">{eventLabel(event.type, event.channel, event.meta)}</span>
            <span className="shrink-0 text-[13px] tabular-nums text-black/45">{formatWhen(event.createdAt)}</span>
          </Row>
        ))}
      </Group>

      <Group label="Manage" footnote="A new link replaces the old one, which stops working straight away. An invitation with a response can be revoked but not deleted.">
        <Row className="flex flex-wrap gap-2">
          {active
            ? <ConfirmButton confirmText="Tap again to revoke" disabled={busy} onConfirm={() => update({ action: 'revoke', id }, 'Link revoked')}>Revoke link</ConfirmButton>
            : <Button disabled={busy} onClick={() => update({ action: 'restore', id }, 'Link restored')}>Restore link</Button>}
          <ConfirmButton tone="plain" confirmText="Tap again for a new link" disabled={busy} onConfirm={() => update({ action: 'regenerate', id }, 'New link issued')}>New link</ConfirmButton>
          {!invitation.response && (
            <ConfirmButton confirmText="Tap again to delete" disabled={busy}
              onConfirm={() => run(async () => { await invitationsApi.remove(id); onClose() }, 'Invitation deleted')}>Delete</ConfirmButton>
          )}
        </Row>
      </Group>
    </Sheet>
  )
}
