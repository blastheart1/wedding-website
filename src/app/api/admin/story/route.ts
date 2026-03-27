import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { isAdminRequest } from '@/lib/auth'
import { deleteImage } from '@/lib/cloudinary'
import { z } from 'zod'

// ─── GET: list all story photos ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const photos = await db
    .select()
    .from(schema.galleryPhotos)
    .where(eq(schema.galleryPhotos.album, 'story'))

  return NextResponse.json({ photos })
}

// ─── PATCH: assign / clear a story slot ──────────────────────────────────────
const patchSchema = z.object({
  id:        z.number().int(),
  storySlot: z.number().int().min(1).max(6).nullable(),
})

export async function PATCH(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const data = patchSchema.parse(body)
  const db   = getDb()

  // If assigning to a slot, first clear any existing photo in that slot
  if (data.storySlot !== null) {
    await db
      .update(schema.galleryPhotos)
      .set({ storySlot: null })
      .where(
        and(
          eq(schema.galleryPhotos.album, 'story'),
          eq(schema.galleryPhotos.storySlot, data.storySlot),
        ),
      )
  }

  await db
    .update(schema.galleryPhotos)
    .set({ storySlot: data.storySlot })
    .where(eq(schema.galleryPhotos.id, data.id))

  return NextResponse.json({ success: true })
}

// ─── DELETE: remove story photo from DB + Cloudinary ─────────────────────────
export async function DELETE(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const db = getDb()
  const [photo] = await db
    .select()
    .from(schema.galleryPhotos)
    .where(eq(schema.galleryPhotos.id, id))

  if (!photo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (photo.publicId) {
    try { await deleteImage(photo.publicId) } catch { /* non-fatal */ }
  }

  await db.delete(schema.galleryPhotos).where(eq(schema.galleryPhotos.id, id))

  return NextResponse.json({ success: true })
}
