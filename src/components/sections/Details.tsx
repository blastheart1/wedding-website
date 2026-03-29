'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import type { PublicConfig } from '@/lib/config'
import { SectionHeader }           from '@/components/ui/SectionHeader'
import { stagger, fadeUp }         from '@/lib/animations'
import { SectionBackground }       from '@/components/ui/SectionBackground'
import type { SectionHeading }     from '@/types'
import { DEFAULT_SECTION_HEADINGS } from '@/lib/constants'

interface DetailsProps {
  config: Pick<
    PublicConfig,
    | 'weddingDate' | 'ceremonyTime' | 'receptionTime'
    | 'ceremonyVenue' | 'receptionVenue' | 'location'
    | 'dressCode' | 'hotelName' | 'hotelCode' | 'hotelDiscount'
    | 'guestNotes'
  >
  bgUrl?:   string
  heading?: SectionHeading
}

function formatWeddingDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function Line({ text }: { text: string }) {
  if (!text || text === 'TBA') {
    return <p className="text-muted italic">Details coming soon</p>
  }
  return <p>{text}</p>
}

export function Details({ config, bgUrl, heading = DEFAULT_SECTION_HEADINGS.details }: DetailsProps) {
  const {
    weddingDate, ceremonyTime, receptionTime,
    ceremonyVenue, receptionVenue, location,
    dressCode, hotelName, hotelCode, hotelDiscount, guestNotes,
  } = config

  const displayDate = formatWeddingDate(weddingDate)

  const cards = [
    {
      icon:  '🌸',
      label: 'Ceremony',
      title: 'The Wedding',
      bg:    'bg-petal',
      lines: [
        displayDate,
        ceremonyTime,
        '',
        ceremonivenueLine(ceremonyVenue, location),
        guestNotes || '',
      ].filter(l => l !== undefined) as string[],
    },
    {
      icon:  '🥂',
      label: 'Reception',
      title: 'Celebration',
      bg:    'bg-peach',
      lines: [
        `Following the ceremony · ${receptionTime}`,
        '',
        receptionVenue !== 'TBA' ? receptionVenue : '',
        'Dinner, dancing & toasts',
      ],
    },
    {
      icon:  '👗',
      label: 'Attire',
      title: 'Dress Code',
      bg:    'bg-lavender',
      lines: [
        dressCode,
      ],
    },
    {
      icon:  '🏨',
      label: 'Stay',
      title: 'Accommodations',
      bg:    'bg-sage',
      lines: [
        hotelName !== 'TBA' ? hotelName : '',
        hotelCode ? `Promo code: ${hotelCode}` : '',
        hotelDiscount ? `${hotelDiscount} off for our guests` : '',
      ],
    },
  ]

  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section id="details" className="relative py-24 px-6">
      <SectionBackground imageUrl={bgUrl} fallbackColor="bg-cream" />
      <div className="relative z-10">
      <SectionHeader eyebrow={heading.eyebrow} heading={heading.heading} headingItalic={heading.italic} />

      <motion.div
        ref={ref}
        className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-rule max-w-[820px] mx-auto border border-rule"
        variants={stagger(0.1, 0)}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
      >
        {cards.map((card) => (
          <motion.div
            key={card.title}
            variants={fadeUp}
            className="bg-cream p-10 hover:bg-peach transition-colors duration-300 relative overflow-hidden group"
          >
            {/* Animated top accent line */}
            <motion.div
              className="absolute top-0 left-0 h-[3px] bg-rose"
              initial={{ width: 0, opacity: 0 }}
              animate={inView ? { width: '100%', opacity: 0.6 } : {}}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />

            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[15px] ${card.bg}`}>
                {card.icon}
              </div>
              <div>
                <p className="text-[9px] tracking-[3px] uppercase text-muted">{card.label}</p>
                <h3 className="font-display text-[21px] font-normal text-ink">{card.title}</h3>
              </div>
            </div>

            <div className="text-[13px] leading-[1.9] text-ink2">
              {card.lines.map((line, i) =>
                line === ''
                  ? <br key={i} />
                  : <Line key={i} text={line} />,
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
      </div>
    </section>
  )
}

function ceremonivenueLine(venue: string, location: string): string {
  if (venue !== 'TBA' && location !== 'TBA') return `${venue} · ${location}`
  if (venue !== 'TBA') return venue
  if (location !== 'TBA') return location
  return ''
}
