'use client'

import type { WeddingConfig } from '@/lib/schema'
import { useAdminConfig, useUnsavedWarning } from '@/app/admin/_lib/useAdminConfig'
import { PageHeader } from '@/app/admin/_ui/PageHeader'
import { Button, Group } from '@/app/admin/_ui/primitives'
import { LoadState, TextRow } from '@/app/admin/_ui/forms'
import { PresentationGroups } from './PresentationGroups'
import { BackgroundsGroup } from './BackgroundsGroup'
import { HeadingsGroup } from './HeadingsGroup'

type TextKey = Extract<keyof WeddingConfig,
  'partner1' | 'partner2' | 'weddingDate' | 'ceremonyTime' | 'receptionTime' | 'rsvpDeadline' | 'ceremonyVenue'
  | 'location' | 'receptionVenue' | 'hotelName' | 'hotelCode' | 'hotelDiscount' | 'heroVideoUrl' | 'dressCode' | 'guestNotes'>

export function SettingsView() {
  const { config, setConfig, set, loading, error, dirty, saving, save } = useAdminConfig()
  useUnsavedWarning(dirty)

  const text = (key: TextKey, label: string, placeholder = '', extra: { rows?: number; hint?: string } = {}) => (
    <TextRow key={key} label={label} placeholder={placeholder} value={config[key] ?? ''} onChange={value => set(key, value)} {...extra} />
  )

  return (
    <>
      <PageHeader title="Site settings" subtitle={dirty ? 'You have unsaved changes.' : undefined}>
        <Button tone="primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
      </PageHeader>
      <LoadState loading={loading} error={error} />

      {!loading && !error && (
        <>
          <div className="md:grid md:grid-cols-2 md:gap-x-6">
            <Group label="Couple">
              {text('partner1', 'Partner 1', 'Luis')}
              {text('partner2', 'Partner 2', 'Bee')}
            </Group>
            <Group label="Date and times" footnote="The RSVP deadline is enforced: after that day guests can view their answer but not change it.">
              {text('weddingDate', 'Date (YYYY-MM-DD)', '2027-02-27')}
              {text('ceremonyTime', 'Ceremony time', '3:00 PM')}
              {text('receptionTime', 'Reception time', '6:00 PM')}
              {text('rsvpDeadline', 'RSVP deadline', 'January 27, 2027')}
            </Group>
            <Group label="Venue">
              {text('ceremonyVenue', 'Ceremony venue', 'TBA')}
              {text('location', 'City or location', 'TBA')}
              {text('receptionVenue', 'Reception venue', 'TBA')}
            </Group>
            <Group label="Hotel">
              {text('hotelName', 'Hotel name', 'TBA')}
              {text('hotelCode', 'Promo code')}
              {text('hotelDiscount', 'Discount', '20%')}
            </Group>
          </div>

          <Group label="Opening video" footnote="Upload the video to Cloudinary, then paste its address here. Leave it empty for a still background.">
            {text('heroVideoUrl', 'Video address', 'https://res.cloudinary.com/…')}
          </Group>

          <Group label="Notes for guests">
            {text('dressCode', 'Dress code', 'Garden formal')}
            {text('guestNotes', 'Special notes', 'Any special instructions', { rows: 3 })}
          </Group>

          <PresentationGroups config={config} setConfig={setConfig} />
          <BackgroundsGroup config={config} set={set} />
          <HeadingsGroup config={config} set={set} />
        </>
      )}
    </>
  )
}
