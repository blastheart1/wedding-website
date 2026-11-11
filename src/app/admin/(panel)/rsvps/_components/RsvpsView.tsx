'use client'

import { useState } from 'react'
import { ChevronRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import type { RSVP } from '@/lib/schema'
import { useAdminConfig } from '@/app/admin/_lib/useAdminConfig'
import { IconButton, PageHeader } from '@/app/admin/_ui/PageHeader'
import { Field, Group, Row, Sheet } from '@/app/admin/_ui/primitives'
import { LoadState } from '@/app/admin/_ui/forms'

function companionsOf(rsvp: RSVP): string[] {
  if (!rsvp.companions) return []
  try {
    const value: unknown = JSON.parse(rsvp.companions)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const partySizeOf = (rsvp: RSVP): number => rsvp.partySize ?? (rsvp.attending ? 1 : 0)
const answerOf = (rsvp: RSVP): string => (rsvp.attending ? `Attending · ${partySizeOf(rsvp)}` : 'Declined')
const dateOf = (value: Date | string): string => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

async function exportSpreadsheet() {
  try {
    const response = await fetch('/api/admin/export', { credentials: 'include' })
    if (!response.ok) throw new Error('export failed')
    const url = URL.createObjectURL(await response.blob())
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'Luis_Bee_RSVPs.xlsx'
    anchor.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('The export did not work. Please try again.')
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-[22px] font-semibold tabular-nums leading-tight text-black/90">{value}</p>
      <p className="text-[13px] text-black/45">{label}</p>
    </div>
  )
}

export function RsvpsView() {
  const { rsvps, stats, loading, error } = useAdminConfig()
  const [selected, setSelected] = useState<RSVP | null>(null)
  const seats = rsvps.reduce((sum, rsvp) => sum + partySizeOf(rsvp), 0)

  return (
    <>
      <PageHeader title="RSVPs">
        <IconButton icon={Download} label="Export to Excel" onClick={exportSpreadsheet} disabled={rsvps.length === 0} />
      </PageHeader>
      <LoadState loading={loading} error={error} />

      {!loading && !error && (
        <>
          <Group>
            <div className="grid grid-cols-2 gap-y-1 py-1 sm:grid-cols-4">
              <Stat label="Responses" value={stats.total} />
              <Stat label="Attending" value={stats.attending} />
              <Stat label="Declined" value={stats.declining} />
              <Stat label="Seats confirmed" value={seats} />
            </div>
          </Group>

          <Group>
            {rsvps.length === 0 && <Row><p className="py-6 text-center text-[15px] text-black/45">RSVPs appear here as guests respond.</p></Row>}
            {rsvps.map(rsvp => (
              <button key={rsvp.id} type="button" onClick={() => setSelected(rsvp)}
                className="flex w-full items-center gap-3 border-t border-black/[0.07] px-4 py-3 text-left first:border-t-0 active:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] text-black/90">{rsvp.name}</span>
                  <span className="block truncate text-[13px] text-black/45">{[rsvp.email ?? 'No email', dateOf(rsvp.createdAt)].join(' · ')}</span>
                </span>
                <span className={rsvp.attending ? 'shrink-0 text-[15px] font-medium text-black/85' : 'shrink-0 text-[15px] text-black/50'}>{answerOf(rsvp)}</span>
                <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 text-black/25" aria-hidden="true" />
              </button>
            ))}
          </Group>
        </>
      )}

      {selected && (
        <Sheet title={selected.name} onClose={() => setSelected(null)}>
          <Group label="Response">
            <Field label="Answer" value={selected.attending ? 'Attending' : 'Declined'} />
            {selected.attending && <Field label="Seats" value={partySizeOf(selected)} />}
            {companionsOf(selected).length > 0 && <Field label="Bringing" value={companionsOf(selected).join(', ')} />}
            <Field label="Email" value={selected.email ?? 'None'} />
            <Field label="Received" value={dateOf(selected.createdAt)} />
            {selected.updatedAt && <Field label="Last changed" value={dateOf(selected.updatedAt)} />}
            <Field label="Came through" value={selected.invitationId ? 'Personal invitation' : 'Earlier email form'} />
          </Group>
          {(selected.dietary || selected.meal || selected.songRequest || selected.message) && (
            <Group label="Details">
              {(selected.dietary || selected.meal) && <Field label="Dietary" value={selected.dietary ?? selected.meal} />}
              {selected.songRequest && <Field label="Song" value={selected.songRequest} />}
              {selected.message && <Field label="Note" value={selected.message} />}
            </Group>
          )}
        </Sheet>
      )}
    </>
  )
}
