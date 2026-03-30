'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { GuestListEntry } from '@/lib/schema'
import clsx from 'clsx'

const cred: RequestCredentials = 'include'

const inputClass = 'w-full px-3 py-2 border border-rule bg-cream text-[13px] text-ink outline-none focus:border-rose focus:bg-white transition-colors'
const labelClass = 'block text-[11px] text-muted mb-1'

export function GuestListTab() {
  const [guests,    setGuests]    = useState<GuestListEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [newEmail,  setNewEmail]  = useState('')
  const [newName,   setNewName]   = useState('')
  const [newStatus, setNewStatus] = useState<'allow' | 'block'>('allow')
  const [newSeats,  setNewSeats]  = useState(1)
  const [adding,    setAdding]    = useState(false)
  const [bulkText,  setBulkText]  = useState('')
  const [bulkSeats, setBulkSeats] = useState(1)
  const [importing, setImporting] = useState(false)

  const loadGuests = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/guests', { credentials: cred })
      const json = await res.json()
      if (json.success) setGuests(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGuests() }, [loadGuests])

  const filtered = guests.filter(g =>
    !search || g.email.includes(search.toLowerCase()) || (g.name ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const addGuest = async () => {
    if (!newEmail.trim()) { toast.error('Email required'); return }
    setAdding(true)
    try {
      const res  = await fetch('/api/admin/guests', {
        method:      'POST',
        credentials: cred,
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email: newEmail.trim(), name: newName.trim() || undefined, status: newStatus, seats: newSeats }),
      })
      const json = await res.json()
      if (json.success) {
        // Upsert locally
        setGuests(prev => {
          const exists = prev.findIndex(g => g.email === json.data.email)
          if (exists >= 0) return prev.map((g, i) => i === exists ? json.data : g)
          return [...prev, json.data].sort((a, b) => a.email.localeCompare(b.email))
        })
        setNewEmail('')
        setNewName('')
        setNewStatus('allow')
        setNewSeats(1)
        toast.success('Guest added')
      } else {
        toast.error(json.error ?? 'Failed to add guest')
      }
    } finally {
      setAdding(false)
    }
  }

  const updateGuest = async (id: number, updates: Partial<Pick<GuestListEntry, 'status' | 'seats' | 'name'>>) => {
    const res = await fetch('/api/admin/guests', {
      method:      'PATCH',
      credentials: cred,
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ id, ...updates }),
    })
    if (res.ok) {
      const json = await res.json()
      setGuests(prev => prev.map(g => g.id === id ? json.data : g))
    } else {
      toast.error('Update failed')
    }
  }

  const deleteGuest = async (id: number) => {
    if (!confirm('Remove this guest from the list?')) return
    const res = await fetch(`/api/admin/guests?id=${id}`, { method: 'DELETE', credentials: cred })
    if (res.ok) {
      setGuests(prev => prev.filter(g => g.id !== id))
      toast.success('Guest removed')
    } else {
      toast.error('Delete failed')
    }
  }

  const bulkImport = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) { toast.error('No emails to import'); return }
    setImporting(true)
    try {
      const guests = lines.map(email => ({ email, status: 'allow' as const, seats: bulkSeats }))
      const res  = await fetch('/api/admin/guests', {
        method:      'PUT',
        credentials: cred,
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ guests }),
      })
      const json = await res.json()
      if (json.success) {
        await loadGuests()
        setBulkText('')
        toast.success(`Imported ${json.count} guests`)
      } else {
        toast.error(json.error ?? 'Import failed')
      }
    } finally {
      setImporting(false)
    }
  }

  const statusBadge = (status: string) => (
    <span className={clsx(
      'text-[9px] tracking-[1.5px] uppercase px-2 py-0.5 rounded-sm font-medium',
      status === 'allow' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-rose border border-red-200',
    )}>
      {status}
    </span>
  )

  return (
    <div className="space-y-5">
      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',      value: guests.length,                              color: 'text-ink' },
          { label: 'Allowed',    value: guests.filter(g => g.status === 'allow').length, color: 'text-green-700' },
          { label: 'Blocked',    value: guests.filter(g => g.status === 'block').length, color: 'text-rose' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-rule p-4 text-center">
            <p className={clsx('text-[24px] font-light font-display', stat.color)}>{stat.value}</p>
            <p className="text-[9px] tracking-[2px] uppercase text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Add single guest ── */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-4">➕ Add / Update Guest</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelClass}>Email *</label>
            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGuest() }}
              type="email"
              className={inputClass}
              placeholder="guest@email.com"
            />
          </div>
          <div>
            <label className={labelClass}>Name (optional)</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className={inputClass}
              placeholder="Guest's name"
            />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as 'allow' | 'block')}
              className={inputClass}
            >
              <option value="allow">Allow</option>
              <option value="block">Block</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Seats (incl. guest)</label>
            <input
              value={newSeats}
              onChange={e => setNewSeats(Math.max(1, parseInt(e.target.value) || 1))}
              type="number"
              min={1}
              max={20}
              className={inputClass}
            />
          </div>
        </div>
        <button
          onClick={addGuest}
          disabled={adding}
          className="bg-rose text-white text-[10px] tracking-[2px] uppercase px-5 py-2 hover:bg-rosedark transition-colors disabled:opacity-60"
        >
          {adding ? 'Saving…' : 'Add / Update'}
        </button>
      </div>

      {/* ── Bulk import ── */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-2">📋 Bulk Import</h4>
        <p className="text-[11px] text-muted italic mb-3">One email per line. All will be set to &ldquo;allow&rdquo; with the seat count below.</p>
        <textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          className={clsx(inputClass, 'resize-y min-h-[100px] mb-3')}
          placeholder={'guest1@email.com\nguest2@email.com'}
        />
        <div className="flex items-end gap-3">
          <div className="w-32">
            <label className={labelClass}>Seats per guest</label>
            <input
              value={bulkSeats}
              onChange={e => setBulkSeats(Math.max(1, parseInt(e.target.value) || 1))}
              type="number"
              min={1}
              max={20}
              className={inputClass}
            />
          </div>
          <button
            onClick={bulkImport}
            disabled={importing}
            className="bg-rose text-white text-[10px] tracking-[2px] uppercase px-5 py-2 hover:bg-rosedark transition-colors disabled:opacity-60"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>

      {/* ── Guest list table ── */}
      <div className="bg-white border border-rule p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h4 className="text-[9px] tracking-[3px] uppercase text-rose">Guest List ({guests.length})</h4>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-rule bg-cream text-[12px] text-ink outline-none focus:border-rose transition-colors w-48"
            placeholder="Search email or name…"
          />
        </div>

        {loading ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-muted italic">
            {search ? 'No matches found.' : 'No guests yet. Add one above.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left py-2 pr-3 text-[9px] tracking-[2px] uppercase text-muted font-normal">Email</th>
                  <th className="text-left py-2 pr-3 text-[9px] tracking-[2px] uppercase text-muted font-normal">Name</th>
                  <th className="text-center py-2 pr-3 text-[9px] tracking-[2px] uppercase text-muted font-normal">Status</th>
                  <th className="text-center py-2 pr-3 text-[9px] tracking-[2px] uppercase text-muted font-normal">Seats</th>
                  <th className="py-2 text-[9px] tracking-[2px] uppercase text-muted font-normal"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {filtered.map(g => (
                  <tr key={g.id} className="hover:bg-cream/50 transition-colors">
                    <td className="py-2 pr-3 text-ink max-w-[180px] truncate">{g.email}</td>
                    <td className="py-2 pr-3 text-muted max-w-[120px] truncate">{g.name ?? '—'}</td>
                    <td className="py-2 pr-3 text-center">
                      <button
                        onClick={() => updateGuest(g.id, { status: g.status === 'allow' ? 'block' : 'allow' })}
                        title="Toggle status"
                      >
                        {statusBadge(g.status)}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={g.seats}
                        onBlur={e => {
                          const v = Math.max(1, parseInt(e.target.value) || 1)
                          if (v !== g.seats) updateGuest(g.id, { seats: v })
                        }}
                        className="w-14 text-center px-1 py-0.5 border border-rule bg-cream text-[12px] outline-none focus:border-rose transition-colors"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => deleteGuest(g.id)}
                        className="text-rose text-[11px] hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
