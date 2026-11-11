'use client'

import { parseSitePresentation, type SitePresentation } from '@/lib/presentation'
import type { AdminConfig } from '@/app/admin/_lib/useAdminConfig'
import { Button, Group, Row } from '@/app/admin/_ui/primitives'
import { ImageRow, TextRow, ToggleRow } from '@/app/admin/_ui/forms'

type TextKey = Exclude<keyof SitePresentation, 'ceremonyImages' | 'showGames' | 'shareImageUrl'>

const MAX_PHOTOS = 12

interface PresentationGroupsProps {
  config: AdminConfig
  setConfig: (update: (current: AdminConfig) => AdminConfig) => void
}

/** Ceremony, dress code, footer and games settings, stored together as one validated block. */
export function PresentationGroups({ config, setConfig }: PresentationGroupsProps) {
  const presentation = parseSitePresentation(config.sitePresentation)
  const update = (patch: Partial<SitePresentation>) =>
    setConfig(current => ({ ...current, sitePresentation: JSON.stringify({ ...parseSitePresentation(current.sitePresentation), ...patch }) }))

  const text = (key: TextKey, label: string, rows = 1) => (
    <TextRow key={key} label={label} rows={rows} value={presentation[key]} onChange={value => update({ [key]: value })} />
  )
  const setPhoto = (index: number, field: 'src' | 'alt' | 'label', value: string) =>
    update({ ceremonyImages: presentation.ceremonyImages.map((photo, position) => (position === index ? { ...photo, [field]: value } : photo)) })

  return (
    <>
      <Group label="Ceremony" footnote="Empty fields hide that piece of content on the site.">
        {text('ceremonyAlias', 'Church short name')}
        {text('ceremonyAddress', 'Ceremony address', 3)}
        {text('ceremonyMapUrl', 'Directions address (https)')}
        {text('ceremonyMapEmbedUrl', 'Google Maps embed address')}
        {text('receptionNote', 'Reception note', 2)}
      </Group>

      <Group label="Dress code">
        {text('dressDescription', 'Description', 3)}
        {text('dressRestrictions', 'Restrictions', 3)}
      </Group>

      <Group label="Footer">
        {text('footerContactEmail', 'Contact email')}
        {text('footerContactUrl', 'Website address (https)')}
      </Group>

      <Group label="Link preview" footnote="What Messenger, Facebook, Instagram and other apps show when the site address is shared. Leave everything empty to use your names and date on the wedding card. Apps keep old previews for a while, so a change can take time to appear.">
        <ImageRow label="Picture" hint="A wide photo works best; it is cropped to 1200 by 630." url={presentation.shareImageUrl} folder="wedding/preview" onChange={shareImageUrl => update({ shareImageUrl })} />
        {text('shareTitle', 'Title (optional)')}
        {text('shareDescription', 'Description (optional)', 2)}
      </Group>

      <Group label="Games">
        <ToggleRow label="Show the games section" hint="Couple Quiz and Catch the Bouquet, near the end of the site." checked={presentation.showGames} onChange={showGames => update({ showGames })} />
      </Group>

      {presentation.ceremonyImages.map((photo, index) => (
        <Group key={index} label={`Ceremony photo ${index + 1}`}>
          <TextRow label="Image address or local path" value={photo.src} onChange={value => setPhoto(index, 'src', value)} />
          <TextRow label="Description, for screen readers" value={photo.alt} onChange={value => setPhoto(index, 'alt', value)} />
          <TextRow label="Thumbnail label" value={photo.label} onChange={value => setPhoto(index, 'label', value)} />
          <Row><Button tone="danger" onClick={() => update({ ceremonyImages: presentation.ceremonyImages.filter((_photo, position) => position !== index) })}>Remove photo</Button></Row>
        </Group>
      ))}
      {presentation.ceremonyImages.length < MAX_PHOTOS && (
        <div className="mt-4">
          <Button onClick={() => update({ ceremonyImages: [...presentation.ceremonyImages, { src: '/wedding/church-1.jpg', alt: '', label: 'Church photo' }] })}>Add ceremony photo</Button>
        </div>
      )}
    </>
  )
}
