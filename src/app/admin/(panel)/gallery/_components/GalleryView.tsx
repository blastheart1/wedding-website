'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { GalleryPhoto } from '@/lib/schema'
import { adminFetch, errorMessage, uploadImage } from '@/app/admin/_lib/api'
import { IconButton, PageHeader } from '@/app/admin/_ui/PageHeader'
import { Button, ConfirmButton, Group, Row, Sheet, inputClass, labelClass } from '@/app/admin/_ui/primitives'
import { LoadState, ToggleRow } from '@/app/admin/_ui/forms'
import { PhotoTile } from './PhotoTile'

const API = '/api/admin/gallery'

export function GalleryView() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<GalleryPhoto | null>(null)
  const [caption, setCaption] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    try {
      setPhotos((await adminFetch<{ photos?: GalleryPhoto[] }>(API)).photos ?? [])
      setError('')
    } catch (problem) {
      setError(errorMessage(problem))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  /** Runs one change against the server and reports it; the list is reloaded if it fails. */
  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work()
      toast.success(done)
    } catch (problem) {
      toast.error(errorMessage(problem))
      load()
    }
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const image = await uploadImage(file, 'wedding')
      await adminFetch(API, { method: 'POST', body: { url: image.url, publicId: image.publicId } })
      toast.success('Photo added')
      await load()
    } catch (problem) {
      toast.error(errorMessage(problem))
    } finally {
      setUploading(false)
    }
  }

  const patch = (id: number, change: Partial<Pick<GalleryPhoto, 'visible' | 'caption'>>, done: string) => {
    setPhotos(current => current.map(photo => (photo.id === id ? { ...photo, ...change } : photo)))
    setEditing(current => (current && current.id === id ? { ...current, ...change } : current))
    return run(() => adminFetch(API, { method: 'PATCH', body: { id, ...change } }), done)
  }

  const remove = (id: number) => {
    setPhotos(current => current.filter(photo => photo.id !== id))
    setEditing(null)
    return run(() => adminFetch(`${API}?id=${id}`, { method: 'DELETE' }), 'Photo removed')
  }

  const reorder = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const next = arrayMove(photos, photos.findIndex(photo => photo.id === active.id), photos.findIndex(photo => photo.id === over.id))
    setPhotos(next)
    run(() => adminFetch(API, { method: 'PUT', body: { order: next.map(photo => photo.id) } }), 'Order saved')
  }

  const open = (photo: GalleryPhoto) => { setEditing(photo); setCaption(photo.caption ?? '') }

  return (
    <>
      <PageHeader title="Gallery" subtitle={loading ? undefined : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}>
        <IconButton icon={Plus} label={uploading ? 'Uploading' : 'Add a photo'} tone="primary" disabled={uploading} onClick={() => fileInput.current?.click()} />
      </PageHeader>
      <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = '' }} />
      <LoadState loading={loading} error={error} />

      {!loading && !error && photos.length === 0 && (
        <Group><Row><p className="py-6 text-center text-[15px] text-black/45">{uploading ? 'Uploading…' : 'No photos yet. Use the plus button to add your first one.'}</p></Row></Group>
      )}

      {photos.length > 0 && (
        <>
          <p className="mt-6 px-1 text-[13px] text-black/45">Drag a photo by its handle to reorder. Tap a photo to caption, hide or remove it.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
            <SortableContext items={photos.map(photo => photo.id)} strategy={rectSortingStrategy}>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map(photo => <PhotoTile key={photo.id} photo={photo} onOpen={open} />)}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {editing && (
        <Sheet title="Photo" onClose={() => setEditing(null)}>
          <Group>
            <Row>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={editing.url} alt="" className="mx-auto max-h-64 rounded-lg object-contain" />
            </Row>
            <Row>
              <label className={labelClass} htmlFor="photo-caption">Caption</label>
              <input id="photo-caption" className={inputClass} value={caption} maxLength={255} onChange={event => setCaption(event.target.value)} />
            </Row>
            <ToggleRow label="Show on the site" hint="Hidden photos stay here but guests do not see them." checked={editing.visible} onChange={visible => patch(editing.id, { visible }, visible ? 'Photo shown' : 'Photo hidden')} />
          </Group>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button tone="primary" disabled={caption === (editing.caption ?? '')} onClick={() => patch(editing.id, { caption }, 'Caption saved')}>Save caption</Button>
            <ConfirmButton confirmText="Tap again to remove" onConfirm={() => remove(editing.id)}>Remove photo</ConfirmButton>
          </div>
        </Sheet>
      )}
    </>
  )
}
