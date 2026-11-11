import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { RECIPE } from '@/lib/espresso'
import type { EspressoScene } from '@/world/coffee/espresso-scene'

export interface EspressoPlayer {
  /** The models are downloaded and the first frame is on screen. */
  ready: boolean
  unavailable: boolean
  /** Holds the scene still at a moment of the story. */
  show(time: number): void
  /** Plays the story between two moments. Resolves true when it reaches the end, false if it was cut short. */
  run(from: number, to: number): Promise<boolean>
  /** Sets what the shot being pulled will end at, in grams. */
  setShot(grams: number): void
}

interface Clip {
  from: number
  to: number
  started: number
  finish(completed: boolean): void
}

const reducedMotion = () =>
  document.documentElement.dataset.siteMotion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Runs the espresso scene on a canvas while `mounted`. The scene only draws
 * when something changes: while a clip plays, or once after a still is set.
 * `onFrame` is called with the moment and the shot's grams for every frame drawn.
 */
export function useEspressoPlayer(canvas: RefObject<HTMLCanvasElement>, mounted: boolean, onFrame: (time: number, shotGrams: number) => void): EspressoPlayer {
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const frameListener = useRef(onFrame)
  frameListener.current = onFrame
  const state = useRef({ still: 0, grams: RECIPE.yieldGrams as number, clip: null as Clip | null, wake: () => undefined as void })

  useEffect(() => {
    const target = canvas.current
    if (!mounted || !target) return
    const player = state.current
    let scene: EspressoScene | null = null
    let frame = 0
    let disposed = false
    let hiddenAt = 0

    const loop = (now: number) => {
      frame = 0
      if (!scene) return
      const clip = player.clip
      const time = clip ? Math.min(clip.to, clip.from + (now - clip.started) / 1000) : player.still
      scene.setTime(time, player.grams)
      scene.render()
      frameListener.current(time, player.grams)
      if (!clip) return
      if (time >= clip.to) {
        player.still = clip.to
        player.clip = null
        clip.finish(true)
      } else if (!document.hidden) frame = requestAnimationFrame(loop)
    }
    const wake = () => { if (!frame && !disposed) frame = requestAnimationFrame(loop) }
    player.wake = wake
    const resize = () => {
      if (!scene) return
      const box = target.getBoundingClientRect()
      scene.resize(Math.max(1, box.width), Math.max(1, box.height))
      wake()
    }
    // Jump to a moment and hold it there: used to review single frames.
    const seek = (event: Event) => {
      player.clip?.finish(false)
      player.clip = null
      player.still = Number((event as CustomEvent<number>).detail) || 0
      wake()
    }
    // Coming back to the tab: carry on from where the story was, without a jump.
    const visibility = () => {
      if (document.hidden) { hiddenAt = performance.now(); return }
      if (hiddenAt && player.clip) player.clip.started += performance.now() - hiddenAt
      hiddenAt = 0
      wake()
    }

    import('@/world/coffee/espresso-scene')
      .then(({ createEspressoScene }) => createEspressoScene(target))
      .then(created => {
        if (disposed) { created.dispose(); return }
        scene = created
        // A clip asked for while the models were loading starts now, not part-way through.
        if (player.clip) player.clip.started = performance.now()
        resize()
        setReady(true)
      })
      .catch(() => { if (!disposed) setUnavailable(true) })

    const observer = new ResizeObserver(resize)
    observer.observe(target)
    window.addEventListener('espresso-seek', seek)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('espresso-seek', seek)
      document.removeEventListener('visibilitychange', visibility)
      player.clip?.finish(false)
      player.clip = null
      player.still = 0
      player.wake = () => undefined
      scene?.dispose()
      setReady(false)
    }
    // The refs are stable; the scene is rebuilt only when the sheet is mounted again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  const controls = useMemo(() => ({
    show(time: number) {
      const player = state.current
      player.clip?.finish(false)
      player.clip = null
      player.still = time
      player.wake()
    },
    run(from: number, to: number) {
      const player = state.current
      player.clip?.finish(false)
      player.clip = null
      // With reduced motion the story is shown as stills: each step jumps to its last frame.
      if (reducedMotion()) {
        player.still = to
        player.wake()
        return Promise.resolve(true)
      }
      return new Promise<boolean>(finish => {
        player.clip = { from, to, started: performance.now(), finish }
        player.wake()
      })
    },
    setShot(grams: number) {
      state.current.grams = grams
      state.current.wake()
    },
  }), [])

  return { ready, unavailable, ...controls }
}
