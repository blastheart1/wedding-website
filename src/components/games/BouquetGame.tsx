'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Bouquet {
  id:     number
  x:      number   // 0-100 (% of container width)
  y:      number   // 0-100 (% of container height)
  speed:  number   // pixels per frame
  emoji:  string
  caught: boolean
  missed: boolean
}

interface ScoreEntry {
  id:         number
  playerName: string
  score:      number
  createdAt:  string
}

type GameState = 'idle' | 'name' | 'playing' | 'over' | 'submitting' | 'leaderboard'

const BOUQUET_EMOJIS = ['💐', '🌸', '🌺', '🌹', '🌷', '🌼', '🏵️']
const GAME_DURATION  = 30 // seconds
const CONTAINER_W    = 340
const CONTAINER_H    = 420

// ─── Component ────────────────────────────────────────────────────────────────
export function BouquetGame() {
  const [gameState,    setGameState]    = useState<GameState>('idle')
  const [playerName,   setPlayerName]   = useState('')
  const [score,        setScore]        = useState(0)
  const [timeLeft,     setTimeLeft]     = useState(GAME_DURATION)
  const [bouquets,     setBouquets]     = useState<Bouquet[]>([])
  const [leaderboard,  setLeaderboard]  = useState<ScoreEntry[]>([])
  const [combo,        setCombo]        = useState(0)
  const [comboFlash,   setComboFlash]   = useState(false)
  const [missCount,    setMissCount]    = useState(0)
  const [savedScore,   setSavedScore]   = useState(0)

  const idCounter      = useRef(0)
  const gameLoopRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreRef       = useRef(0)
  const comboRef       = useRef(0)
  const missRef        = useRef(0)

  const stopGame = useCallback(() => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current)
    if (spawnRef.current)    clearInterval(spawnRef.current)
    if (timerRef.current)    clearInterval(timerRef.current)
  }, [])

  const loadLeaderboard = useCallback(async () => {
    try {
      const res  = await fetch('/api/bouquet/scores')
      const json = await res.json()
      if (json.success) setLeaderboard(json.data)
    } catch {/* ignore */}
  }, [])

  const spawnBouquet = useCallback(() => {
    const newBouquet: Bouquet = {
      id:     ++idCounter.current,
      x:      10 + Math.random() * 80,
      y:      -8,
      speed:  2 + Math.random() * 3,
      emoji:  BOUQUET_EMOJIS[Math.floor(Math.random() * BOUQUET_EMOJIS.length)],
      caught: false,
      missed: false,
    }
    setBouquets(prev => [...prev, newBouquet])
  }, [])

  const catchBouquet = useCallback((id: number) => {
    setBouquets(prev => prev.map(b => b.id === id ? { ...b, caught: true } : b))

    comboRef.current += 1
    setCombo(comboRef.current)
    setComboFlash(true)
    setTimeout(() => setComboFlash(false), 300)

    const points = comboRef.current >= 5 ? 3 : comboRef.current >= 3 ? 2 : 1
    scoreRef.current += points
    setScore(scoreRef.current)
  }, [])

  const startGame = () => {
    if (!playerName.trim()) { toast.error('Please enter your name!'); return }

    scoreRef.current  = 0
    comboRef.current  = 0
    missRef.current   = 0
    idCounter.current = 0

    setScore(0)
    setCombo(0)
    setMissCount(0)
    setTimeLeft(GAME_DURATION)
    setBouquets([])
    setGameState('playing')

    // Game physics loop — move bouquets down
    gameLoopRef.current = setInterval(() => {
      setBouquets(prev => {
        const updated = prev
          .filter(b => !b.caught || b.y < 115)
          .map(b => {
            if (b.caught || b.missed) return b
            const nextY = b.y + (b.speed * 0.4)
            if (nextY > 105) {
              // Missed — break combo
              comboRef.current = 0
              missRef.current  += 1
              setCombo(0)
              setMissCount(missRef.current)
              return { ...b, y: nextY, missed: true }
            }
            return { ...b, y: nextY }
          })
        // Remove old caught/missed ones
        return updated.filter(b => !(b.missed && b.y > 115) && !(b.caught && b.y > 115))
      })
    }, 30)

    // Spawn bouquets — starts every 1.5s, speeds up over time
    let spawnInterval = 1500
    spawnRef.current = setInterval(() => {
      spawnBouquet()
      // Gradually accelerate spawning
      if (spawnInterval > 600) {
        spawnInterval -= 50
        clearInterval(spawnRef.current!)
        spawnRef.current = setInterval(spawnBouquet, spawnInterval)
      }
    }, spawnInterval)

    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopGame()
          setSavedScore(scoreRef.current)
          setGameState('over')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Cleanup on unmount
  useEffect(() => () => stopGame(), [stopGame])

  const submitScore = async () => {
    setGameState('submitting')
    try {
      const res  = await fetch('/api/bouquet/scores', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ playerName: playerName.trim(), score: savedScore }),
      })
      const json = await res.json()
      if (json.success) {
        await loadLeaderboard()
        setGameState('leaderboard')
      } else {
        toast.error('Failed to save score.')
        setGameState('over')
      }
    } catch {
      toast.error('Network error.')
      setGameState('over')
    }
  }

  const reset = () => {
    stopGame()
    setBouquets([])
    setScore(0)
    setCombo(0)
    setMissCount(0)
    setTimeLeft(GAME_DURATION)
    setGameState('idle')
  }

  return (
    <div className="max-w-lg mx-auto">
      <AnimatePresence mode="wait">

        {/* ── Idle ── */}
        {gameState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="bg-white border border-rule p-8 text-center"
          >
            <div className="text-5xl mb-3">💐</div>
            <h3 className="font-display text-[24px] font-light text-ink mb-2">Catch the Bouquet!</h3>
            <p className="text-[13px] text-ink2 mb-2 leading-relaxed">
              Tap falling bouquets before they hit the ground. Build combos for bonus points!
            </p>
            <p className="text-[11px] text-muted mb-6">⏱ 30 seconds · 🌸×3 combo = 3 pts</p>
            <button
              onClick={() => setGameState('name')}
              className="bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium px-8 py-3 hover:bg-rosedark transition-colors"
            >
              Play Now
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
              onKeyDown={e => { if (e.key === 'Enter') startGame() }}
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
                onClick={startGame}
                className="flex-1 bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium py-3 hover:bg-rosedark transition-colors"
              >
                Start!
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Playing ── */}
        {gameState === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            className="select-none"
          >
            {/* HUD */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-ink font-medium">
                  Score: <span className={clsx('text-rose', comboFlash && 'font-bold')}>{score}</span>
                </span>
                {combo >= 3 && (
                  <motion.span
                    key={combo}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-[10px] tracking-[1px] uppercase text-rose font-medium"
                  >
                    🔥 ×{combo} combo!
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {missCount > 0 && (
                  <span className="text-[11px] text-muted">💔 ×{missCount}</span>
                )}
                <span className={clsx(
                  'font-mono text-[14px] font-medium tabular-nums',
                  timeLeft <= 10 ? 'text-rose' : 'text-ink',
                )}>
                  {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Game arena */}
            <div
              className="relative overflow-hidden border border-rule bg-gradient-to-b from-petal/30 to-lavender/20"
              style={{ width: CONTAINER_W, height: CONTAINER_H, maxWidth: '100%', margin: '0 auto', touchAction: 'none' }}
            >
              {/* Background deco */}
              <div className="absolute inset-0 opacity-10 pointer-events-none select-none text-[80px] flex items-center justify-center">
                🌸
              </div>

              {/* Timer bar at top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-rule">
                <motion.div
                  className="h-full bg-rose"
                  animate={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
                  transition={{ duration: 0.9, ease: 'linear' }}
                />
              </div>

              {/* Bouquets */}
              {bouquets.map(b => (
                <motion.button
                  key={b.id}
                  onClick={() => !b.caught && !b.missed && catchBouquet(b.id)}
                  animate={b.caught ? { scale: [1, 1.4, 0], opacity: [1, 1, 0] } : {}}
                  transition={b.caught ? { duration: 0.35 } : {}}
                  style={{
                    position:  'absolute',
                    left:      `${b.x}%`,
                    top:       `${b.y}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize:  '32px',
                    lineHeight: 1,
                    cursor:    b.caught || b.missed ? 'default' : 'pointer',
                    filter:    b.missed ? 'grayscale(1) opacity(0.4)' : 'none',
                    pointerEvents: b.caught || b.missed ? 'none' : 'auto',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    padding:   '8px',
                  }}
                >
                  {b.emoji}
                </motion.button>
              ))}
            </div>

            <p className="text-center text-[11px] text-muted mt-2">Tap the bouquets before they fall!</p>
          </motion.div>
        )}

        {/* ── Game over ── */}
        {gameState === 'over' && (
          <motion.div
            key="over"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white border border-rule p-8 text-center"
          >
            <div className="text-5xl mb-3">🎊</div>
            <h3 className="font-display text-[28px] font-light text-ink mb-1">Time&apos;s up!</h3>
            <p className="text-[32px] font-bold text-rose mb-1">{savedScore}</p>
            <p className="text-[12px] text-muted mb-6">points scored</p>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 border border-rule text-[10px] tracking-[2px] uppercase text-muted py-3 hover:bg-petal transition-colors"
              >
                Try again
              </button>
              <button
                onClick={submitScore}
                className="flex-1 bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium py-3 hover:bg-rosedark transition-colors"
              >
                Save score
              </button>
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
              💐
            </motion.div>
            <p className="text-[13px] text-muted">Saving your score…</p>
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
                    <span className="text-[13px] text-rose font-bold">{e.score}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setGameState('name')}
              className="w-full mt-4 bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium py-3 hover:bg-rosedark transition-colors"
            >
              Play again
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
