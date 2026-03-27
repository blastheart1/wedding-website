import { NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq, and, asc, or, isNull } from 'drizzle-orm'
import type { StoryPhotoData } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDb()
    const rows = await db
      .select()
      .from(schema.galleryPhotos)
      .where(
        and(
          eq(schema.galleryPhotos.album, 'story'),
          or(
            eq(schema.galleryPhotos.visible, true),
            isNull(schema.galleryPhotos.visible),
          ),
        ),
      )
      .orderBy(asc(schema.galleryPhotos.storySlot))

    const photos: StoryPhotoData[] = rows
      .filter(r => r.storySlot !== null)
      .map(r => ({
        slot:    r.storySlot as number,
        url:     r.url,
        caption: r.caption ?? null,
      }))

    return NextResponse.json({ photos })
  } catch {
    return NextResponse.json({ photos: [] })
  }
}
