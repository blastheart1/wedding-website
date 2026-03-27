import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq, max, asc } from 'drizzle-orm'
import { deleteImage } from '@/lib/cloudinary'
import { z } from 'zod'

function isAuthenticated(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-password')
  return !!auth && auth === process.env.ADMIN_PASSWORD
}

// ─── GET: list all photos ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db     = getDb()
  const photos = await db
    .select()
    .from(schema.galleryPhotos)
    .orderBy(asc(schema.galleryPhotos.sortOrder), asc(schema.galleryPhotos.createdAt))

  return NextResponse.json({ photos })
}

// ─── POST: save an uploaded photo's metadata ──────────────────────────────────
const saveSchema = z.object({
  url:      z.string().url(),
  publicId: z.string().optional(),
  caption:  z.string().max(255).optional(),
})

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const data = saveSchema.parse(body)
  const db   = getDb()

  // Append after the current last photo
  const [{ maxOrder }] = await db
    .select({ maxOrder: max(schema.galleryPhotos.sortOrder) })
    .from(schema.galleryPhotos)

  const nextOrder = (maxOrder ?? -1) + 1

  const [photo] = await db
    .insert(schema.galleryPhotos)
    .values({ url: data.url, publicId: data.publicId, caption: data.caption, sortOrder: nextOrder })
    .returning()

  return NextResponse.json({ photo })
}

// ─── PATCH: update caption ────────────────────────────────────────────────────
const patchSchema = z.object({
  id:      z.number().int(),
  caption: z.string().max(255).optional(),
})

export async function PATCH(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const data = patchSchema.parse(body)
  const db   = getDb()

  await db
    .update(schema.galleryPhotos)
    .set({ caption: data.caption })
    .where(eq(schema.galleryPhotos.id, data.id))

  return NextResponse.json({ success: true })
}

// ─── DELETE: remove photo from DB + Cloudinary ───────────────────────────────
export async function DELETE(request: NextRequest) {
  if (!isAuthenticated(request)) {
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

  // Delete from Cloudinary if we stored the public_id
  if (photo.publicId) {
    try { await deleteImage(photo.publicId) } catch { /* non-fatal */ }
  }

  await db.delete(schema.galleryPhotos).where(eq(schema.galleryPhotos.id, id))

  return NextResponse.json({ success: true })
}
