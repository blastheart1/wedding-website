/**
 * The timing of the footer's espresso easter egg. Pure numbers, so the recipe
 * (18 g in, 36 g out, 30 seconds) can be tested exactly.
 */
export const RECIPE = { doseGrams: 18, yieldGrams: 36, shotSeconds: 30 } as const

/** Seconds on screen that the 30-second shot takes. The shot clock still counts to 0:30. */
export const SHOT_PLAY = 6

/** Seconds from the start of the animation. */
export const TIMELINE = {
  doseEnd: 1.6,
  shotStart: 3,
  shotEnd: 3 + SHOT_PLAY,
  artStart: 10.8,
  artEnd: 15.2,
  total: 16,
} as const

/** Seconds on the shot clock before the first drops fall: pre-infusion. */
export const FIRST_DROPS = 5

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
/** Eases in and out: slow start, steady middle, slow finish. */
export const smooth = (value: number) => { const x = clamp01(value); return x * x * (3 - 2 * x) }

/** Grams of coffee in the basket: grinds in over the first moments, then stays at the dose. */
export function doseAt(time: number): number {
  return RECIPE.doseGrams * smooth(time / (TIMELINE.doseEnd - 0.3))
}

/** The moment of the animation at which the shot clock shows this many seconds. */
export function shotTime(clockSeconds: number): number {
  return TIMELINE.shotStart + (clockSeconds / RECIPE.shotSeconds) * SHOT_PLAY
}

/** The shot clock: 0 before the pump starts, 30 once the shot is done. */
export function shotClock(time: number): number {
  return RECIPE.shotSeconds * clamp01((time - TIMELINE.shotStart) / SHOT_PLAY)
}

/**
 * Grams in the cup: nothing during pre-infusion, then rising to the shot's yield at 30 seconds.
 * `grams` is what this shot ends at: 36 for a dialled-in grind, more if it ran fast, less if it choked.
 */
export function yieldAt(time: number, grams: number = RECIPE.yieldGrams): number {
  const pouring = (shotClock(time) - FIRST_DROPS) / (RECIPE.shotSeconds - FIRST_DROPS)
  return grams * smooth(pouring)
}

/** How strongly the espresso is flowing: drips, a stream, then thinning out. 1 is a dialled-in shot at full flow. */
export function flowAt(time: number, grams: number = RECIPE.yieldGrams): number {
  const clock = shotClock(time)
  if (time < TIMELINE.shotStart || clock <= FIRST_DROPS || clock >= RECIPE.shotSeconds) return 0
  const shape = Math.min(smooth((clock - FIRST_DROPS) / 3.5), smooth((RECIPE.shotSeconds - clock) / 4))
  return shape * Math.min(1.6, grams / RECIPE.yieldGrams)
}

// ── The grind: the one thing the visitor controls ──

/** The grinder's collar: 0 is the finest setting, 1000 the coarsest. */
export const GRIND = { min: 0, max: 1000, start: 500 } as const
/** Ticks of coarser grind that double what ends up in the cup. */
const TICKS_TO_DOUBLE = 150
/** A shot never runs emptier or fuller than this, however far off the grind is. */
const YIELD_LIMITS = { min: 2, max: 90 } as const
/** Points lost for each 1.0 the brew ratio is away from 2. */
const POINTS_PER_RATIO = 50

export const clampGrind = (tick: number) => Math.min(GRIND.max, Math.max(GRIND.min, Math.round(tick)))

/** Picks the hidden sweet spot for a visit from a random number in 0..1: somewhere in the middle half of the collar. */
export function pickSweetSpot(random: number): number {
  return Math.round(250 + clamp01(random) * 500)
}

/** Grams in the cup after 30 seconds at this grind: coarser runs faster and fuller, finer chokes. */
export function yieldForGrind(tick: number, sweetSpot: number): number {
  const grams = RECIPE.yieldGrams * 2 ** ((clampGrind(tick) - sweetSpot) / TICKS_TO_DOUBLE)
  return Math.min(YIELD_LIMITS.max, Math.max(YIELD_LIMITS.min, grams))
}

/** Grams out for each gram in: 2 is the 1:2 the recipe asks for. */
export const ratioFor = (grams: number) => grams / RECIPE.doseGrams

/** 100 for a 1:2 shot, falling as the ratio drifts either way. */
export function scoreFor(grams: number): number {
  return Math.max(0, 100 - Math.round(Math.abs(ratioFor(grams) - 2) * POINTS_PER_RATIO))
}

export type Verdict = 'perfect' | 'fast' | 'slow'

/** What to tell the visitor: a fast shot wants a finer grind, a slow one a coarser grind. */
export function verdictFor(grams: number): Verdict {
  if (scoreFor(grams) === 100) return 'perfect'
  return grams > RECIPE.yieldGrams ? 'fast' : 'slow'
}

/** "1:2.0" */
export function formatRatio(grams: number): string {
  return `1:${(Math.round(ratioFor(grams) * 10) / 10).toFixed(1)}`
}

/** How far the shot has run, 0 to 1. The stream lightens from dark to blond as this rises. */
export function blondingAt(time: number): number {
  return clamp01((shotClock(time) - FIRST_DROPS) / (RECIPE.shotSeconds - FIRST_DROPS))
}

/** How far the milk pour has gone, 0 to 1. */
export function artProgress(time: number): number {
  return clamp01((time - TIMELINE.artStart) / (TIMELINE.artEnd - TIMELINE.artStart))
}

/** "0:07" */
export function formatClock(seconds: number): string {
  const whole = Math.floor(Math.max(0, seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** "18.0" */
export function formatGrams(grams: number): string {
  return (Math.round(Math.max(0, grams) * 10) / 10).toFixed(1)
}

export type Vector = readonly [number, number, number]

/** Where the group head is on the machine, and where the cup waiting for milk stands on the counter. */
export const GROUP: Vector = [-0.008, 0.211, 0.163]
export const LATTE: Vector = [-0.42, -0.69, 1.28]
/** Where the grinder stands, to the right of the machine. */
export const GRINDER: Vector = [1.62, -0.69, 0]

export interface CameraKey {
  time: number
  /** What the camera looks at. */
  target: Vector
  /** The direction the camera stands in, seen from the target. */
  from: Vector
  /** How much of the scene must fit across the screen, and from top to bottom. */
  span: number
  rise: number
}

/** The storyboard: one unbroken move from the whole machine, in to the shot, and up over the cup. */
export const CAMERA: readonly CameraKey[] = [
  { time: 0, target: [GRINDER[0], 0.02, 0.2], from: [-0.3, 0.2, 1], span: 1.25, rise: 1.75 },
  { time: 1.6, target: [GRINDER[0], -0.25, 0.4], from: [-0.42, 0.42, 1], span: 0.8, rise: 0.75 },
  { time: 3, target: [0, 0.04, 0.2], from: [0.46, 0.12, 1], span: 0.95, rise: 0.75 },
  { time: 6, target: [0, -0.02, 0.18], from: [0.52, 0.06, 1], span: 0.62, rise: 0.5 },
  { time: 9, target: [0, -0.06, 0.2], from: [0.38, 0.4, 1], span: 0.8, rise: 0.62 },
  { time: 10.6, target: [LATTE[0], LATTE[1] + 0.12, LATTE[2]], from: [0.16, 0.9, 1], span: 1.0, rise: 0.8 },
  { time: 12.6, target: [LATTE[0], LATTE[1] + 0.15, LATTE[2]], from: [0, 2.6, 1], span: 0.62, rise: 0.62 },
  { time: 16, target: [LATTE[0], LATTE[1] + 0.15, LATTE[2]], from: [0, 3.2, 1], span: 0.54, rise: 0.54 },
]

export type CameraShot = Omit<CameraKey, 'time'>

/** A smooth curve through four values: it passes through `b` and `c` without stopping at either. */
function curve(a: number, b: number, c: number, d: number, spanBefore: number, span: number, spanAfter: number, amount: number): number {
  const slopeIn = spanBefore > 0 ? ((c - a) / (spanBefore + span)) * span : 0
  const slopeOut = spanAfter > 0 ? ((d - b) / (span + spanAfter)) * span : 0
  const t2 = amount * amount, t3 = t2 * amount
  return (2 * t3 - 3 * t2 + 1) * b + (t3 - 2 * t2 + amount) * slopeIn + (-2 * t3 + 3 * t2) * c + (t3 - t2) * slopeOut
}

/** The camera at a moment: it glides through every key and only comes to rest at the first and last. */
export function cameraAt(time: number): CameraShot {
  const last = CAMERA.length - 1
  if (time <= CAMERA[0].time) return CAMERA[0]
  if (time >= CAMERA[last].time) return CAMERA[last]
  let index = 0
  while (index < last - 1 && CAMERA[index + 1].time <= time) index++
  const before = CAMERA[Math.max(0, index - 1)], from = CAMERA[index], to = CAMERA[index + 1], after = CAMERA[Math.min(last, index + 2)]
  const span = to.time - from.time
  const amount = (time - from.time) / span
  const blend = (pick: (key: CameraKey) => number) =>
    curve(pick(before), pick(from), pick(to), pick(after), from.time - before.time, span, after.time - to.time, amount)
  const vector = (pick: (key: CameraKey) => Vector): Vector => [blend(k => pick(k)[0]), blend(k => pick(k)[1]), blend(k => pick(k)[2])]
  return { target: vector(k => k.target), from: vector(k => k.from), span: blend(k => k.span), rise: blend(k => k.rise) }
}
