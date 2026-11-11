'use client'

import type { WeddingConfig } from '@/lib/schema'
import type { AdminConfig } from '@/app/admin/_lib/useAdminConfig'
import { Group, Row, inputClass, labelClass } from '@/app/admin/_ui/primitives'

const SECTIONS = [
  { key: 'story', label: 'Story' },
  { key: 'countdown', label: 'Countdown' },
  { key: 'details', label: 'Details' },
  { key: 'faq', label: 'FAQ' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'rsvp', label: 'RSVP' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']
type Part = 'eyebrow' | 'heading' | 'italic'
type Headings = Record<SectionKey, Record<Part, string>>

const PARTS: readonly { key: Part; label: string }[] = [
  { key: 'eyebrow', label: 'Small line above' },
  { key: 'heading', label: 'Heading' },
  { key: 'italic', label: 'Italic ending' },
]

const DEFAULTS: Headings = {
  story: { eyebrow: 'Luis & Bee', heading: 'A story worth', italic: 'telling' },
  countdown: { eyebrow: 'Counting down', heading: 'Until we say', italic: 'forever' },
  details: { eyebrow: 'Event Details', heading: 'Mark your', italic: 'calendar' },
  gallery: { eyebrow: 'Luis & Bee', heading: 'Moments we', italic: 'cherish' },
  faq: { eyebrow: 'Questions?', heading: 'Everything you', italic: 'need to know' },
  rsvp: { eyebrow: "You're invited", heading: 'Will you', italic: 'join us?' },
}

/** Saved headings are merged over the defaults, so a section added later still has text. */
function parseHeadings(raw: string | null | undefined): Headings {
  if (!raw) return DEFAULTS
  try {
    const saved = JSON.parse(raw) as Partial<Headings>
    return {
      story: { ...DEFAULTS.story, ...saved.story },
      countdown: { ...DEFAULTS.countdown, ...saved.countdown },
      details: { ...DEFAULTS.details, ...saved.details },
      gallery: { ...DEFAULTS.gallery, ...saved.gallery },
      faq: { ...DEFAULTS.faq, ...saved.faq },
      rsvp: { ...DEFAULTS.rsvp, ...saved.rsvp },
    }
  } catch {
    return DEFAULTS
  }
}

interface HeadingsGroupProps {
  config: AdminConfig
  set: <K extends keyof WeddingConfig>(key: K, value: WeddingConfig[K]) => void
}

export function HeadingsGroup({ config, set }: HeadingsGroupProps) {
  const headings = parseHeadings(config.sectionHeadings)
  const update = (section: SectionKey, part: Part, value: string) =>
    set('sectionHeadings', JSON.stringify({ ...headings, [section]: { ...headings[section], [part]: value } }))

  return (
    <Group label="Section headings" footnote="Each section title has a small line above it, a heading, and an italic ending.">
      {SECTIONS.map(({ key, label }) => (
        <Row key={key}>
          <p className="mb-2 text-[16px] text-black/85">{label}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PARTS.map(part => (
              <label key={part.key} className="block">
                <span className={labelClass}>{part.label}</span>
                <input className={inputClass} value={headings[key][part.key]} onChange={event => update(key, part.key, event.target.value)} />
              </label>
            ))}
          </div>
        </Row>
      ))}
    </Group>
  )
}
