'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import type { CountdownValues } from '@/types'
import type { PublicConfig }    from '@/lib/config'
import { SectionHeader }        from '@/components/ui/SectionHeader'
import { SectionBackground }    from '@/components/ui/SectionBackground'

interface CountdownProps {
  config: Pick<PublicConfig, 'weddingDate' | 'ceremonyTime'>
  bgUrl?: string
}

function getTimeLeft(weddingDate: string, ceremonyTime: string): CountdownValues {
  // Parse ceremony time (e.g. "3:00 PM")
  const [timePart, period] = ceremonyTime.split(' ')
  const [hRaw, mRaw]       = (timePart ?? '15:00').split(':').map(Number)
  let hours = hRaw
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  const [year, month, day] = weddingDate.split('-').map(Number)
  const target = new Date(year, month - 1, day, hours, mRaw ?? 0, 0)
  const diff   = Math.max(target.getTime() - Date.now(), 0)

  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000)  / 60_000),
    seconds: Math.floor((diff % 60_000)     / 1_000),
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Flip digit — animates out old value, in new value
function FlipDigit({ value }: { value: string }) {
  return (
    <div className="relative overflow-hidden" style={{ minWidth: '1ch', paddingBottom: '0.12em' }}>
      <AnimatePresence mode="popLayout" initial={false}>
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
      </AnimatePresence>
    </div>
  )
}

export function Countdown({ config, bgUrl }: CountdownProps) {
  const { weddingDate, ceremonyTime } = config

  const [values, setValues] = useState<CountdownValues>(() =>
    getTimeLeft(weddingDate, ceremonyTime),
  )

  useEffect(() => {
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
      className="relative py-28 px-6 text-center border-y border-lilac/20"
    >
      <SectionBackground imageUrl={bgUrl} fallbackColor="bg-lavender" parallax />
      <div className="relative z-10">
      <SectionHeader eyebrow="Counting down" heading="Until we say" headingItalic="forever" />

      <motion.div
        ref={ref}
        className="flex justify-center flex-wrap mt-4"
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        variants={{
          hidden:  {},
          visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
        }}
      >
        {units.map((u) => (
          <motion.div
            key={u.label}
            variants={{
              hidden:  { opacity: 0, y: 24 },
              visible: { opacity: 1, y: 0,  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="px-8 md:px-10 border-r border-lilac/30 last:border-r-0"
          >
            <div
              className="font-display font-light text-lilac flex justify-center"
              style={{ fontSize: 'clamp(52px, 8vw, 84px)', lineHeight: 1.1 }}
            >
              {u.value.split('').map((digit, i) => (
                <FlipDigit key={i} value={digit} />
              ))}
            </div>
            <span className="text-[9px] tracking-[4px] uppercase text-muted mt-2 block">
              {u.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
      </div>
    </section>
  )
}
