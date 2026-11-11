/**
 * Everything the site needs before a guest starts scrolling, with a rough
 * weight (kilobytes) so the progress line moves in proportion to real work.
 * Keep in step with public/wedding: a test checks every file exists.
 */
export type AssetKind = 'image' | 'data'

export interface SiteAsset {
  url: string
  kind: AssetKind
  weight: number
}

export const SITE_ASSETS: readonly SiteAsset[] = [
  { url: '/wedding/scene-1.jpg', kind: 'image', weight: 150 },
  { url: '/wedding/scene-2.jpg', kind: 'image', weight: 280 },
  { url: '/wedding/scene-3.jpg', kind: 'image', weight: 420 },
  { url: '/wedding/church-1.jpg', kind: 'image', weight: 680 },
  { url: '/wedding/church-2.jpg', kind: 'image', weight: 620 },
  { url: '/wedding/church-3.jpg', kind: 'image', weight: 450 },
  { url: '/wedding/dress-warning-1.png', kind: 'image', weight: 30 },
  { url: '/wedding/moon-color-nasa.jpg', kind: 'image', weight: 460 },
  { url: '/wedding/moon-height-nasa.jpg', kind: 'image', weight: 110 },
  { url: '/wedding/wedding-couple-storyboard.glb', kind: 'data', weight: 3730 },
]

/** Steps that are not plain files: the typefaces, the 3D engine code and the opening video. */
export const EXTRA_STEPS = { fonts: 1200, engine: 700, video: 900 } as const

export const TOTAL_WEIGHT =
  SITE_ASSETS.reduce((sum, asset) => sum + asset.weight, 0) + EXTRA_STEPS.fonts + EXTRA_STEPS.engine + EXTRA_STEPS.video

/** Share of the work finished, from 0 to 1. Never goes backwards and never exceeds 1. */
export function progressOf(doneWeight: number): number {
  if (!Number.isFinite(doneWeight) || doneWeight <= 0) return 0
  return Math.min(1, doneWeight / TOTAL_WEIGHT)
}

/** A short line for each stage of getting ready, in the order a wedding day unfolds. */
export const STAGES: readonly { from: number; label: string }[] = [
  { from: 0, label: 'Gathering the flowers' },
  { from: 0.3, label: 'Lighting the candles' },
  { from: 0.6, label: 'Setting the table' },
  { from: 0.9, label: 'Opening the doors' },
]

export function stageLabel(progress: number): string {
  let label = STAGES[0].label
  for (const stage of STAGES) if (progress >= stage.from) label = stage.label
  return label
}

export const VISITED_COOKIE = 'lb_visited'
const VISITED_DAYS = 180

/** The cookie that lets a returning guest skip the opening pause. Holds no personal data. */
export function visitedCookie(secure: boolean): string {
  return `${VISITED_COOKIE}=1; Max-Age=${VISITED_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`
}

export const TIMING = {
  /** First visit: keep the welcome on screen at least this long so it never flashes. */
  minFirstVisitMs: 1400,
  /** Offer "Enter now" after this long, for slow connections. */
  offerSkipAfterMs: 6000,
  /** Never hold a guest longer than this, whatever is still loading. */
  hardCapMs: 20000,
  /** Length of the doors opening. */
  exitMs: 1100,
} as const
