import { NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { asc, eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db     = getDb()
    const photos = await db
      .select()
      .from(schema.galleryPhotos)
      .where(
        and(
          eq(schema.galleryPhotos.album, 'gallery'),
          eq(schema.galleryPhotos.visible, true),
        ),
      )
      .orderBy(asc(schema.galleryPhotos.sortOrder), asc(schema.galleryPhotos.createdAt))

    return NextResponse.json({ photos })
  } catch {
    return NextResponse.json({ photos: [] })
  }
}
