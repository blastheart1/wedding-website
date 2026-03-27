'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function AdminLoginPage() {
  const router   = useRouter()
  const [pw,       setPw]       = useState('')
  const [checking, setChecking] = useState(false)
  const [error,    setError]    = useState('')

  const submit = async () => {
    if (!pw || checking) return
    setChecking(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: pw }),
      })
      if (res.ok) {
        router.push('/admin')
      } else {
        const json = await res.json()
        setError(json.error ?? 'Wrong password — try again')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-petal px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white border border-rule p-12 max-w-sm w-full text-center"
      >
        <h1 className="font-display text-[32px] font-light text-ink mb-2">Admin Panel</h1>
        <p className="font-display italic text-ink2 text-[15px] mb-8">Luis & Bee · Wedding</p>

        <div className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full px-4 py-3 border border-rule bg-cream text-ink outline-none focus:border-rose text-[14px]"
            placeholder="Admin password"
            disabled={checking}
            autoFocus
          />
          {error && <p className="text-rose text-[11px] text-left">{error}</p>}
          <button
            onClick={submit}
            disabled={checking || !pw}
            className="w-full bg-rose text-white py-3 text-[10px] tracking-[3px] uppercase hover:bg-rosedark disabled:opacity-60 transition-colors"
          >
            {checking ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
