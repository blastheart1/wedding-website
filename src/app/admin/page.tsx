'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { toast }    from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import type { RSVP, WeddingConfig, GalleryPhoto } from '@/lib/schema'
import clsx from 'clsx'

// ─── Admin auth hook — validates with server before granting access ────────────
function useAdminAuth() {
  const [password, setPassword] = useState('')
  const [authed,   setAuthed]   = useState(false)
  const [checking, setChecking] = useState(false)
  const [error,    setError]    = useState('')

  const login = useCallback(async (pw: string) => {
    setChecking(true)
    setError('')
    try {
      const res = await fetch('/api/admin', {
        headers: { 'x-admin-password': pw },
      })
      if (res.ok) {
        setPassword(pw)
        setAuthed(true)
      } else {
        setError('Wrong password — try again')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setChecking(false)
    }
  }, [])

  return { password, authed, checking, error, login }
}

// ─── Main admin component ──────────────────────────────────────────────────────
export default function AdminPage() {
  const { password, authed, checking, error, login } = useAdminAuth()
  const [tab,    setTab]    = useState<'settings' | 'rsvps' | 'gallery'>('settings')
  const [rsvps,  setRsvps]  = useState<RSVP[]>([])
  const [config, setConfig] = useState<Partial<WeddingConfig>>({})
  const [stats,  setStats]  = useState({ total: 0, attending: 0, declining: 0 })

  const headers = { 'x-admin-password': password }

  const fetchData = useCallback(async () => {
    const res  = await fetch('/api/admin', { headers })
    const json = await res.json()
    if (res.ok) {
      setRsvps(json.rsvps   ?? [])
      setConfig(json.config ?? {})
      setStats(json.stats   ?? { total: 0, attending: 0, declining: 0 })
    } else {
      toast.error('Session expired — please reload')
    }
  }, [password]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (authed) fetchData() }, [authed, fetchData])

  const saveConfig = async () => {
    const res = await fetch('/api/admin', {
      method:  'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body:    JSON.stringify(config),
    })
    if (res.ok) toast.success('Settings saved!')
    else        toast.error('Save failed')
  }

  // Blob-based export — password stays in header, never in URL
  const exportExcel = async () => {
    try {
      const res = await fetch('/api/admin/export', { headers })
      if (!res.ok) { toast.error('Export failed'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'Luis_Bee_RSVPs.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed — please try again')
    }
  }

  // ── Password gate ────────────────────────────────────────────────────────────
  if (!authed) {
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
          <PasswordGate onLogin={login} checking={checking} error={error} />
        </motion.div>
      </div>
    )
  }

  const tabClass = (t: string) => clsx(
    'px-5 py-2 text-[10px] tracking-[2px] uppercase border transition-colors cursor-pointer',
    tab === t
      ? 'bg-rose text-white border-rose'
      : 'bg-white text-muted border-rule hover:bg-petal',
  )

  return (
    <div className="min-h-screen bg-cream p-6">
      {/* Header */}
      <div className="bg-white border border-rule p-6 mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-light text-ink">Luis & Bee — Admin</h1>
          <p className="text-[12px] text-muted mt-1">Wedding management</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['settings', 'rsvps', 'gallery'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={tabClass(t)}>
              {t === 'settings' ? 'Settings' : t === 'rsvps' ? `RSVPs (${stats.total})` : 'Gallery'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'settings' && (
        <SettingsTab config={config} setConfig={setConfig} onSave={saveConfig} />
      )}
      {tab === 'rsvps' && (
        <RSVPsTab rsvps={rsvps} stats={stats} onExport={exportExcel} />
      )}
      {tab === 'gallery' && (
        <GalleryTab password={password} />
      )}
    </div>
  )
}

// ─── Password gate ─────────────────────────────────────────────────────────────
function PasswordGate({
  onLogin, checking, error,
}: {
  onLogin:  (pw: string) => void
  checking: boolean
  error:    string
}) {
  const [value, setValue] = useState('')

  return (
    <div className="space-y-4">
      <input
        type="password"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !checking && onLogin(value)}
        className="w-full px-4 py-3 border border-rule bg-cream text-ink outline-none focus:border-rose text-[14px]"
        placeholder="Admin password"
        disabled={checking}
      />
      {error && (
        <p className="text-rose text-[11px] text-left">{error}</p>
      )}
      <button
        onClick={() => onLogin(value)}
        disabled={checking || !value}
        className="w-full bg-rose text-white py-3 text-[10px] tracking-[3px] uppercase hover:bg-rosedark disabled:opacity-60 transition-colors"
      >
        {checking ? 'Checking…' : 'Enter'}
      </button>
    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────
function SettingsTab({
  config, setConfig, onSave,
}: {
  config:    Partial<WeddingConfig>
  setConfig: (c: Partial<WeddingConfig>) => void
  onSave:    () => void
}) {
  const field = (key: keyof WeddingConfig, label: string, placeholder = '') => (
    <div className="mb-3" key={key}>
      <label className="block text-[11px] text-muted mb-1">{label}</label>
      <input
        value={(config[key] as string) ?? ''}
        onChange={e => setConfig({ ...config, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-rule bg-cream text-[13px] text-ink outline-none focus:border-rose focus:bg-white transition-colors"
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="🌸 Couple">
        {field('partner1', 'Partner 1', 'Luis')}
        {field('partner2', 'Partner 2', 'Bee')}
        <SaveButton onSave={onSave} />
      </Card>
      <Card title="📅 Wedding Date">
        {field('weddingDate',   'Date (YYYY-MM-DD)', '2027-02-27')}
        {field('ceremonyTime',  'Ceremony time',     '3:00 PM')}
        {field('receptionTime', 'Reception time',    '6:00 PM')}
        {field('rsvpDeadline',  'RSVP deadline',     'January 27, 2027')}
        <SaveButton onSave={onSave} />
      </Card>
      <Card title="📍 Venue">
        {field('ceremonyVenue',  'Ceremony venue',  'TBA')}
        {field('location',       'City / Location', 'TBA')}
        {field('receptionVenue', 'Reception venue', 'TBA')}
        <SaveButton onSave={onSave} />
      </Card>
      <Card title="🏨 Hotel">
        {field('hotelName',     'Hotel name', 'TBA')}
        {field('hotelCode',     'Promo code', 'LUISBEE2027')}
        {field('hotelDiscount', 'Discount',   '20%')}
        <SaveButton onSave={onSave} />
      </Card>
      <Card title="👗 Guest Notes" className="md:col-span-2">
        {field('dressCode', 'Dress code', 'Garden formal — spring & pastel tones')}
        <div className="mb-3">
          <label className="block text-[11px] text-muted mb-1">Special notes for guests</label>
          <textarea
            value={config.guestNotes ?? ''}
            onChange={e => setConfig({ ...config, guestNotes: e.target.value })}
            className="w-full px-3 py-2 border border-rule bg-cream text-[13px] text-ink outline-none focus:border-rose focus:bg-white transition-colors resize-y min-h-[80px]"
            placeholder="Any special instructions…"
          />
        </div>
        <SaveButton onSave={onSave} />
      </Card>
    </div>
  )
}

// ─── RSVPs tab ────────────────────────────────────────────────────────────────
function RSVPsTab({ rsvps, stats, onExport }: {
  rsvps:    RSVP[]
  stats:    { total: number; attending: number; declining: number }
  onExport: () => void
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total RSVPs', value: stats.total,     bg: 'bg-lavender' },
          { label: 'Attending',   value: stats.attending, bg: 'bg-sage'     },
          { label: 'Declining',   value: stats.declining, bg: 'bg-petal'    },
        ].map(s => (
          <div key={s.label} className={clsx('p-5 text-center border border-rule', s.bg)}>
            <div className="font-display text-[40px] font-light text-ink">{s.value}</div>
            <div className="text-[10px] tracking-[2px] uppercase text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mb-3 flex-wrap gap-3">
        <span className="text-[12px] text-muted">
          {stats.total} response{stats.total !== 1 ? 's' : ''} · {stats.attending} attending · {stats.declining} declining
        </span>
        <button
          onClick={onExport}
          className="flex items-center gap-2 bg-white border border-rule px-4 py-2 text-[10px] tracking-[2px] uppercase text-ink2 hover:bg-sage transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v7M4 5.5l2.5 2.5L9 5.5M1.5 9.5v.5A1.5 1.5 0 003 11.5h7A1.5 1.5 0 0011.5 10v-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Export Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white border border-rule text-[13px]">
          <thead>
            <tr className="bg-petal">
              {['#','Name','Email','Attending','Meal','Song','Plus One','Date'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[9px] tracking-[2.5px] uppercase text-muted border-b border-rule font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rsvps.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted font-display italic text-[17px]">
                  RSVPs will appear here as guests respond
                </td>
              </tr>
            ) : (
              rsvps.map((r, i) => (
                <tr key={r.id} className="border-b border-rule last:border-b-0 hover:bg-cream transition-colors">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-ink2">{r.email}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'px-3 py-1 text-[9px] tracking-[1.5px] uppercase font-medium',
                      r.attending ? 'bg-sage text-forest' : 'bg-petal text-rose',
                    )}>
                      {r.attending ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink2">{r.meal        ?? '—'}</td>
                  <td className="px-4 py-3 text-ink2">{r.songRequest ?? '—'}</td>
                  <td className="px-4 py-3 text-ink2">{r.plusOne ? `Yes — ${r.plusOneName ?? ''}` : 'No'}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Gallery tab ──────────────────────────────────────────────────────────────
function GalleryTab({ password }: { password: string }) {
  const [photos,    setPhotos]    = useState<GalleryPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [caption,   setCaption]   = useState('')
  const [editId,    setEditId]    = useState<number | null>(null)
  const [editCap,   setEditCap]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const headers = { 'x-admin-password': password }

  const loadPhotos = useCallback(async () => {
    const res  = await fetch('/api/admin/gallery', { headers })
    const json = await res.json()
    setPhotos(json.photos ?? [])
  }, [password]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadPhotos() }, [loadPhotos])

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      // 1. Get upload signature from server
      const timestamp    = Math.round(Date.now() / 1000)
      const folder       = 'wedding'
      const paramsToSign = { timestamp: String(timestamp), folder }

      const signRes  = await fetch('/api/admin/gallery/sign', {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paramsToSign }),
      })
      const { signature, apiKey, cloudName } = await signRes.json() as {
        signature: string; apiKey: string; cloudName: string
      }

      // 2. Upload directly to Cloudinary
      const form = new FormData()
      form.append('file',      file)
      form.append('signature', signature)
      form.append('api_key',   apiKey)
      form.append('timestamp', String(timestamp))
      form.append('folder',    folder)

      const uploadRes  = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: form },
      )
      const uploadData = await uploadRes.json() as { secure_url: string; public_id: string }

      if (!uploadData.secure_url) throw new Error('Upload failed')

      // 3. Save URL to DB
      await fetch('/api/admin/gallery', {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          url:      uploadData.secure_url,
          publicId: uploadData.public_id,
          caption:  caption.trim() || undefined,
        }),
      })

      toast.success('Photo uploaded!')
      setCaption('')
      if (fileRef.current) fileRef.current.value = ''
      loadPhotos()
    } catch (err) {
      toast.error('Upload failed — please try again')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const deletePhoto = async (id: number) => {
    if (!confirm('Remove this photo?')) return
    await fetch(`/api/admin/gallery?id=${id}`, { method: 'DELETE', headers })
    setPhotos(prev => prev.filter(p => p.id !== id))
    toast.success('Photo removed')
  }

  const saveCaption = async (id: number) => {
    await fetch('/api/admin/gallery', {
      method:  'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, caption: editCap }),
    })
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption: editCap } : p))
    setEditId(null)
    toast.success('Caption saved')
  }

  return (
    <div className="space-y-5">
      {/* Upload panel */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-4">📷 Upload Photo</h4>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] text-muted mb-1">Caption (optional)</label>
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="w-full px-3 py-2 border border-rule bg-cream text-[13px] text-ink outline-none focus:border-rose transition-colors"
              placeholder="e.g. Engagement shoot"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-rose text-white text-[10px] tracking-[2px] uppercase px-6 py-[10px] hover:bg-rosedark disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {uploading ? 'Uploading…' : '+ Choose & Upload'}
          </button>
        </div>
        <p className="text-[11px] text-muted mt-3 italic">
          Images are uploaded directly to Cloudinary and optimised automatically.
          First photo in the list will appear as the featured (wide) image.
        </p>
      </div>

      {/* Photo grid */}
      <div className="bg-white border border-rule p-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-[9px] tracking-[3px] uppercase text-rose">
            Gallery ({photos.length} photo{photos.length !== 1 ? 's' : ''})
          </h4>
        </div>

        {photos.length === 0 ? (
          <p className="text-muted text-[13px] italic text-center py-10">
            No photos yet — upload your first one above.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AnimatePresence>
              {photos.map(photo => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{    opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="border border-rule overflow-hidden group"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={photo.url}
                      alt={photo.caption ?? 'Gallery photo'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => { setEditId(photo.id); setEditCap(photo.caption ?? '') }}
                        className="bg-white text-ink text-[9px] tracking-[1px] uppercase px-2 py-1 hover:bg-petal"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="bg-rose text-white text-[9px] tracking-[1px] uppercase px-2 py-1 hover:bg-rosedark"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Inline caption editor */}
                  {editId === photo.id ? (
                    <div className="p-2 flex gap-1">
                      <input
                        value={editCap}
                        onChange={e => setEditCap(e.target.value)}
                        className="flex-1 text-[11px] border border-rule px-2 py-1 outline-none focus:border-rose bg-cream"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && saveCaption(photo.id)}
                      />
                      <button onClick={() => saveCaption(photo.id)} className="text-[10px] text-rose px-1">✓</button>
                      <button onClick={() => setEditId(null)} className="text-[10px] text-muted px-1">✕</button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted px-2 py-1 truncate">
                      {photo.caption ?? <em className="opacity-50">No caption</em>}
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white border border-rule p-6', className)}>
      <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-4">{title}</h4>
      {children}
    </div>
  )
}

function SaveButton({ onSave }: { onSave: () => void }) {
  return (
    <button
      onClick={onSave}
      className="bg-rose text-white text-[10px] tracking-[2px] uppercase px-5 py-2 hover:bg-rosedark transition-colors mt-2"
    >
      Save
    </button>
  )
}
