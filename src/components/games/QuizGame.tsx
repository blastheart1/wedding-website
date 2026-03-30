'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import clsx from 'clsx'

interface Question {
  id:        number
  question:  string
  optionA:   string
  optionB:   string
  optionC:   string
  optionD:   string
  sortOrder: number
}

type Option = 'A' | 'B' | 'C' | 'D'
type GameState = 'idle' | 'name' | 'playing' | 'reviewing' | 'submitting' | 'leaderboard'

interface ScoreEntry {
  id:          number
  playerName:  string
  score:       number
  totalQ:      number
  timeTakenMs: number | null
  createdAt:   string
}

const OPTIONS: Option[] = ['A', 'B', 'C', 'D']

const optionLabels: Record<Option, string> = { A: 'A', B: 'B', C: 'C', D: 'D' }

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full h-1 bg-rule mb-4 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-rose"
        initial={{ width: 0 }}
        animate={{ width: `${(current / total) * 100}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  )
}

function Timer({ running, onTick }: { running: boolean; onTick: (ms: number) => void }) {
  const startRef   = useRef<number>(0)
  const rafRef     = useRef<number>(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running) { cancelAnimationFrame(rafRef.current); return }
    startRef.current = Date.now() - elapsed

    const tick = () => {
      const ms = Date.now() - startRef.current
      setElapsed(ms)
      onTick(ms)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const secs = Math.floor(elapsed / 1000)
  const mins = Math.floor(secs / 60)
  const display = `${String(mins).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  return (
    <span className="font-mono text-[12px] text-muted tabular-nums">{display}</span>
  )
}

export function QuizGame() {
  const [gameState,  setGameState]  = useState<GameState>('idle')
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [qIndex,     setQIndex]     = useState(0)
  const [answers,    setAnswers]    = useState<Record<string, Option>>({})
  const [playerName, setPlayerName] = useState('')
  const [result,     setResult]     = useState<{ score: number; totalQ: number } | null>(null)
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([])
  const [timerMs,    setTimerMs]    = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const currentQ = questions[qIndex] ?? null

  const loadQuestions = useCallback(async () => {
    try {
      const res  = await fetch('/api/quiz')
      const json = await res.json()
      if (json.success && json.data.length > 0) {
        setQuestions(json.data)
        return true
      }
      toast.error('No quiz questions available yet!')
      return false
    } catch {
      toast.error('Failed to load quiz.')
      return false
    }
  }, [])

  const loadLeaderboard = useCallback(async () => {
    try {
      const res  = await fetch('/api/quiz/scores')
      const json = await res.json()
      if (json.success) setLeaderboard(json.data)
    } catch {/* ignore */}
  }, [])

  const startQuiz = async () => {
    if (!playerName.trim()) { toast.error('Please enter your name!'); return }
    const ok = await loadQuestions()
    if (!ok) return
    setQIndex(0)
    setAnswers({})
    setTimerMs(0)
    setSelectedOption(null)
    setGameState('playing')
    setTimerRunning(true)
  }

  const selectOption = (opt: Option) => {
    if (isTransitioning) return
    setSelectedOption(opt)
    setIsTransitioning(true)

    setTimeout(() => {
      setAnswers(prev => ({ ...prev, [String(currentQ!.id)]: opt }))
      setSelectedOption(null)
      setIsTransitioning(false)

      if (qIndex + 1 < questions.length) {
        setQIndex(qIndex + 1)
      } else {
        setTimerRunning(false)
        setGameState('submitting')
        submitAnswers({ ...answers, [String(currentQ!.id)]: opt }, timerMs)
      }
    }, 600)
  }

  const submitAnswers = async (finalAnswers: Record<string, Option>, ms: number) => {
    try {
      const res  = await fetch('/api/quiz/scores', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ playerName: playerName.trim(), answers: finalAnswers, timeTakenMs: ms }),
      })
      const json = await res.json()
      if (json.success) {
        setResult(json.data)
        await loadLeaderboard()
        setGameState('reviewing')
      } else {
        toast.error('Failed to save score.')
        setGameState('idle')
      }
    } catch {
      toast.error('Network error.')
      setGameState('idle')
    }
  }

  const reset = () => {
    setGameState('idle')
    setQIndex(0)
    setAnswers({})
    setResult(null)
    setTimerMs(0)
    setTimerRunning(false)
    setSelectedOption(null)
  }

  const optionText = (q: Question, opt: Option): string => {
    const map: Record<Option, string> = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
    return map[opt]
  }

  return (
    <div className="max-w-lg mx-auto">
      <AnimatePresence mode="wait">

        {/* ── Idle: intro card ── */}
        {gameState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="bg-white border border-rule p-8 text-center"
          >
            <div className="text-4xl mb-3">💍</div>
            <h3 className="font-display text-[24px] font-light text-ink mb-2">How well do you know us?</h3>
            <p className="text-[13px] text-ink2 mb-6 leading-relaxed">
              Test your knowledge about Luis &amp; Bee — from how they met to their favourite things together!
            </p>
            <button
              onClick={() => setGameState('name')}
              className="bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium px-8 py-3 hover:bg-rosedark transition-colors"
            >
              Start Quiz
            </button>
            <button
              onClick={async () => { await loadLeaderboard(); setGameState('leaderboard') }}
              className="block mx-auto mt-3 text-[11px] text-muted underline hover:text-rose transition-colors"
            >
              View leaderboard
            </button>
          </motion.div>
        )}

        {/* ── Name entry ── */}
        {gameState === 'name' && (
          <motion.div
            key="name"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="bg-white border border-rule p-8"
          >
            <h3 className="font-display text-[22px] font-light text-ink text-center mb-6">What&apos;s your name?</h3>
            <input
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') startQuiz() }}
              placeholder="Your name"
              maxLength={100}
              className="w-full px-[14px] py-[9px] bg-cream border border-rule font-sans text-[14px] text-ink outline-none transition-colors focus:border-rose focus:bg-white mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setGameState('idle')}
                className="flex-1 border border-rule text-[10px] tracking-[2px] uppercase text-muted py-3 hover:bg-petal transition-colors"
              >
                Back
              </button>
              <button
                onClick={startQuiz}
                className="flex-1 bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium py-3 hover:bg-rosedark transition-colors"
              >
                Let&apos;s go!
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Playing ── */}
        {gameState === 'playing' && currentQ && (
          <motion.div
            key={`q-${currentQ.id}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{    opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            className="bg-white border border-rule p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] tracking-[2px] uppercase text-muted">
                Question {qIndex + 1} / {questions.length}
              </span>
              <Timer running={timerRunning} onTick={setTimerMs} />
            </div>
            <ProgressBar current={qIndex + 1} total={questions.length} />

            <p className="font-sans text-[15px] text-ink font-medium mb-5 leading-snug">
              {currentQ.question}
            </p>

            <div className="grid grid-cols-1 gap-2">
              {OPTIONS.map(opt => (
                <motion.button
                  key={opt}
                  onClick={() => selectOption(opt)}
                  disabled={isTransitioning}
                  whileHover={{ scale: isTransitioning ? 1 : 1.01 }}
                  whileTap={{   scale: isTransitioning ? 1 : 0.99 }}
                  className={clsx(
                    'flex items-start gap-3 px-4 py-3 border text-left transition-all duration-200',
                    selectedOption === opt
                      ? 'bg-rose border-rose text-white'
                      : 'border-rule bg-cream text-ink hover:border-rose hover:bg-white',
                  )}
                >
                  <span className={clsx(
                    'shrink-0 w-6 h-6 flex items-center justify-center text-[10px] tracking-[1px] font-medium border rounded-full',
                    selectedOption === opt
                      ? 'border-white/50 text-white'
                      : 'border-rule text-muted',
                  )}>
                    {optionLabels[opt]}
                  </span>
                  <span className="text-[13px] leading-snug">{optionText(currentQ, opt)}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Submitting ── */}
        {gameState === 'submitting' && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-rule p-8 text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="text-3xl mb-4 inline-block"
            >
              🌸
            </motion.div>
            <p className="text-[13px] text-muted">Tallying your answers…</p>
          </motion.div>
        )}

        {/* ── Results ── */}
        {gameState === 'reviewing' && result && (
          <motion.div
            key="reviewing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white border border-rule p-8 text-center"
          >
            <div className="text-5xl mb-3">
              {result.score === result.totalQ ? '🏆' : result.score >= result.totalQ / 2 ? '🌸' : '💐'}
            </div>
            <h3 className="font-display text-[28px] font-light text-ink mb-1">
              {result.score} / {result.totalQ}
            </h3>
            <p className="text-[13px] text-ink2 mb-1">
              {result.score === result.totalQ
                ? 'Perfect score! You know us inside out!'
                : result.score >= result.totalQ / 2
                ? 'Great job! You know us pretty well!'
                : 'Not bad! Come celebrate and learn more about us!'}
            </p>
            <p className="text-[11px] text-muted mb-6">
              Time: {Math.floor(timerMs / 60000)}:{String(Math.floor((timerMs % 60000) / 1000)).padStart(2, '0')}
            </p>

            {leaderboard.length > 0 && (
              <div className="text-left mb-6">
                <p className="text-[9px] tracking-[3px] uppercase text-muted mb-3">Top scores</p>
                <div className="space-y-1">
                  {leaderboard.slice(0, 5).map((e, i) => (
                    <div key={e.id} className="flex items-center justify-between text-[12px]">
                      <span className={clsx('text-muted', e.playerName === playerName && 'text-rose font-medium')}>
                        {i + 1}. {e.playerName}
                      </span>
                      <span className={clsx('font-medium', e.playerName === playerName && 'text-rose')}>
                        {e.score}/{e.totalQ}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 border border-rule text-[10px] tracking-[2px] uppercase text-muted py-3 hover:bg-petal transition-colors"
              >
                Play again
              </button>
              <button
                onClick={() => { loadLeaderboard(); setGameState('leaderboard') }}
                className="flex-1 bg-rose text-white text-[10px] tracking-[3px] uppercase py-3 hover:bg-rosedark transition-colors"
              >
                Leaderboard
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Leaderboard ── */}
        {gameState === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="bg-white border border-rule p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[22px] font-light text-ink">🏆 Leaderboard</h3>
              <button onClick={reset} className="text-[11px] text-muted hover:text-rose transition-colors">
                ← Back
              </button>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-[13px] text-muted text-center py-4">No scores yet — be the first!</p>
            ) : (
              <div className="divide-y divide-rule">
                {leaderboard.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-3 py-2">
                    <span className={clsx(
                      'w-6 text-center text-[12px] font-medium shrink-0',
                      i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-muted',
                    )}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span className="flex-1 text-[13px] text-ink">{e.playerName}</span>
                    <span className="text-[13px] text-ink font-medium">{e.score}/{e.totalQ}</span>
                    {e.timeTakenMs != null && (
                      <span className="text-[11px] text-muted tabular-nums">
                        {Math.floor(e.timeTakenMs / 60000)}:{String(Math.floor((e.timeTakenMs % 60000) / 1000)).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setGameState('name')}
              className="w-full mt-4 bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium py-3 hover:bg-rosedark transition-colors"
            >
              Take the quiz
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
