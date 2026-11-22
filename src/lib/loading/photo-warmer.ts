import { closestToView, distanceFromView, isUrgent, predictedViewTop, smoothedVelocity } from './nearest'
import { previewUrl } from './previews'

/**
 * Makes sure a photo is already in the browser by the time a guest scrolls to it.
 *
 * Browsers hold lazy photos back until they are close to the screen, which is the
 * right default for a slow page and the wrong one for a fast scroll. This brings
 * every lazy photo forward a few at a time, always the one nearest where the guest
 * is heading next (it looks further ahead the faster they scroll), and gives the
 * nearest ones a high network priority. Until a photo arrives it shows a tiny
 * blurred copy of itself. It works on the real <img> elements, so it fetches
 * exactly the size the page would have chosen, and covers photos that come from
 * the database as well as the ones in the code.
 */

/** Marks a photo that is not in yet, so the page can show its preview instead of a hole. */
export const PENDING_ATTRIBUTE = 'data-photo-pending'
/** The CSS variable that holds a photo's tiny preview while it is pending. */
export const PREVIEW_VARIABLE = '--photo-preview'
/** Set on the page, and announced, once every photo that was waiting has arrived. */
export const PHOTOS_SETTLED_EVENT = 'wedding-photos-settled'
const CONCURRENCY = 4
const GIVE_UP_MS = 20000
/** Photos within this many screens are taken at once, past the queue. */
export const LOOK_AHEAD_SCREENS = 1

type LazyPhoto = HTMLImageElement

export interface PhotoWarmer {
  /** Resolves once the `count` photos nearest the top have arrived (or all of them, if fewer). */
  firstSettled: (count: number) => Promise<void>
  stop: () => void
}

const isPending = (photo: LazyPhoto): boolean => photo.hasAttribute(PENDING_ATTRIBUTE)

/** Resolves when the photo has loaded or failed, or after a time limit, whichever is first. */
function settled(photo: LazyPhoto): Promise<void> {
  return new Promise(resolve => {
    if (photo.complete && photo.naturalWidth > 0) return resolve()
    const finish = () => {
      window.clearTimeout(timer)
      photo.removeEventListener('load', finish)
      photo.removeEventListener('error', finish)
      resolve()
    }
    const timer = window.setTimeout(finish, GIVE_UP_MS)
    photo.addEventListener('load', finish, { once: true })
    photo.addEventListener('error', finish, { once: true })
  })
}

/** Runs once the photos are in (straight away if they already are). Returns a function that cancels. */
export function afterPhotosSettled(run: () => void): () => void {
  if (document.documentElement.dataset.photosSettled === 'true') { run(); return () => undefined }
  window.addEventListener(PHOTOS_SETTLED_EVENT, run, { once: true })
  return () => window.removeEventListener(PHOTOS_SETTLED_EVENT, run)
}

function announceSettled(): void {
  if (document.documentElement.dataset.photosSettled === 'true') return
  document.documentElement.dataset.photosSettled = 'true'
  window.dispatchEvent(new Event(PHOTOS_SETTLED_EVENT))
}

/** Brings one photo forward and decodes it, so it paints with no delay when it arrives. */
async function bringForward(photo: LazyPhoto, urgent: boolean): Promise<void> {
  photo.fetchPriority = urgent ? 'high' : 'low'
  if (photo.loading !== 'eager') photo.loading = 'eager'
  await settled(photo)
  try { await photo.decode() } catch { /* a broken photo keeps its preview, nothing else to do */ }
  photo.removeAttribute(PENDING_ATTRIBUTE)
  photo.style.removeProperty(PREVIEW_VARIABLE)
}

const noopWarmer: PhotoWarmer = { firstSettled: () => Promise.resolve(), stop: () => undefined }
let current: PhotoWarmer | null = null

/** Starts warming. Safe to call again: the page is only watched once and the same handle is returned. */
export function startPhotoWarmer(): PhotoWarmer {
  if (typeof window === 'undefined') return noopWarmer
  if (current) return current
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) { announceSettled(); current = noopWarmer; return current }

  const queued = new Set<LazyPhoto>()
  const waiting = new Set<LazyPhoto>()
  const firstWaiters: { count: number; resolve: () => void }[] = []
  let active = 0
  let inFlight = 0
  let arrived = 0
  let stopped = false

  const releaseWaiters = () => {
    for (const waiter of [...firstWaiters]) {
      if (arrived >= Math.min(waiter.count, queued.size)) { waiter.resolve(); firstWaiters.splice(firstWaiters.indexOf(waiter), 1) }
    }
  }
  const checkSettled = () => { if (!stopped && waiting.size === 0 && active === 0 && inFlight === 0) announceSettled() }

  // How fast and which way the guest is scrolling, so the queue can look ahead of them.
  let velocity = 0
  let lastY = window.scrollY
  let lastAt = performance.now()
  const onScroll = () => {
    const now = performance.now()
    velocity = smoothedVelocity(velocity, window.scrollY - lastY, now - lastAt, 0)
    lastY = window.scrollY
    lastAt = now
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  const view = () => {
    const speed = performance.now() - lastAt > 150 ? 0 : velocity
    return { top: predictedViewTop(window.scrollY, speed), direction: (speed < 0 ? -1 : 1) as 1 | -1 }
  }

  const rangeOf = (photo: LazyPhoto) => {
    const box = photo.getBoundingClientRect()
    return { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY }
  }

  const fetchPhoto = async (photo: LazyPhoto) => {
    inFlight++
    const ahead = view()
    const { top, bottom } = rangeOf(photo)
    try { await bringForward(photo, isUrgent(distanceFromView(top, bottom, ahead.top, window.innerHeight, ahead.direction), window.innerHeight)) }
    finally { inFlight--; arrived++; releaseWaiters(); checkSettled() }
  }

  // Each worker takes whichever waiting photo is nearest where the guest is heading, so the order follows them.
  const work = async () => {
    active++
    try {
      while (!stopped) {
        const ahead = view()
        const photo = closestToView(waiting, rangeOf, ahead.top, window.innerHeight, ahead.direction)
        if (!photo) return
        waiting.delete(photo)
        if (isPending(photo)) await fetchPhoto(photo)
      }
    } finally {
      active--
    }
  }
  const kick = () => { while (active < CONCURRENCY && waiting.size > 0 && !stopped) void work() }

  // A photo that comes within a screen is taken at once, past the queue.
  const near = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      near.unobserve(entry.target)
      const photo = entry.target as LazyPhoto
      waiting.delete(photo)
      if (isPending(photo)) void fetchPhoto(photo)
    }
  }, { rootMargin: `${LOOK_AHEAD_SCREENS * 100}% 0px` })

  const enqueue = () => {
    for (const photo of Array.from(document.querySelectorAll<LazyPhoto>('img[loading="lazy"]'))) {
      if (queued.has(photo)) continue
      queued.add(photo)
      waiting.add(photo)
      photo.setAttribute(PENDING_ATTRIBUTE, '')
      const preview = previewUrl(photo.getAttribute('src') ?? '')
      if (preview) photo.style.setProperty(PREVIEW_VARIABLE, `url("${preview}")`)
      near.observe(photo)
    }
    kick()
    checkSettled()
    releaseWaiters()
  }

  enqueue()
  // Photos that appear later (a section that mounts as it is reached, a lightbox) join the queue too.
  let pending = 0
  const watcher = new MutationObserver(() => {
    window.clearTimeout(pending)
    pending = window.setTimeout(enqueue, 150)
  })
  watcher.observe(document.body, { childList: true, subtree: true })

  current = {
    firstSettled: count => new Promise(resolve => { firstWaiters.push({ count, resolve }); releaseWaiters() }),
    stop: () => {
      stopped = true
      near.disconnect()
      watcher.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(pending)
      firstWaiters.splice(0).forEach(waiter => waiter.resolve())
      current = null
    },
  }
  return current
}
