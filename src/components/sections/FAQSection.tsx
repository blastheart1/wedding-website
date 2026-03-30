'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { SectionBackground } from '@/components/ui/SectionBackground'
import { DEFAULT_SECTION_HEADINGS } from '@/lib/constants'
import { fadeUp, stagger } from '@/lib/animations'
import type { SectionHeading } from '@/types'
import type { FAQItem } from '@/lib/schema'

interface FAQSectionProps {
  heading?: SectionHeading
  bgUrl?:   string
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <motion.svg
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-rose"
    >
      <path
        d="M3 6l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  )
}

function FAQItemRow({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      variants={fadeUp}
      className="border-b border-rule last:border-b-0"
    >
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-4 py-4 px-0 text-left group"
        aria-expanded={open}
      >
        <span className="font-sans text-[14px] text-ink leading-snug group-hover:text-rose transition-colors">
          {item.question}
        </span>
        <ChevronIcon open={open} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{   height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-[13px] text-ink2 leading-relaxed">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FAQSection({ heading = DEFAULT_SECTION_HEADINGS.faq, bgUrl }: FAQSectionProps) {
  const [items, setItems] = useState<FAQItem[]>([])

  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  useEffect(() => {
    fetch('/api/faq')
      .then(r => r.json())
      .then(json => { if (json.success) setItems(json.data) })
      .catch(() => {/* silently ignore — empty FAQ is fine */})
  }, [])

  return (
    <section id="faq" className="relative py-24 px-6">
      <SectionBackground imageUrl={bgUrl} fallbackColor="bg-lavender/30" />

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Section heading */}
        <motion.div
          ref={ref}
          variants={stagger(0.08)}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center mb-12"
        >
          <motion.p variants={fadeUp} className="text-[9px] tracking-[4px] uppercase text-muted mb-2">
            {heading.eyebrow}
          </motion.p>
          <motion.h2 variants={fadeUp} className="font-display font-light text-[32px] text-ink">
            {heading.heading}{' '}
            <em className="italic text-rose">{heading.italic}</em>
          </motion.h2>
        </motion.div>

        {/* FAQ list */}
        {items.length === 0 ? (
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="text-center text-[13px] text-muted italic"
          >
            No questions yet — check back soon.
          </motion.p>
        ) : (
          <motion.div
            variants={stagger(0.07)}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="bg-white/80 backdrop-blur-sm border border-rule divide-y-0 px-6"
          >
            {items.map((item, i) => (
              <FAQItemRow key={item.id} item={item} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}
