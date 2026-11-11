'use client'

import {weddingTimeLeft as getTimeLeft} from '@/lib/wedding-time'
import {useWorldMotion} from '@/lib/site-motion'
import type {NightMode} from '@/world/night-scene'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import type { CountdownValues } from '@/types'
import type { PublicConfig }    from '@/lib/config'
import { SectionHeader }           from '@/components/ui/SectionHeader'
import type { SectionHeading }     from '@/types'
import { DEFAULT_SECTION_HEADINGS } from '@/lib/constants'

interface CountdownProps {
  config:   Pick<PublicConfig, 'weddingDate' | 'ceremonyTime' | 'partner1' | 'partner2'>
  heading?: SectionHeading
}


function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Flip digit — animates out old value, in new value
function FlipDigit({ value, reduced }: { value: string, reduced: boolean }) {
  return (
    <div className="relative overflow-hidden" style={{ minWidth: '1ch', paddingBottom: '0.12em' }}>
      {reduced?<span className="block">{value}</span>:<AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '-60%', opacity: 0 }}
          animate={{ y: '0%',   opacity: 1 }}
          exit={{    y:  '60%', opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="block"
        >
          {value}
        </motion.span>
      </AnimatePresence>}
    </div>
  )
}

export function Countdown({ config, heading = DEFAULT_SECTION_HEADINGS.countdown }: CountdownProps) {
  const { weddingDate, ceremonyTime } = config
  const {reduced,paused}=useWorldMotion()
  const [nightMode,setNightMode]=useState<NightMode>('stargaze')
  useEffect(()=>{window.dispatchEvent(new Event('wedding-world-control'))},[nightMode])

  const [values, setValues] = useState<CountdownValues>(() =>
    ({days:0,hours:0,minutes:0,seconds:0}),
  )

  useEffect(() => {
    setValues(getTimeLeft(weddingDate, ceremonyTime))
    const id = setInterval(
      () => setValues(getTimeLeft(weddingDate, ceremonyTime)),
      1000,
    )
    return () => clearInterval(id)
  }, [weddingDate, ceremonyTime])

  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const units = [
    { label: 'Days',    value: pad(values.days)    },
    { label: 'Hours',   value: pad(values.hours)   },
    { label: 'Minutes', value: pad(values.minutes) },
    { label: 'Seconds', value: pad(values.seconds) },
  ]

  return (
    <section
      id="countdown"
      className="countdown-section"
    >
      <div className="countdown-copy">
      <SectionHeader eyebrow={heading.eyebrow} heading={heading.heading} headingItalic={heading.italic} />

      <motion.div
        ref={ref}
        className="countdown-grid"
        initial={reduced?false:"hidden"}
        animate={reduced||inView ? 'visible' : 'hidden'}
        variants={{
          hidden:  {},
          visible: { transition: { staggerChildren: reduced?0:0.1, delayChildren: reduced?0:0.1 } },
        }}
      >
        {units.map((u) => (
          <motion.div
            key={u.label}
            variants={{
              hidden:  { opacity: reduced?1:0, y: reduced?0:24 },
              visible: { opacity: 1, y: 0,  transition: { duration: reduced?0:0.8, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="min-w-0"
          >
            <div
              className="countdown-numerals"
            >
              {u.value.split('').map((digit, i) => (
                <FlipDigit key={i} value={digit} reduced={reduced||paused} />
              ))}
            </div>
            <span className="countdown-label">
              {u.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
      </div>
      <div id="countdown-night-scene" className="countdown-world scene-viewport" data-wedding-scene="night" data-night-mode={nightMode} role="img" aria-label={nightMode==='dance'?`${config.partner1} and ${config.partner2} dance together beneath the moon and stars.`:`${config.partner1} and ${config.partner2} sit together beneath the moon and stars.`}><div className="world-canvas-slot" aria-hidden="true" /></div>
      <p className="night-scene-caption">Together under the stars</p>
      <div className="night-scene-options" role="group" aria-label="Choose the couple’s night scene" aria-controls="countdown-night-scene">
        <button type="button" aria-pressed={nightMode==='stargaze'} onClick={()=>setNightMode('stargaze')}>Stargazing</button>
        <button type="button" aria-pressed={nightMode==='dance'} onClick={()=>setNightMode('dance')}>Dancing</button>
      </div>
      <span className="sr-only" role="status">{nightMode==='dance'?'Dancing scene selected.':'Stargazing scene selected.'} {reduced?'Reduced motion: a still pose is shown.':paused?'Motion is paused.':''}</span>
    </section>
  )
}
