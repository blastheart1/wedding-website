import { EXTRA_STEPS, SITE_ASSETS, type SiteAsset } from './assets'

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
  const faces = ['400 1em "Cormorant Garamond"', 'italic 400 1em "Cormorant Garamond"', '500 1em "Cormorant Garamond"', '400 1em Jost', '500 1em Jost', '400 1em Lora']
  return Promise.all(faces.map(face => document.fonts.load(face).catch(() => undefined))).then(() => undefined)
}

/** Resolves once the opening video can start playing, or straight away if there is none. */
function videoReady(): Promise<void> {
  const video = document.querySelector<HTMLVideoElement>('#home video')
  if (!video || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve()
  return new Promise(resolve => {
    const done = () => resolve()
    video.addEventListener('canplay', done, { once: true })
    video.addEventListener('error', done, { once: true })
    video.addEventListener('stalled', done, { once: true })
  })
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
 * Loads everything, reporting the finished weight after each step.
 * `loadEngine` is passed in so the 3D code is fetched through the same
 * import the page uses, and is therefore downloaded only once.
 */
export function preloadSite(loadEngine: () => Promise<unknown>, onProgress: (doneWeight: number) => void): Promise<void> {
  const steps: Step[] = [
    ...SITE_ASSETS.map(assetStep),
    { weight: EXTRA_STEPS.fonts, run: loadFonts },
    { weight: EXTRA_STEPS.engine, run: () => loadEngine().then(worldPrepared, () => undefined) },
    { weight: EXTRA_STEPS.video, run: videoReady },
  ]
  let done = 0
  return Promise.all(steps.map(step =>
    step.run().catch(() => undefined).then(() => {
      done += step.weight
      onProgress(done)
    }),
  )).then(() => undefined)
}
