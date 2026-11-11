'use client'

import { useCallback, useRef, useState } from 'react'
import type { StatusResult } from '@/lib/invitations/status-copy'

type Envelope<T> = { success: boolean; data?: T; error?: string }

const UNREACHABLE = 'We could not reach the server. Please check your connection and try again.'

async function post<T>(url: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error(UNREACHABLE)
  }
  const json: Envelope<T> = await response.json().catch(() => ({ success: false }))
  if (!json.success || json.data === undefined) throw new Error(json.error ?? 'Something went wrong. Please try again.')
  return json.data
}

/** State and calls behind the public status check, shared by the RSVP dialog and the status page. */
export function useStatusCheck() {
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<StatusResult | null>(null)
  const [changeSent, setChangeSent] = useState(false)
  const pending = useRef(false)

  /** Runs one request at a time; a second tap while one is in flight is ignored. */
  const guard = useCallback(async (work: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : UNREACHABLE)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }, [])

  const check = useCallback(() => guard(async () => {
    setResult(null)
    setChangeSent(false)
    setResult(await post<StatusResult>('/api/invite/lookup', { contact }))
  }), [contact, guard])

  const requestChange = useCallback((note: string) => guard(async () => {
    await post<{ received: true }>('/api/invite/change-request', { contact, note })
    setChangeSent(true)
  }), [contact, guard])

  const reset = useCallback(() => {
    setContact('')
    setError('')
    setResult(null)
    setChangeSent(false)
  }, [])

  return { contact, setContact: (value: string) => { setContact(value); setError('') }, busy, error, result, changeSent, check, requestChange, reset }
}
