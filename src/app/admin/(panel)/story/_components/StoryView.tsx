'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import type { GalleryPhoto } from '@/lib/schema'
import type { StoryChapter } from '@/types'
import { STORY_CHAPTERS } from '@/lib/constants'
import { adminFetch, errorMessage, uploadImage } from '@/app/admin/_lib/api'
import { useAdminConfig, useUnsavedWarning } from '@/app/admin/_lib/useAdminConfig'
import { PageHeader } from '@/app/admin/_ui/PageHeader'
import { Button, ConfirmButton, Group, Row } from '@/app/admin/_ui/primitives'
import { LoadState, TextRow } from '@/app/admin/_ui/forms'

const SLOT_LABELS = ['Chapter I', 'Chapter II', 'Chapter III', 'Chapter IV', 'The Proposal', 'Chapter ∞'] as const

/** Saved chapter text, or the site defaults when nothing valid is saved. */
function parseChapters(raw: string | null | undefined): StoryChapter[] {
  if (!raw) return STORY_CHAPTERS
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length === STORY_CHAPTERS.length ? (parsed as StoryChapter[]) : STORY_CHAPTERS
  } catch {
    return STORY_CHAPTERS
  }
}

export function StoryView() {
  const { config, set, loading, error, dirty, saving, save } = useAdminConfig()
  useUnsavedWarning(dirty)
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [uploading, setUploading] = useState<number | null>(null)
  const chapters = parseChapters(config.storyChapters)

  const loadPhotos = useCallback(async () => {
    try {
      setPhotos((await adminFetch<{ photos?: GalleryPhoto[] }>('/api/admin/story')).photos ?? [])
    } catch (problem) {
      toast.error(errorMessage(problem))
    }
  }, [])
  useEffect(() => { loadPhotos() }, [loadPhotos])

  const updateChapter = (id: number, field: 'caption' | 'stamp' | 'emoji', value: string) =>
    set('storyChapters', JSON.stringify(chapters.map(chapter => (chapter.id === id ? { ...chapter, [field]: value } : chapter))))

  const uploadForSlot = async (slot: number, file: File) => {
    setUploading(slot)
    try {
      const image = await uploadImage(file, 'wedding/story')
      await adminFetch('/api/admin/gallery', { method: 'POST', body: { url: image.url, publicId: image.publicId, album: 'story', storySlot: slot } })
      toast.success('Photo updated')
      await loadPhotos()
    } catch (problem) {
      toast.error(errorMessage(problem))
    } finally {
      setUploading(null)
    }
  }

  const removePhoto = async (photo: GalleryPhoto) => {
    try {
      await adminFetch(`/api/admin/story?id=${photo.id}`, { method: 'DELETE' })
      setPhotos(current => current.filter(item => item.id !== photo.id))
      toast.success('Photo removed')
    } catch (problem) {
      toast.error(errorMessage(problem))
    }
  }

  return (
    <>
      <PageHeader title="Story" subtitle={dirty ? 'You have unsaved changes.' : undefined}>
        <Button tone="primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
      </PageHeader>
      <LoadState loading={loading} error={error} />

      {!loading && !error && (
        <div className="md:grid md:grid-cols-2 md:gap-x-6">
          {SLOT_LABELS.map((label, index) => {
            const slot = index + 1
            const chapter = chapters.find(item => item.id === slot) ?? STORY_CHAPTERS[index]
            const photo = photos.find(item => item.storySlot === slot)
            const busy = uploading === slot
            return (
              <Group key={slot} label={label}>
                <Row className="flex items-center gap-3">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/[0.05] text-[11px] text-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photo ? <img src={photo.url} alt="" className="h-full w-full object-cover" /> : 'No photo'}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-black/45">Photos save as soon as they upload. Without one, the symbol below is shown.</span>
                  <label className={clsx('shrink-0 cursor-pointer rounded-full bg-black/[0.055] px-4 py-2.5 text-[15px] font-medium text-black/85', busy && 'pointer-events-none opacity-40')}>
                    {busy ? 'Uploading…' : photo ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/*" className="sr-only" disabled={busy}
                      onChange={event => { const file = event.target.files?.[0]; if (file) uploadForSlot(slot, file); event.target.value = '' }} />
                  </label>
                  {photo && <ConfirmButton confirmText="Tap again" onConfirm={() => removePhoto(photo)}>Remove</ConfirmButton>}
                </Row>
                <TextRow label="Caption" value={chapter.caption} onChange={value => updateChapter(slot, 'caption', value)} />
                <TextRow label="Stamp" value={chapter.stamp} onChange={value => updateChapter(slot, 'stamp', value)} />
                <TextRow label="Symbol shown without a photo" value={chapter.emoji} onChange={value => updateChapter(slot, 'emoji', value)} />
              </Group>
            )
          })}
        </div>
      )}
    </>
  )
}
