'use client'

import Image from 'next/image'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import clsx from 'clsx'
import type { GalleryPhoto } from '@/lib/schema'

interface PhotoTileProps {
  photo: GalleryPhoto
  onOpen: (photo: GalleryPhoto) => void
}

/** One photo in the grid. Drag by the handle to reorder; tap the photo to edit it. */
export function PhotoTile({ photo, onOpen }: PhotoTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx('overflow-hidden rounded-xl bg-white', isDragging && 'opacity-60')}>
      <div className="relative aspect-square">
        <button type="button" onClick={() => onOpen(photo)} aria-label={`Edit ${photo.caption || 'photo'}`}
          className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black/60">
          <Image src={photo.url} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className={clsx('object-cover', !photo.visible && 'opacity-40')} />
        </button>
        <button type="button" {...attributes} {...listeners} aria-label="Drag to reorder"
          className="absolute left-1.5 top-1.5 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-full bg-white/85 text-black/60 active:cursor-grabbing">
          <GripVertical size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
        {!photo.visible && <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-white/85 px-2 py-0.5 text-[12px] text-black/70">Hidden</span>}
      </div>
      <p className="truncate px-3 py-2 text-[13px] text-black/55">{photo.caption || 'No caption'}</p>
    </div>
  )
}
