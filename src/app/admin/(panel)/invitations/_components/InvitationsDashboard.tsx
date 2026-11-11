'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, Search, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invitationsApi, type InvitationSummary } from './api'
import { FILTERS, channelLabel, formatWhen, matchesFilter, matchesSearch, plusText, statusText, totalsOf, type Filter } from './status'
import { Button, Group, Row, Segmented } from '@/app/admin/_ui/primitives'
import { IconButton, PageHeader } from '@/app/admin/_ui/PageHeader'
import { DetailSheet } from './DetailSheet'
import { AddGuestsSheet } from './AddGuestsSheet'
import { SettingsSheet } from './SettingsSheet'

type Panel = { kind: 'detail'; id: number } | { kind: 'add' } | { kind: 'settings' } | null

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-2.5">
      <p className="whitespace-nowrap text-[22px] font-semibold tabular-nums leading-tight text-black/90">{value}</p>
      <p className="text-[13px] text-black/45">{label}</p>
    </div>
  )
}

function secondaryLine(invitation: InvitationSummary): string {
  const parts = [plusText(invitation.seats)]
  if (invitation.sentAt) parts.push(`${channelLabel(invitation.lastChannel)} · ${formatWhen(invitation.sentAt)}`)
  if (invitation.linkRequestedAt) parts.push('Needs a reply')
  return parts.join(' · ')
}

export function InvitationsDashboard({ emailEnabled, emailSimulated }: { emailEnabled: boolean; emailSimulated: boolean }) {
  const [invitations, setInvitations] = useState<InvitationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      setInvitations(await invitationsApi.list())
      setError('')
    } catch (problem) {
      setError(errorMessage(problem))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => totalsOf(invitations), [invitations])
  const visible = useMemo(
    () => invitations.filter(invitation => matchesFilter(invitation, filter) && matchesSearch(invitation, query)),
    [invitations, filter, query],
  )
  const emailable = visible.filter(invitation => invitation.email && invitation.status === 'active')
  const chosen = emailable.filter(invitation => selected.has(invitation.id))

  const toggle = (id: number) => setSelected(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const sendSelected = async () => {
    if (sending || chosen.length === 0) return
    setSending(true)
    try {
      const result = await invitationsApi.sendEmail(chosen.map(invitation => invitation.id), false)
      const skipped = result.skipped.length
      toast.success(`${result.sent} sent${skipped ? `, ${skipped} skipped` : ''}`)
      setSelected(new Set())
      await load()
    } catch (problem) {
      toast.error(errorMessage(problem))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
        <PageHeader title="Invitations">
          <IconButton icon={Settings} label="Invitation settings" onClick={() => setPanel({ kind: 'settings' })} />
          <IconButton icon={Plus} label="Add guests" tone="primary" onClick={() => setPanel({ kind: 'add' })} />
        </PageHeader>

        {emailSimulated && (
          <Group>
            <Row><p className="text-[15px] text-black/85">Email is in simulation mode. Sending records the time and timeline entry, but no email leaves this machine.</p></Row>
          </Group>
        )}

        <Group footnote={totals.linkRequests > 0 ? `${totals.linkRequests} ${totals.linkRequests === 1 ? 'guest needs' : 'guests need'} a reply: they asked for their link or for a change.` : undefined}>
          <div className="grid grid-cols-3 gap-y-1 py-1 sm:grid-cols-6">
            <Stat label="Invited" value={totals.invited} />
            <Stat label="Sent" value={totals.sent} />
            <Stat label="Opened" value={totals.opened} />
            <Stat label="Attending" value={totals.attending} />
            <Stat label="Declined" value={totals.declined} />
            <Stat label="Seats used" value={`${totals.seatsUsed} of ${totals.seatsGiven}`} />
          </div>
        </Group>

        <div className="mt-6 space-y-3">
          <label className="flex items-center gap-2 rounded-[10px] bg-black/[0.06] px-3 py-2">
            <Search size={16} strokeWidth={2.2} className="shrink-0 text-black/40" aria-hidden="true" />
            <span className="sr-only">Search guests</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email or phone"
              className="w-full bg-transparent text-[16px] text-black/85 outline-none placeholder:text-black/40" />
          </label>
          <Segmented label="Filter invitations" value={filter} options={FILTERS} onChange={setFilter} />
        </div>

        {emailEnabled && emailable.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 text-[14px] text-black/55">
            <button type="button" onClick={() => setSelected(chosen.length === emailable.length ? new Set() : new Set(emailable.map(invitation => invitation.id)))}>
              {chosen.length === emailable.length ? 'Clear selection' : `Select all with email (${emailable.length})`}
            </button>
            {chosen.length > 0 && (
              <Button tone="primary" disabled={sending} onClick={sendSelected}>{sending ? 'Sending…' : `Email ${chosen.length} selected`}</Button>
            )}
          </div>
        )}

        <Group footnote={emailEnabled ? 'Guests already emailed are skipped in a bulk send. Open a guest to resend.' : undefined}>
          {loading && <Row><p className="py-6 text-center text-[15px] text-black/45">Loading…</p></Row>}
          {!loading && error && <Row><p className="py-6 text-center text-[15px] text-black/60">{error}</p></Row>}
          {!loading && !error && invitations.length === 0 && (
            <button type="button" onClick={() => setPanel({ kind: 'add' })}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black/50">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2E1F1A] text-white"><Plus size={16} strokeWidth={2.4} aria-hidden="true" /></span>
              <span className="text-[17px] text-black/90">Add your first guest</span>
            </button>
          )}
          {!loading && !error && invitations.length > 0 && visible.length === 0 && (
            <Row><p className="py-6 text-center text-[15px] text-black/45">No guests match.</p></Row>
          )}
          {visible.map(invitation => (
            <div key={invitation.id} className="flex items-stretch border-t border-black/[0.07] first:border-t-0">
              {emailEnabled && (
                <label className="flex items-center pl-4">
                  <span className="sr-only">Select {invitation.guestName}</span>
                  <input type="checkbox" className="h-5 w-5 accent-[#2E1F1A] disabled:opacity-30" disabled={!invitation.email || invitation.status !== 'active'}
                    checked={selected.has(invitation.id)} onChange={() => toggle(invitation.id)} />
                </label>
              )}
              <button type="button" onClick={() => setPanel({ kind: 'detail', id: invitation.id })}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] text-black/90">{invitation.guestName}</span>
                  <span className="block truncate text-[13px] text-black/45">{secondaryLine(invitation)}</span>
                </span>
                <span className={invitation.response?.attending ? 'shrink-0 text-[15px] font-medium text-black/85' : 'shrink-0 text-[15px] text-black/50'}>{statusText(invitation)}</span>
                <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 text-black/25" aria-hidden="true" />
              </button>
            </div>
          ))}
        </Group>

      {panel?.kind === 'detail' && <DetailSheet id={panel.id} emailEnabled={emailEnabled} emailSimulated={emailSimulated} onClose={() => setPanel(null)} onChanged={load} />}
      {panel?.kind === 'add' && <AddGuestsSheet onClose={() => setPanel(null)} onChanged={load} />}
      {panel?.kind === 'settings' && <SettingsSheet onClose={() => setPanel(null)} />}
    </>
  )
}
