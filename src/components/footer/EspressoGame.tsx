'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  GRIND, RECIPE, TIMELINE, clampGrind, doseAt, formatClock, formatGrams, formatRatio, pickSweetSpot,
  scoreFor, shotClock, verdictFor, yieldAt, yieldForGrind,
} from '@/lib/espresso'
import { useEspressoPlayer } from './useEspressoPlayer'

/**
 * dial: choosing a grind. grinding: grounds falling. ground: dosed, waiting for Done.
 * brewing: the shot runs. tasted: the score is shown. pouring: milk. done: the finished cup.
 */
type Step = 'dial' | 'grinding' | 'ground' | 'brewing' | 'tasted' | 'pouring' | 'done'

interface EspressoGameProps {
  /** The sheet is on screen (being dragged open, or open). */
  mounted: boolean
}

const GOAL = `Find the grind that gives ${RECIPE.yieldGrams} g out in ${RECIPE.shotSeconds} seconds.`
/** Holding a tick button repeats it: after a pause, then quickly. */
const HOLD_DELAY_MS = 350
const HOLD_EVERY_MS = 45

function resultLine(grams: number): string {
  const verdict = verdictFor(grams)
  if (verdict === 'perfect') return `${formatRatio(grams)}. Dialled in.`
  return verdict === 'fast' ? `${formatRatio(grams)}. Ran fast: grind finer.` : `${formatRatio(grams)}. Ran slow: grind coarser.`
}

function captionFor(step: Step, shot: number | null): string {
  switch (step) {
    case 'dial': return 'Dial in the grind'
    case 'grinding': return `Grinding ${RECIPE.doseGrams} grams`
    case 'ground': return `${RECIPE.doseGrams} grams, ready to brew`
    case 'brewing': return 'Pulling the shot'
    case 'tasted': return shot === null ? '' : resultLine(shot)
    case 'pouring': return 'A little milk'
    case 'done': return 'Made with care'
  }
}

/**
 * The espresso easter egg, played: pick a grind size, grind, brew, and see how
 * close the shot came to 1:2. The sweet spot is hidden and different each visit.
 */
export function EspressoGame({ mounted }: EspressoGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const dose = useRef<HTMLSpanElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const out = useRef<HTMLSpanElement>(null)
  const sweetSpot = useRef<number | null>(null)
  const hold = useRef(0)
  const [step, setStep] = useState<Step>('dial')
  const [grind, setGrind] = useState<number>(GRIND.start)
  // Grams of the last shot pulled, kept while the grind is adjusted so the visitor knows which way to go.
  const [shot, setShot] = useState<number | null>(null)

  const onFrame = useCallback((time: number, shotGrams: number) => {
    if (dose.current) dose.current.textContent = formatGrams(doseAt(time))
    if (clock.current) clock.current.textContent = formatClock(shotClock(time))
    if (out.current) out.current.textContent = formatGrams(yieldAt(time, shotGrams))
  }, [])
  const { ready, unavailable, show, run, setShot: setPlayerShot } = useEspressoPlayer(canvas, mounted, onFrame)

  // Each time the sheet is opened the story starts again at the grinder.
  useEffect(() => {
    if (!mounted) return
    if (sweetSpot.current === null) sweetSpot.current = pickSweetSpot(Math.random())
    setStep('dial')
  }, [mounted])

  const stopHold = useCallback(() => { window.clearTimeout(hold.current); window.clearInterval(hold.current) }, [])
  useEffect(() => stopHold, [stopHold])

  const nudge = (by: number) => setGrind(current => clampGrind(current + by))
  const startHold = (by: number) => {
    stopHold()
    nudge(by)
    hold.current = window.setTimeout(() => { hold.current = window.setInterval(() => nudge(by), HOLD_EVERY_MS) }, HOLD_DELAY_MS)
  }
  // Pointer presses are handled by the hold; a click with no pointer is the keyboard.
  const keyboardNudge = (by: number) => (event: ReactMouseEvent) => { if (event.detail === 0) nudge(by) }

  const grindNow = async () => {
    setStep('grinding')
    if (await run(0, TIMELINE.doseEnd)) setStep('ground')
  }
  const brew = async () => {
    const grams = yieldForGrind(grind, sweetSpot.current ?? GRIND.start)
    setPlayerShot(grams)
    setShot(grams)
    setStep('brewing')
    if (await run(TIMELINE.doseEnd, TIMELINE.shotEnd)) setStep('tasted')
  }
  const adjust = () => { show(0); setStep('dial') }
  const pour = async () => {
    setStep('pouring')
    if (await run(TIMELINE.shotEnd, TIMELINE.total)) setStep('done')
  }

  const scored = shot !== null && step !== 'grinding' && step !== 'ground' && step !== 'brewing'
  const perfect = shot !== null && verdictFor(shot) === 'perfect'

  return (
    <>
      {mounted && !unavailable && <canvas ref={canvas} className="peel-canvas" data-ready={ready} aria-hidden="true" />}

      <div className="peel-readout">
        <p className="peel-caption" role="status" aria-live="polite">
          {unavailable ? 'Made with care' : ready ? captionFor(step, shot) : 'Warming up the machine'}
        </p>
        <dl className="peel-numbers" hidden={unavailable}>
          <div><dt>In</dt><dd><span ref={dose}>0.0</span> g</dd></div>
          <div><dt>Time</dt><dd><span ref={clock}>0:00</span></dd></div>
          <div><dt>Out</dt><dd><span ref={out}>0.0</span> g</dd></div>
          {scored && shot !== null && <div><dt>Score</dt><dd>{scoreFor(shot)}</dd></div>}
        </dl>
      </div>

      {ready && !unavailable && (
        <div className="peel-controls">
          {step === 'dial' && (
            <>
              <p className="peel-hint">{shot === null ? GOAL : `Last shot ${resultLine(shot)}`}</p>
              <div className="peel-grind">
                <button type="button" className="peel-tick" aria-label="One tick finer" disabled={grind <= GRIND.min}
                  onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onClick={keyboardNudge(-1)}>
                  <Minus size={18} strokeWidth={2} aria-hidden="true" />
                </button>
                <label className="peel-grind-dial">
                  <span className="peel-grind-value">{grind}</span>
                  <input type="range" min={GRIND.min} max={GRIND.max} step={1} value={grind}
                    aria-label={`Grind size, ${GRIND.min} finest to ${GRIND.max} coarsest`}
                    onChange={event => setGrind(clampGrind(Number(event.target.value)))} />
                  <span className="peel-grind-ends" aria-hidden="true"><span>Finer</span><span>Coarser</span></span>
                </label>
                <button type="button" className="peel-tick" aria-label="One tick coarser" disabled={grind >= GRIND.max}
                  onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onClick={keyboardNudge(1)}>
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <button type="button" className="peel-action" onClick={grindNow}>Grind</button>
            </>
          )}
          {step === 'ground' && <button type="button" className="peel-action" onClick={brew}>Done</button>}
          {step === 'tasted' && (
            <div className="peel-actions">
              <button type="button" className="peel-action" data-quiet={perfect} onClick={adjust}>Adjust grind</button>
              <button type="button" className="peel-action" data-quiet={!perfect} onClick={pour}>Add milk</button>
            </div>
          )}
          {step === 'done' && <button type="button" className="peel-action" data-quiet="true" onClick={adjust}>Pull another</button>}
        </div>
      )}
    </>
  )
}
