'use client'

import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { QuizGame }    from '@/components/games/QuizGame'
import { BouquetGame } from '@/components/games/BouquetGame'
import { fadeUp, stagger } from '@/lib/animations'

type ActiveGame = 'quiz' | 'bouquet' | null

export function GamesSection() {
  const [activeGame, setActiveGame] = useState<ActiveGame>(null)
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const games: { id: Exclude<ActiveGame, null>; title: string; description: string }[] = [
    { id: 'quiz', title: 'Couple Quiz', description: 'How well do you know us? A few questions about our story.' },
    { id: 'bouquet', title: 'Catch the Bouquet', description: 'Tap the falling bouquets before they land.' },
  ]

  return (
    <section id="games" className="relative bg-cream px-6 py-28">
      <div className="mx-auto max-w-2xl">
        <motion.div
          ref={ref}
          variants={stagger(0.08)}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="mb-10 text-center"
        >
          <motion.p variants={fadeUp} className="detail-kicker">While you wait</motion.p>
          <motion.h2 variants={fadeUp} className="font-display text-[clamp(36px,6vw,52px)] font-light leading-tight text-ink">
            A little <em className="italic">game</em>
          </motion.h2>
        </motion.div>

        {!activeGame && (
          <motion.div variants={stagger(0.1)} initial="hidden" animate={inView ? 'visible' : 'hidden'} className="border-t border-black/10">
            {games.map(game => (
              <motion.button
                key={game.id}
                type="button"
                variants={fadeUp}
                onClick={() => setActiveGame(game.id)}
                className="flex w-full items-center justify-between gap-6 border-b border-black/10 py-6 text-left"
              >
                <span>
                  <span className="block font-display text-[26px] font-light leading-tight text-ink">{game.title}</span>
                  <span className="mt-1 block text-[16px] leading-relaxed text-ink2">{game.description}</span>
                </span>
                <span className="shrink-0 text-[14px] uppercase tracking-[2px] text-ink underline underline-offset-[6px]">Play</span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {activeGame && (
          <div>
            <button type="button" onClick={() => setActiveGame(null)} className="text-link mb-4">Back to games</button>
            {activeGame === 'quiz' && <QuizGame />}
            {activeGame === 'bouquet' && <BouquetGame />}
          </div>
        )}
      </div>
    </section>
  )
}
