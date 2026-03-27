import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq, max, asc, and } from 'drizzle-orm'
import { deleteImage } from '@/lib/cloudinary'
import { isAdminRequest } from '@/lib/auth'
import { z } from 'zod'

// ─── GET: list all gallery (album=gallery) photos ────────────────────────────
export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db     = getDb()
  const photos = await db
    .select()
    .from(schema.galleryPhotos)
    .where(eq(schema.galleryPhotos.album, 'gallery'))
    .orderBy(asc(schema.galleryPhotos.sortOrder), asc(schema.galleryPhotos.createdAt))

  return NextResponse.json({ photos })
}

// ─── POST: save an uploaded photo's metadata ──────────────────────────────────
const saveSchema = z.object({
  url:       z.string().url(),
  publicId:  z.string().optional(),
  caption:   z.string().max(255).optional(),
  album:     z.enum(['gallery', 'story']).optional().default('gallery'),
  storySlot: z.number().int().min(1).max(6).optional(),
})

export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const data = saveSchema.parse(body)
  const db   = getDb()

  const [{ maxOrder }] = await db
    .select({ maxOrder: max(schema.galleryPhotos.sortOrder) })
    .from(schema.galleryPhotos)
    .where(eq(schema.galleryPhotos.album, data.album))

  const nextOrder = (maxOrder ?? -1) + 1

  // If assigning to a story slot, clear the previous occupant first
  if (data.album === 'story' && data.storySlot !== null && data.storySlot !== undefined) {
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

  const [photo] = await db
    .insert(schema.galleryPhotos)
    .values({
      url:       data.url,
      publicId:  data.publicId,
      caption:   data.caption,
      sortOrder: nextOrder,
      album:     data.album,
      storySlot: data.storySlot ?? null,
    })
    .returning()

  return NextResponse.json({ photo })
}

// ─── PATCH: update caption and/or visibility ─────────────────────────────────
const patchSchema = z.object({
  id:      z.number().int(),
  caption: z.string().max(255).optional(),
  visible: z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const data = patchSchema.parse(body)
  const db   = getDb()

  const updates: Partial<typeof schema.galleryPhotos.$inferInsert> = {}
  if (data.caption !== undefined) updates.caption = data.caption
  if (data.visible !== undefined) updates.visible = data.visible

  await db
    .update(schema.galleryPhotos)
    .set(updates)
    .where(eq(schema.galleryPhotos.id, data.id))

  return NextResponse.json({ success: true })
}

// ─── PUT: bulk reorder (array of ids in desired order) ───────────────────────
const reorderSchema = z.object({
  order: z.array(z.number().int()).min(1),
})

export async function PUT(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { order } = reorderSchema.parse(body)
  const db = getDb()

  await Promise.all(
    order.map((id, index) =>
      db
        .update(schema.galleryPhotos)
        .set({ sortOrder: index })
        .where(eq(schema.galleryPhotos.id, id)),
    ),
  )

  return NextResponse.json({ success: true })
}

// ─── DELETE: remove photo from DB + Cloudinary ───────────────────────────────
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
