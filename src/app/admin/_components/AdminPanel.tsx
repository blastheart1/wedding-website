'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast }    from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { RSVP, WeddingConfig, GalleryPhoto } from '@/lib/schema'
import clsx from 'clsx'

/** Ensures the httpOnly admin session cookie is always sent. */
const cred: RequestCredentials = 'include'

type Tab = 'settings' | 'rsvps' | 'gallery' | 'story'

export function AdminPanel() {
  const router = useRouter()
  const [tab,    setTab]    = useState<Tab>('settings')
  const [rsvps,  setRsvps]  = useState<RSVP[]>([])
  const [config, setConfig] = useState<Partial<WeddingConfig>>({})
  const [stats,  setStats]  = useState({ total: 0, attending: 0, declining: 0 })

  const fetchData = useCallback(async () => {
    const res  = await fetch('/api/admin', { credentials: cred })
    const json = await res.json()
    if (res.ok) {
      setRsvps(json.rsvps   ?? [])
      setConfig(json.config ?? {})
      setStats(json.stats   ?? { total: 0, attending: 0, declining: 0 })
    } else {
      toast.error('Session expired — please log in again')
      router.push('/admin/login')
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const saveConfig = async () => {
    const res = await fetch('/api/admin', {
      method:      'POST',
      credentials: cred,
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(config),
    })
    if (res.ok) {
      toast.success('Settings saved!')
      router.refresh()
    } else {
      toast.error('Save failed')
    }
  }

  const exportExcel = async () => {
    try {
      const res = await fetch('/api/admin/export', { credentials: cred })
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

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: cred })
    router.push('/admin/login')
  }

  const tabClass = (t: Tab) => clsx(
    'px-5 py-2 text-[10px] tracking-[2px] uppercase border transition-colors cursor-pointer',
    tab === t
      ? 'bg-rose text-white border-rose'
      : 'bg-white text-muted border-rule hover:bg-petal',
  )

  const TAB_LABELS: Record<Tab, string> = {
    settings: 'Settings',
    rsvps:    `RSVPs (${stats.total})`,
    gallery:  'Gallery',
    story:    'Story',
  }

  return (
    <div className="min-h-screen bg-cream p-6">
      {/* Header */}
      <div className="bg-white border border-rule p-6 mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-light text-ink">Luis & Bee — Admin</h1>
          <p className="text-[12px] text-muted mt-1">Wedding management</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {(['settings', 'rsvps', 'gallery', 'story'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={tabClass(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
          <button
            onClick={logout}
            className="px-5 py-2 text-[10px] tracking-[2px] uppercase border border-rule bg-white text-muted hover:bg-petal transition-colors ml-2"
          >
            Log out
          </button>
        </div>
      </div>

      {tab === 'settings' && (
        <SettingsTab config={config} setConfig={setConfig} onSave={saveConfig} />
      )}
      {tab === 'rsvps' && (
        <RSVPsTab rsvps={rsvps} stats={stats} onExport={exportExcel} />
      )}
      {tab === 'gallery' && (
        <GalleryTab />
      )}
      {tab === 'story' && (
        <StoryTab config={config} setConfig={setConfig} onSave={saveConfig} />
      )}
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
      <Card title="🎬 Hero Video" className="md:col-span-2">
        {field('heroVideoUrl', 'Video URL', 'https://res.cloudinary.com/your-cloud/video/upload/wedding-story.mp4')}
        <p className="text-[11px] text-muted italic mb-2">
          Upload your video to Cloudinary, then paste the URL here. Leave blank for a static background.
        </p>
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
      <SectionBgCard config={config} setConfig={setConfig} onSave={onSave} />
      <SectionHeadingsCard config={config} setConfig={setConfig} onSave={onSave} />
    </div>
  )
}

// ─── Section background image upload card ────────────────────────────────────
const BG_SECTIONS = [
  { key: 'heroBgUrl'      as keyof WeddingConfig, label: 'Hero',      hint: 'Used when no video is set' },
  { key: 'storyBgUrl'     as keyof WeddingConfig, label: 'Story',     hint: '"A Story Worth Telling" section' },
  { key: 'countdownBgUrl' as keyof WeddingConfig, label: 'Countdown', hint: 'Behind the flip-clock numbers' },
  { key: 'detailsBgUrl'   as keyof WeddingConfig, label: 'Details',   hint: 'Event details section' },
  { key: 'galleryBgUrl'   as keyof WeddingConfig, label: 'Gallery',   hint: 'Behind the photo stack' },
]

function SectionBgCard({
  config, setConfig, onSave,
}: {
  config:    Partial<WeddingConfig>
  setConfig: (c: Partial<WeddingConfig>) => void
  onSave:    () => void
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState<string | null>(null)

  const uploadBg = async (sectionKey: keyof WeddingConfig, file: File) => {
    setUploading(sectionKey)
    try {
      const timestamp    = Math.round(Date.now() / 1000)
      const folder       = 'wedding/backgrounds'
      const paramsToSign = { timestamp: String(timestamp), folder }

      const signRes = await fetch('/api/admin/gallery/sign', {
        method: 'POST', credentials: cred,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign }),
      })
      if (!signRes.ok) {
        if (signRes.status === 401) { toast.error('Session expired'); router.push('/admin/login') }
        else toast.error('Could not sign upload')
        return
      }
      const { signature, apiKey, cloudName } = await signRes.json() as {
        signature: string; apiKey: string; cloudName: string
      }

      const form = new FormData()
      form.append('file', file)
      form.append('signature', signature)
      form.append('api_key', apiKey)
      form.append('timestamp', String(timestamp))
      form.append('folder', folder)

      const uploadRes  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form })
      const uploadData = await uploadRes.json() as { secure_url?: string; error?: { message?: string } }

      if (!uploadRes.ok || !uploadData.secure_url) {
        throw new Error(uploadData.error?.message ?? `Upload failed (${uploadRes.status})`)
      }

      setConfig({ ...config, [sectionKey]: uploadData.secure_url })
      toast.success('Background uploaded — click Save to apply')
    } catch {
      toast.error('Upload failed — please try again')
    } finally {
      setUploading(null)
    }
  }

  return (
    <Card title="🖼️ Section Backgrounds" className="md:col-span-2">
      <p className="text-[11px] text-muted italic mb-4">
        Set a background image for each section. Leave blank to use the default pastel colour.
        Upload an image, then click Save to apply.
      </p>
      <div className="space-y-4">
        {BG_SECTIONS.map(({ key, label, hint }) => {
          const url = (config[key] as string) ?? ''
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 border border-rule p-3 bg-cream">
              {/* Thumbnail */}
              <div className="w-16 h-16 border border-rule flex-shrink-0 overflow-hidden bg-white flex items-center justify-center">
                {url ? (
                  <Image src={url} alt={label} width={64} height={64} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-[10px] text-muted">None</span>
                )}
              </div>
              {/* Labels */}
              <div className="flex-1 min-w-[140px]">
                <p className="text-[12px] font-medium text-ink">{label}</p>
                <p className="text-[10px] text-muted">{hint}</p>
              </div>
              {/* Actions */}
              <div className="flex gap-2 items-center">
                <label className={clsx(
                  'text-[10px] tracking-[1.5px] uppercase px-3 py-[7px] border cursor-pointer transition-colors',
                  uploading === key
                    ? 'bg-rule text-muted border-rule opacity-60 pointer-events-none'
                    : 'bg-white border-rule text-ink hover:bg-petal',
                )}>
                  {uploading === key ? 'Uploading…' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading === key}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadBg(key, f) }}
                  />
                </label>
                {url && (
                  <button
                    onClick={() => setConfig({ ...config, [key]: '' })}
                    className="text-[10px] tracking-[1.5px] uppercase px-3 py-[7px] border border-rule bg-white text-rose hover:bg-petal transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <SaveButton onSave={onSave} />
    </Card>
  )
}

// ─── Section Headings card ────────────────────────────────────────────────────
const HEADING_SECTIONS = [
  { key: 'story',     label: 'Story'    },
  { key: 'countdown', label: 'Countdown'},
  { key: 'details',   label: 'Details'  },
  { key: 'gallery',   label: 'Gallery'  },
  { key: 'rsvp',      label: 'RSVP'    },
] as const

const DEFAULT_HEADINGS_ADMIN = {
  story:     { eyebrow: 'Luis & Bee',     heading: 'A story worth',  italic: 'telling'  },
  countdown: { eyebrow: 'Counting down',  heading: 'Until we say',   italic: 'forever'  },
  details:   { eyebrow: 'Event Details',  heading: 'Mark your',      italic: 'calendar' },
  gallery:   { eyebrow: 'Luis & Bee',     heading: 'Moments we',     italic: 'cherish'  },
  rsvp:      { eyebrow: "You're invited", heading: 'Will you',       italic: 'join us?' },
}

function SectionHeadingsCard({
  config, setConfig, onSave,
}: {
  config:    Partial<WeddingConfig>
  setConfig: (c: Partial<WeddingConfig>) => void
  onSave:    () => void
}) {
  const parsed = (() => {
    try {
      const raw = config.sectionHeadings as string | undefined
      if (!raw) return DEFAULT_HEADINGS_ADMIN
      const p = JSON.parse(raw)
      return {
        story:     { ...DEFAULT_HEADINGS_ADMIN.story,     ...p.story     },
        countdown: { ...DEFAULT_HEADINGS_ADMIN.countdown, ...p.countdown },
        details:   { ...DEFAULT_HEADINGS_ADMIN.details,   ...p.details   },
        gallery:   { ...DEFAULT_HEADINGS_ADMIN.gallery,   ...p.gallery   },
        rsvp:      { ...DEFAULT_HEADINGS_ADMIN.rsvp,      ...p.rsvp      },
      }
    } catch {
      return DEFAULT_HEADINGS_ADMIN
    }
  })()

  const update = (section: keyof typeof parsed, field: 'eyebrow' | 'heading' | 'italic', value: string) => {
    const next = { ...parsed, [section]: { ...parsed[section], [field]: value } }
    setConfig({ ...config, sectionHeadings: JSON.stringify(next) })
  }

  return (
    <Card title="✏️ Section Headings" className="md:col-span-2">
      <p className="text-[11px] text-muted italic mb-4">
        Edit the eyebrow, heading, and italic portion for each section.
      </p>
      <div className="space-y-3">
        {HEADING_SECTIONS.map(({ key, label }) => {
          const h = parsed[key]
          return (
            <div key={key} className="border border-rule bg-cream p-3">
              <p className="text-[11px] font-medium text-ink mb-2">{label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['eyebrow', 'heading', 'italic'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-[9px] tracking-[1.5px] uppercase text-muted mb-1">{field}</label>
                    <input
                      value={h[field]}
                      onChange={e => update(key, field, e.target.value)}
                      className="w-full px-2 py-1.5 border border-rule bg-white text-[13px] outline-none focus:border-rose transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <SaveButton onSave={onSave} />
    </Card>
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
function SortablePhotoCard({
  photo,
  onToggleVisible,
  onEdit,
  onDelete,
}: {
  photo:           GalleryPhoto
  onToggleVisible: (id: number, v: boolean) => void
  onEdit:          (id: number, cap: string) => void
  onDelete:        (id: number) => void
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: photo.id })

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
  }

  const [editMode, setEditMode] = useState(false)
  const [cap,      setCap]      = useState(photo.caption ?? '')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'border border-rule overflow-hidden group',
        !photo.visible && 'opacity-50',
      )}
    >
      {/* Drag handle area */}
      <div
        {...attributes}
        {...listeners}
        className="h-4 bg-cream flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <div className="flex gap-[3px]">
          {[0,1,2,3,4,5].map(d => <div key={d} className="w-[3px] h-[3px] rounded-full bg-rule" />)}
        </div>
      </div>

      <div className="relative aspect-square">
        <Image
          src={photo.url}
          alt={photo.caption ?? 'Gallery photo'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {!photo.visible && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/30">
            <span className="text-white text-[9px] tracking-[1.5px] uppercase bg-ink/70 px-2 py-0.5">Hidden</span>
          </div>
        )}
        <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => onToggleVisible(photo.id, !photo.visible)}
            className="bg-white text-ink text-[9px] tracking-[1px] uppercase px-2 py-1 hover:bg-petal"
          >
            {photo.visible ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={() => { setEditMode(true); setCap(photo.caption ?? '') }}
            className="bg-white text-ink text-[9px] tracking-[1px] uppercase px-2 py-1 hover:bg-petal"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(photo.id)}
            className="bg-rose text-white text-[9px] tracking-[1px] uppercase px-2 py-1 hover:bg-rosedark"
          >
            Del
          </button>
        </div>
      </div>

      {editMode ? (
        <div className="p-2 flex gap-1">
          <input
            value={cap}
            onChange={e => setCap(e.target.value)}
            className="flex-1 text-[11px] border border-rule px-2 py-1 outline-none focus:border-rose bg-cream"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { onEdit(photo.id, cap); setEditMode(false) } }}
          />
          <button onClick={() => { onEdit(photo.id, cap); setEditMode(false) }} className="text-[10px] text-rose px-1">✓</button>
          <button onClick={() => setEditMode(false)} className="text-[10px] text-muted px-1">✕</button>
        </div>
      ) : (
        <p className="text-[11px] text-muted px-2 py-1 truncate">
          {photo.caption ?? <em className="opacity-50">No caption</em>}
        </p>
      )}
    </div>
  )
}

function GalleryTab() {
  const router = useRouter()
  const [photos,    setPhotos]    = useState<GalleryPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [caption,   setCaption]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const loadPhotos = useCallback(async () => {
    const res  = await fetch('/api/admin/gallery', { credentials: cred })
    const json = await res.json()
    setPhotos(json.photos ?? [])
  }, [])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const timestamp    = Math.round(Date.now() / 1000)
      const folder       = 'wedding'
      const paramsToSign = { timestamp: String(timestamp), folder }

      const signRes = await fetch('/api/admin/gallery/sign', {
        method: 'POST', credentials: cred,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign }),
      })
      if (!signRes.ok) {
        if (signRes.status === 401) { toast.error('Session expired'); router.push('/admin/login') }
        else toast.error('Could not authorize upload')
        return
      }
      const { signature, apiKey, cloudName } = await signRes.json() as {
        signature: string; apiKey: string; cloudName: string
      }

      const form = new FormData()
      form.append('file', file)
      form.append('signature', signature)
      form.append('api_key', apiKey)
      form.append('timestamp', String(timestamp))
      form.append('folder', folder)

      const uploadRes  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form })
      const uploadData = await uploadRes.json() as { secure_url?: string; public_id?: string; error?: { message?: string } }

      if (!uploadRes.ok || !uploadData.secure_url) {
        throw new Error(uploadData.error?.message ?? `Upload failed (${uploadRes.status})`)
      }

      const saveRes = await fetch('/api/admin/gallery', {
        method: 'POST', credentials: cred,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: uploadData.secure_url, publicId: uploadData.public_id, caption: caption.trim() || undefined }),
      })
      if (!saveRes.ok) {
        if (saveRes.status === 401) { toast.error('Session expired'); router.push('/admin/login') }
        else toast.error('Could not save photo')
        return
      }

      toast.success('Photo uploaded!')
      setCaption('')
      if (fileRef.current) fileRef.current.value = ''
      loadPhotos()
    } catch {
      toast.error('Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  const toggleVisible = async (id: number, visible: boolean) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, visible } : p))
    await fetch('/api/admin/gallery', {
      method: 'PATCH', credentials: cred,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, visible }),
    })
    toast.success(visible ? 'Photo visible' : 'Photo hidden')
  }

  const saveCaption = async (id: number, cap: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption: cap } : p))
    await fetch('/api/admin/gallery', {
      method: 'PATCH', credentials: cred,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, caption: cap }),
    })
    toast.success('Caption saved')
  }

  const deletePhoto = async (id: number) => {
    if (!confirm('Remove this photo?')) return
    await fetch(`/api/admin/gallery?id=${id}`, { method: 'DELETE', credentials: cred })
    setPhotos(prev => prev.filter(p => p.id !== id))
    toast.success('Photo removed')
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = photos.findIndex(p => p.id === active.id)
    const newIndex = photos.findIndex(p => p.id === over.id)
    const reordered = arrayMove(photos, oldIndex, newIndex)
    setPhotos(reordered)
    await fetch('/api/admin/gallery', {
      method: 'PUT', credentials: cred,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: reordered.map(p => p.id) }),
    })
  }

  return (
    <div className="space-y-5">
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
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} disabled={uploading} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-rose text-white text-[10px] tracking-[2px] uppercase px-6 py-[10px] hover:bg-rosedark disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {uploading ? 'Uploading…' : '+ Choose & Upload'}
          </button>
        </div>
        <p className="text-[11px] text-muted mt-3 italic">
          Drag cards to reorder. Use Hide/Show to control public visibility without deleting.
        </p>
      </div>

      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-4">
          Gallery ({photos.length} photo{photos.length !== 1 ? 's' : ''})
        </h4>

        {photos.length === 0 ? (
          <p className="text-muted text-[13px] italic text-center py-10">
            No photos yet — upload your first one above.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <AnimatePresence>
                  {photos.map(photo => (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{    opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SortablePhotoCard
                        photo={photo}
                        onToggleVisible={toggleVisible}
                        onEdit={saveCaption}
                        onDelete={deletePhoto}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

// ─── Story tab ────────────────────────────────────────────────────────────────
const STORY_SLOTS = [
  { slot: 1, label: 'Chapter I'    },
  { slot: 2, label: 'Chapter II'   },
  { slot: 3, label: 'Chapter III'  },
  { slot: 4, label: 'Chapter IV'   },
  { slot: 5, label: 'The Proposal' },
  { slot: 6, label: 'Chapter ∞'  },
]

const DEFAULT_CHAPTERS = [
  { id: 1, emoji: '☕', caption: 'The beginning of everything',    stamp: 'Chapter I',    bg: 'bg-petal',    rotate: '-4',   delay: 0   },
  { id: 2, emoji: '🌿', caption: 'Adventures, big and small',     stamp: 'Chapter II',   bg: 'bg-sage',     rotate: '2.5',  delay: 140 },
  { id: 3, emoji: '✈️', caption: 'Exploring the world together',  stamp: 'Chapter III',  bg: 'bg-lavender', rotate: '-1.5', delay: 280 },
  { id: 4, emoji: '🎉', caption: 'Every season, better together', stamp: 'Chapter IV',   bg: 'bg-peach',    rotate: '3.5',  delay: 80  },
  { id: 5, emoji: '💍', caption: 'He asked. She said yes.',       stamp: 'The Proposal', bg: 'bg-blush',    rotate: '-5',   delay: 220 },
  { id: 6, emoji: '🌸', caption: 'Feb 27, 2027 — forever begins', stamp: 'Chapter ∞',    bg: 'bg-sage',     rotate: '4',    delay: 360 },
]

function StoryTab({
  config,
  setConfig,
  onSave,
}: {
  config:    Partial<WeddingConfig>
  setConfig: (c: Partial<WeddingConfig>) => void
  onSave:    () => void
}) {
  const router    = useRouter()
  const [photos,    setPhotos]    = useState<GalleryPhoto[]>([])
  const [uploading, setUploading] = useState<number | null>(null)
  const fileRefs  = useRef<Record<number, HTMLInputElement | null>>({})

  // Parse saved chapter text from config; fall back to hardcoded defaults
  const savedChapters = (() => {
    try {
      const raw = config.storyChapters as string | undefined
      if (!raw) return DEFAULT_CHAPTERS
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length === 6 ? parsed : DEFAULT_CHAPTERS
    } catch {
      return DEFAULT_CHAPTERS
    }
  })()

  const updateChapter = (id: number, field: 'caption' | 'stamp' | 'emoji', value: string) => {
    const next = savedChapters.map(c => c.id === id ? { ...c, [field]: value } : c)
    setConfig({ ...config, storyChapters: JSON.stringify(next) })
  }

  const loadPhotos = useCallback(async () => {
    const res  = await fetch('/api/admin/story', { credentials: cred })
    const json = await res.json()
    setPhotos(json.photos ?? [])
  }, [])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  const photoBySlot = new Map<number, GalleryPhoto>()
  photos.forEach(p => { if (p.storySlot !== null) photoBySlot.set(p.storySlot, p) })

  const uploadForSlot = async (slot: number, file: File) => {
    setUploading(slot)
    try {
      const timestamp    = Math.round(Date.now() / 1000)
      const folder       = 'wedding/story'
      const paramsToSign = { timestamp: String(timestamp), folder }

      const signRes = await fetch('/api/admin/gallery/sign', {
        method: 'POST', credentials: cred,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign }),
      })
      if (!signRes.ok) {
        if (signRes.status === 401) { toast.error('Session expired'); router.push('/admin/login') }
        else toast.error('Could not sign upload')
        return
      }
      const { signature, apiKey, cloudName } = await signRes.json() as {
        signature: string; apiKey: string; cloudName: string
      }

      const form = new FormData()
      form.append('file', file)
      form.append('signature', signature)
      form.append('api_key', apiKey)
      form.append('timestamp', String(timestamp))
      form.append('folder', folder)

      const uploadRes  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form })
      const uploadData = await uploadRes.json() as { secure_url?: string; public_id?: string; error?: { message?: string } }

      if (!uploadRes.ok || !uploadData.secure_url) {
        throw new Error(uploadData.error?.message ?? `Upload failed (${uploadRes.status})`)
      }

      // Save photo with album=story and storySlot
      const saveRes = await fetch('/api/admin/gallery', {
        method: 'POST', credentials: cred,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:       uploadData.secure_url,
          publicId:  uploadData.public_id,
          album:     'story',
          storySlot: slot,
        }),
      })
      if (!saveRes.ok) {
        toast.error('Could not save story photo')
        return
      }

      toast.success(`Slot ${slot} updated!`)
      loadPhotos()
    } catch {
      toast.error('Upload failed — please try again')
    } finally {
      setUploading(null)
      const ref = fileRefs.current[slot]
      if (ref) ref.value = ''
    }
  }

  const removeSlot = async (photo: GalleryPhoto) => {
    if (!confirm('Remove this story photo?')) return
    await fetch(`/api/admin/story?id=${photo.id}`, { method: 'DELETE', credentials: cred })
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    toast.success('Story photo removed')
  }

  return (
    <div className="space-y-5">
      {/* ── Chapter Text Editor ────────────────────────────────────────── */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-2">✏️ Chapter Text</h4>
        <p className="text-[11px] text-muted italic mb-5">
          Edit the caption, stamp date, and emoji for each chapter card.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {STORY_SLOTS.map(({ slot, label }) => {
            const ch = savedChapters.find(c => c.id === slot) ?? DEFAULT_CHAPTERS[slot - 1]
            return (
              <div key={slot} className="border border-rule bg-cream p-3 space-y-2">
                <p className="text-[11px] font-medium text-ink">{label}</p>
                <div>
                  <label className="block text-[9px] tracking-[1.5px] uppercase text-muted mb-1">Emoji</label>
                  <input
                    value={ch.emoji}
                    onChange={e => updateChapter(slot, 'emoji', e.target.value)}
                    className="w-full px-2 py-1.5 border border-rule bg-white text-[13px] outline-none focus:border-rose transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] tracking-[1.5px] uppercase text-muted mb-1">Caption</label>
                  <input
                    value={ch.caption}
                    onChange={e => updateChapter(slot, 'caption', e.target.value)}
                    className="w-full px-2 py-1.5 border border-rule bg-white text-[13px] outline-none focus:border-rose transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] tracking-[1.5px] uppercase text-muted mb-1">Stamp</label>
                  <input
                    value={ch.stamp}
                    onChange={e => updateChapter(slot, 'stamp', e.target.value)}
                    className="w-full px-2 py-1.5 border border-rule bg-white text-[13px] outline-none focus:border-rose transition-colors"
                  />
                </div>
              </div>
            )
          })}
        </div>
        <SaveButton onSave={onSave} />
      </div>

      {/* ── Story Photos ───────────────────────────────────────────────── */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-2">📸 Story Photos</h4>
        <p className="text-[11px] text-muted italic mb-5">
          Upload a photo for each chapter slot. If empty, the emoji placeholder is shown.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {STORY_SLOTS.map(({ slot, label }) => {
            const photo   = photoBySlot.get(slot)
            const caption = savedChapters.find(c => c.id === slot)?.caption ?? ''
            return (
              <div key={slot} className="border border-rule bg-cream p-3">
                {/* Slot header */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[11px] font-medium text-ink">{label}</p>
                    <p className="text-[10px] text-muted italic truncate">{caption}</p>
                  </div>
                </div>

                {/* Photo or empty */}
                <div className="relative aspect-square w-full bg-white border border-rule mb-2 overflow-hidden flex items-center justify-center">
                  {photo ? (
                    <Image src={photo.url} alt={label} fill className="object-cover" sizes="200px" />
                  ) : (
                    <span className="text-[10px] text-muted italic">No photo</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <label className={clsx(
                    'flex-1 text-center text-[9px] tracking-[1.5px] uppercase py-[6px] border cursor-pointer transition-colors',
                    uploading === slot
                      ? 'bg-rule text-muted border-rule opacity-60 pointer-events-none'
                      : 'bg-rose text-white border-rose hover:bg-rosedark',
                  )}>
                    {uploading === slot ? 'Uploading…' : photo ? 'Replace' : 'Upload'}
                    <input
                      ref={el => { fileRefs.current[slot] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading === slot}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadForSlot(slot, f) }}
                    />
                  </label>
                  {photo && (
                    <button
                      onClick={() => removeSlot(photo)}
                      className="px-2 py-[6px] border border-rule bg-white text-rose text-[9px] hover:bg-petal transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
