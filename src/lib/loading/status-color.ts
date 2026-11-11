/**
 * The colour the phone's status bar area should take, so it blends with
 * whatever section is at the top of the screen instead of one fixed colour.
 */
export const STATUS_COLORS = {
  cream: '#FDFAF6',
  /** The opening video under its dark overlay. */
  hero: '#2A394A',
  /** The night-sky countdown scene. */
  night: '#101B2C',
} as const

/** Sections whose top is an image, video or canvas, where no background colour can be read. */
export const STATUS_RULES: readonly { selector: string; color: string }[] = [
  { selector: '.site-preloader', color: STATUS_COLORS.cream },
  { selector: '#home', color: STATUS_COLORS.hero },
  { selector: '#countdown', color: STATUS_COLORS.night },
]

export const STATUS_EVENT = 'site:status-color'

/** True for a fully opaque CSS colour such as "rgb(46, 31, 26)" or "rgba(46, 31, 26, 1)". */
export function isOpaqueColor(value: string): boolean {
  const match = /^rgba?\(([^)]+)\)$/.exec(value.trim())
  if (!match) return false
  const parts = match[1].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return false
  return parts.length === 3 || Number(parts[3]) === 1
}

/** Minimal shape of an element, so the choice can be tested without a browser. */
export interface ColorProbe {
  matches(selector: string): boolean
  background: string
  parent: ColorProbe | null
}

/**
 * Walks up from the element at the top of the screen: an explicit rule wins,
 * otherwise the first solid background colour found, otherwise cream.
 */
export function statusColorFor(element: ColorProbe | null): string {
  for (let node = element; node; node = node.parent) {
    const rule = STATUS_RULES.find(candidate => node.matches(candidate.selector))
    if (rule) return rule.color
    if (isOpaqueColor(node.background)) return node.background
  }
  return STATUS_COLORS.cream
}
