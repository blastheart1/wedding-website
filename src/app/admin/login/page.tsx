'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SYSTEM_FONT, inputClass, labelClass } from '../_ui/primitives'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password || checking) return
    setChecking(true)
    setError('')
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (response.ok) {
        router.push('/admin')
        return
      }
      const json: { error?: string } = await response.json().catch(() => ({}))
      setError(response.status === 401 ? 'That password is not right. Please try again.' : json.error ?? 'Could not sign in. Please try again.')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div style={SYSTEM_FONT} className="flex min-h-screen items-center justify-center bg-[#F2F2F7] px-4 text-black/85">
      <form onSubmit={submit} className="w-full max-w-[360px]">
        <h1 className="text-center text-[28px] font-bold tracking-tight text-black/90">Wedding admin</h1>
        <p className="mt-1 text-center text-[15px] text-black/50">Luis &amp; Bee</p>
        <div className="mt-8 rounded-xl bg-white px-4 py-3">
          <label className={labelClass} htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" autoComplete="current-password" autoFocus disabled={checking}
            value={password} onChange={event => { setPassword(event.target.value); setError('') }} className={inputClass} />
        </div>
        <p role="alert" className="min-h-[1.5rem] px-4 pt-2 text-[13px] text-[#B3261E]">{error}</p>
        <Button type="submit" tone="primary" disabled={checking || !password} className="mt-1 w-full">{checking ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </div>
  )
}
