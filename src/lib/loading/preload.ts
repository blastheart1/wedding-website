import { runLimited } from './run-limited'
import { BACKGROUND_ASSETS, EXTRA_STEPS, GATE_ASSETS, type SiteAsset } from './assets'

/** Each step resolves whether it succeeded or not: a missing file must never trap a guest. */
type Step = { weight: number; run: () => Promise<unknown> }

function loadImage(url: string): Promise<void> {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

/** Downloads into the browser cache so the 3D loader finds it there later. */
function loadData(url: string): Promise<void> {
  return fetch(url, { cache: 'force-cache' }).then(response => response.arrayBuffer()).then(() => undefined, () => undefined)
}

function loadFonts(): Promise<void> {
  if (!document.fonts) return Promise.resolve()
  return Promise.all(FRONT_FACES.map(face => document.fonts.load(face).catch(() => undefined))).then(() => undefined)
}

/** The faces the first screen is written in. The rest load as they are needed, with the fallback font showing meanwhile. */
const FRONT_FACES = ['400 1em "Cormorant Garamond"', 'italic 400 1em "Cormorant Garamond"', '400 1em Jost']
const OTHER_FACES = ['500 1em "Cormorant Garamond"', '500 1em Jost', '400 1em Lora']

function loadOtherFonts(): Promise<void> {
  if (!document.fonts) return Promise.resolve()
  return Promise.all(OTHER_FACES.map(face => document.fonts.load(face).catch(() => undefined))).then(() => undefined)
}

/** How long to wait for the 3D scenes to finish preparing before letting the guest in anyway. */
const WORLD_WAIT_MS = 8000

/**
 * Resolves when the 3D engine has compiled and drawn each scene once, when it
 * reports that 3D is unavailable on this device, or after a time limit.
 */
function worldPrepared(): Promise<void> {
  if (document.documentElement.dataset.worldReady === 'true' || document.querySelector('[data-wedding-scene]') === null) return Promise.resolve()
  return new Promise(resolve => {
    const done = () => {
      window.removeEventListener('wedding-world-ready', done)
      window.removeEventListener('wedding-world-unavailable', done)
      window.clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(done, WORLD_WAIT_MS)
    window.addEventListener('wedding-world-ready', done)
    window.addEventListener('wedding-world-unavailable', done)
  })
}

const assetStep = (asset: SiteAsset): Step => ({
  weight: asset.weight,
  run: () => (asset.kind === 'image' ? loadImage(asset.url) : loadData(asset.url)),
})

/**
 * The welcome's gate: only the opening picture and the typefaces of the first
 * screen. Reports the finished weight after each step. Every step resolves,
 * success or not, so a missing file can never trap a guest.
 */
export function preloadSite(onProgress: (doneWeight: number) => void): Promise<void> {
  const steps: Step[] = [...GATE_ASSETS.map(assetStep), { weight: EXTRA_STEPS.fonts, run: loadFonts }]
  let done = 0
  return Promise.all(steps.map(step =>
    step.run().catch(() => undefined).then(() => {
      done += step.weight
      onProgress(done)
    }),
  )).then(() => undefined)
}

const WARM_CONCURRENCY = 2

/**
 * Everything else, started once the doors open and never waited for: the 3D
 * engine first (the scenes are the next thing a guest scrolls to), then the
 * pictures and the model in scroll order, then the remaining typefaces.
 * `loadEngine` is the page's own import, so the engine is downloaded once.
 */
let warming: Promise<void> | null = null

export function warmSite(loadEngine: () => Promise<unknown>): Promise<void> {
  if (warming) return warming
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return Promise.resolve()
  const tasks: (() => Promise<unknown>)[] = [
    () => loadEngine().then(worldPrepared, () => undefined),
    ...BACKGROUND_ASSETS.map(asset => () => assetStep(asset).run()),
    loadOtherFonts,
  ]
  warming = runLimited(tasks, WARM_CONCURRENCY, task => task())
  return warming
}
