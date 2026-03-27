import { NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { asc } from 'drizzle-orm'

// Always dynamic — reads from DB on every request.
export const dynamic = 'force-dynamic'

// Public endpoint — no auth required.
export async function GET() {
  try {
    const db     = getDb()
    const photos = await db
      .select()
      .from(schema.galleryPhotos)
      .orderBy(asc(schema.galleryPhotos.sortOrder), asc(schema.galleryPhotos.createdAt))

    return NextResponse.json({ photos })
  } catch {
    // Return empty array if DB is unavailable
    return NextResponse.json({ photos: [] })
  }
}
