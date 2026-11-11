'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { RSVP, WeddingConfig } from '@/lib/schema'
import { adminFetch, errorMessage } from './api'

export type AdminConfig = Partial<WeddingConfig>

interface AdminData {
  config: AdminConfig | null
  rsvps: RSVP[]
  stats: { total: number; attending: number; declining: number }
  warning?: string
}

const EMPTY_STATS = { total: 0, attending: 0, declining: 0 }

/**
 * Loads the site settings and RSVPs from /api/admin and saves settings back,
 * sending the whole settings object exactly as the admin always has.
 */
export function useAdminConfig() {
  const router = useRouter()
  const [config, setConfig] = useState<AdminConfig>({})
  const [saved, setSaved] = useState('{}')
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<AdminData>('/api/admin')
      if (data.warning) toast.warning(data.warning)
      const next = data.config ?? {}
      setConfig(next)
      setSaved(JSON.stringify(next))
      setRsvps(data.rsvps ?? [])
      setStats(data.stats ?? EMPTY_STATS)
      setError('')
    } catch (problem) {
      setError(errorMessage(problem))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const dirty = useMemo(() => JSON.stringify(config) !== saved, [config, saved])

  const save = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      await adminFetch('/api/admin', { method: 'POST', body: config })
      setSaved(JSON.stringify(config))
      toast.success('Saved')
      router.refresh()
    } catch (problem) {
      toast.error(errorMessage(problem))
    } finally {
      setSaving(false)
    }
  }, [config, router, saving])

  /** Returns a new settings object with one field changed. */
  const set = useCallback(<K extends keyof WeddingConfig>(key: K, value: WeddingConfig[K]) => {
    setConfig(current => ({ ...current, [key]: value }))
  }, [])

  return { config, setConfig, set, rsvps, stats, loading, saving, error, dirty, save, reload: load }
}

/** Warns before leaving a page that has unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}
