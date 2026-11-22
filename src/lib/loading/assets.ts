/**
 * Every site picture and model, with a rough weight (kilobytes). Only the gate list
 * holds the welcome; the rest is warmed in the background after the doors open.
 * Keep in step with public/wedding: a test checks every file exists.
 */
export type AssetKind = 'image' | 'data'

export interface SiteAsset {
  url: string
  kind: AssetKind
  weight: number
}

/** What the first screen needs: the opening picture. Nothing else holds the welcome back. */
export const GATE_ASSETS: readonly SiteAsset[] = [
  { url: '/wedding/scene-1.jpg', kind: 'image', weight: 150 },
]

/**
 * Only files the page uses as they are (the 3D textures and model, the small symbol). Photos that
 * pass through the image optimizer are warmed from the page itself, by size (see photo-warmer.ts),
 * because fetching the original here would download a second, larger copy nobody shows.
 */
export const BACKGROUND_ASSETS: readonly SiteAsset[] = [
  { url: '/wedding/dress-warning-1.png', kind: 'image', weight: 30 },
  { url: '/wedding/moon-color-nasa.jpg', kind: 'image', weight: 460 },
  { url: '/wedding/moon-height-nasa.jpg', kind: 'image', weight: 110 },
  { url: '/wedding/wedding-couple-storyboard.min.glb', kind: 'data', weight: 1310 },
]

/** Kept only as a fallback for a compressed copy. Never warmed: it is three times the size. */
export const FALLBACK_ASSETS: readonly string[] = ['/wedding/wedding-couple-storyboard.glb']

/** Photos shown through the image optimizer. The page warms them itself, at the size it shows (photo-warmer.ts). */
export const OPTIMISED_ASSETS: readonly string[] = [
  '/wedding/scene-2.jpg', '/wedding/scene-3.jpg', '/wedding/church-1.jpg', '/wedding/church-2.jpg', '/wedding/church-3.jpg',
]

export const SITE_ASSETS: readonly SiteAsset[] = [...GATE_ASSETS, ...BACKGROUND_ASSETS]

/**
 * The steps in front of the doors that are not plain files: the typefaces used above the fold, the 3D
 * scenes (engine, model and textures, drawn once so nothing is compiled mid-scroll), and the first photos.
 */
export const EXTRA_STEPS = { fonts: 1200, engine: 2300, photos: 600 } as const

/** How many photos, counted from the top of the page, the welcome waits for. */
export const FIRST_PHOTOS = 6

export const TOTAL_WEIGHT = GATE_ASSETS.reduce((sum, asset) => sum + asset.weight, 0) + EXTRA_STEPS.fonts + EXTRA_STEPS.engine + EXTRA_STEPS.photos

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
  offerSkipAfterMs: 2500,
  /** Never hold a guest longer than this, whatever is still loading. Slow phones are let in at this point, whatever is still arriving. */
  hardCapMs: 6000,
  /** Even if the limit has already passed when the script wakes (a very slow device), keep the welcome at least this long. */
  capFloorMs: 800,
  /** Length of the doors opening. */
  exitMs: 1100,
} as const
