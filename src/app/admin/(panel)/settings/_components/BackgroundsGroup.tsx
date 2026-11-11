'use client'

import type { WeddingConfig } from '@/lib/schema'
import type { AdminConfig } from '@/app/admin/_lib/useAdminConfig'
import { Group } from '@/app/admin/_ui/primitives'
import { ImageRow } from '@/app/admin/_ui/forms'

type BackgroundKey = Extract<keyof WeddingConfig, 'heroBgUrl' | 'storyBgUrl' | 'countdownBgUrl' | 'detailsBgUrl' | 'galleryBgUrl' | 'faqBgUrl'>

const BACKGROUNDS: readonly { key: BackgroundKey; label: string; hint: string }[] = [
  { key: 'heroBgUrl', label: 'Hero', hint: 'Used when no video is set' },
  { key: 'storyBgUrl', label: 'Story', hint: 'Behind the story section' },
  { key: 'countdownBgUrl', label: 'Countdown', hint: 'Behind the countdown numbers' },
  { key: 'detailsBgUrl', label: 'Details', hint: 'Event details section' },
  { key: 'galleryBgUrl', label: 'Gallery', hint: 'Behind the photos' },
  { key: 'faqBgUrl', label: 'FAQ', hint: 'Behind the questions' },
]

interface BackgroundsGroupProps {
  config: AdminConfig
  set: <K extends keyof WeddingConfig>(key: K, value: WeddingConfig[K]) => void
}

export function BackgroundsGroup({ config, set }: BackgroundsGroupProps) {
  return (
    <Group label="Section backgrounds" footnote="Leave a section without a picture to use its default colour. Uploads apply when you save.">
      {BACKGROUNDS.map(({ key, label, hint }) => (
        <ImageRow key={key} label={label} hint={hint} url={config[key] ?? ''} folder="wedding/backgrounds" onChange={url => set(key, url)} />
      ))}
    </Group>
  )
}
