'use client'

import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { QuizGame }    from '@/components/games/QuizGame'
import { BouquetGame } from '@/components/games/BouquetGame'
import { fadeUp, stagger } from '@/lib/animations'
import clsx from 'clsx'

type ActiveGame = 'quiz' | 'bouquet' | null

export function GamesSection() {
  const [activeGame, setActiveGame] = useState<ActiveGame>(null)
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section id="games" className="relative py-24 px-6 bg-cream border-t border-rule">
      <div className="max-w-2xl mx-auto">
        <motion.div
          ref={ref}
          variants={stagger(0.08)}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center mb-10"
        >
          <motion.p variants={fadeUp} className="text-[9px] tracking-[4px] uppercase text-muted mb-2">
            While you wait
          </motion.p>
          <motion.h2 variants={fadeUp} className="font-display font-light text-[32px] text-ink">
            Play a{' '}
            <em className="italic text-rose">little game</em>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[13px] text-ink2 mt-2 leading-relaxed">
            Challenge your guests — how well do they know you? Or see who catches the bouquet first!
          </motion.p>
        </motion.div>

        {/* Game picker */}
        {!activeGame && (
          <motion.div
            variants={stagger(0.1)}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <motion.button
              variants={fadeUp}
              onClick={() => setActiveGame('quiz')}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{   scale: 0.98 }}
              className="bg-white border border-rule p-6 text-left hover:border-rose transition-colors group"
            >
              <div className="text-4xl mb-3">💍</div>
              <h3 className="font-display text-[20px] font-light text-ink mb-1 group-hover:text-rose transition-colors">
                Couple Quiz
              </h3>
              <p className="text-[12px] text-muted leading-relaxed">
                Test your knowledge of Luis &amp; Bee. Trivia, memories, and more!
              </p>
              <p className="text-[10px] tracking-[2px] uppercase text-rose mt-3">Play →</p>
            </motion.button>

            <motion.button
              variants={fadeUp}
              onClick={() => setActiveGame('bouquet')}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{   scale: 0.98 }}
              className="bg-white border border-rule p-6 text-left hover:border-rose transition-colors group"
            >
              <div className="text-4xl mb-3">💐</div>
              <h3 className="font-display text-[20px] font-light text-ink mb-1 group-hover:text-rose transition-colors">
                Catch the Bouquet
              </h3>
              <p className="text-[12px] text-muted leading-relaxed">
                Tap falling bouquets before they hit the ground. Build combos for bonus points!
              </p>
              <p className="text-[10px] tracking-[2px] uppercase text-rose mt-3">Play →</p>
            </motion.button>
          </motion.div>
        )}

        {/* Active game */}
        {activeGame && (
          <div>
            <button
              onClick={() => setActiveGame(null)}
              className={clsx(
                'mb-4 text-[11px] text-muted hover:text-rose transition-colors flex items-center gap-1',
              )}
            >
              ← Back to games
            </button>
            {activeGame === 'quiz'    && <QuizGame />}
            {activeGame === 'bouquet' && <BouquetGame />}
          </div>
        )}
      </div>
    </section>
  )
}
