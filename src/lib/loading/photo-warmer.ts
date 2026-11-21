import { closestToView } from './nearest'

/**
 * Makes sure a photo is already in the browser by the time a guest scrolls to it.
 *
 * Browsers hold lazy photos back until they are close to the screen, which is the
 * right default for a slow page and the wrong one for a fast scroll. Once the
 * doors have opened this brings every lazy photo forward, a few at a time, always
 * the one nearest below the screen next, so a guest who scrolls fast is never
 * left with the far end of the page loading while the near end is still empty. It works on the real <img> elements, so it fetches exactly
 * the size the page would have chosen, and covers photos that come from the
 * database as well as the ones in the code.
 */

/** Marks a photo that is not in yet, so the page can show a soft tint instead of a hole. */
export const PENDING_ATTRIBUTE = 'data-photo-pending'
/** Set on the page, and announced, once every photo that was waiting has arrived. The 3D engine starts then. */
export const PHOTOS_SETTLED_EVENT = 'wedding-photos-settled'
const CONCURRENCY = 3
const GIVE_UP_MS = 20000
/** How far ahead of the screen (in screens) a photo is pulled in at once. */
export const LOOK_AHEAD_SCREENS = 3

type LazyPhoto = HTMLImageElement

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
async function bringForward(photo: LazyPhoto): Promise<void> {
  if (photo.loading !== 'eager') photo.loading = 'eager'
  await settled(photo)
  try { await photo.decode() } catch { /* a broken photo keeps its tint, nothing else to do */ }
  photo.removeAttribute(PENDING_ATTRIBUTE)
}

/** Starts warming. Safe to call again: the page is only watched once. Returns a function that stops it. */
export function startPhotoWarmer(): () => void {
  if (typeof window === 'undefined' || document.documentElement.dataset.photosWarming === 'true') return () => undefined
  document.documentElement.dataset.photosWarming = 'true'
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) { announceSettled(); return () => undefined }

  const queued = new Set<LazyPhoto>()
  const waiting = new Set<LazyPhoto>()
  let active = 0
  let inFlight = 0
  let stopped = false
  const checkSettled = () => { if (!stopped && waiting.size === 0 && active === 0 && inFlight === 0) announceSettled() }
  const fetchPhoto = async (photo: LazyPhoto) => {
    inFlight++
    try { await bringForward(photo) } finally { inFlight--; checkSettled() }
  }

  const rangeOf = (photo: LazyPhoto) => {
    const box = photo.getBoundingClientRect()
    return { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY }
  }

  // Each worker takes whichever waiting photo is nearest the screen right now, so the order follows the guest.
  const work = async () => {
    active++
    try {
      while (!stopped) {
        const photo = closestToView(waiting, rangeOf, window.scrollY, window.innerHeight)
        if (!photo) return
        waiting.delete(photo)
        if (isPending(photo)) await fetchPhoto(photo)
      }
    } finally {
      active--
    }
  }
  const kick = () => { while (active < CONCURRENCY && waiting.size > 0 && !stopped) void work() }

  // A photo that comes within a few screens is taken at once, past the queue.
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
      near.observe(photo)
    }
    kick()
    checkSettled()
  }

  enqueue()
  // Photos that appear later (a section that mounts as it is reached, a lightbox) join the queue too.
  let pending = 0
  const watcher = new MutationObserver(() => {
    window.clearTimeout(pending)
    pending = window.setTimeout(enqueue, 150)
  })
  watcher.observe(document.body, { childList: true, subtree: true })

  return () => {
    stopped = true
    near.disconnect()
    watcher.disconnect()
    window.clearTimeout(pending)
    delete document.documentElement.dataset.photosWarming
    delete document.documentElement.dataset.photosSettled
  }
}
