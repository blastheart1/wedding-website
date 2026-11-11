import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getDb, schema } from '@/lib/db'
import { eq, getTableColumns } from 'drizzle-orm'
import { isAdminRequest } from '@/lib/auth'
import { z } from 'zod'
import { sitePresentationSchema } from '@/lib/presentation'

const short = (max: number) => z.string().max(max).nullable().optional()
const validJson = z.string().max(50000).refine(value => {
  try { const parsed = JSON.parse(value); return typeof parsed === 'object' && parsed !== null } catch { return false }
}, 'Must be valid JSON').nullable().optional()
const configSchema = z.object({
  partner1: short(100), partner2: short(100), weddingDate: short(50),
  ceremonyTime: short(20), receptionTime: short(20), ceremonyVenue: short(255),
  receptionVenue: short(255), location: short(255), dressCode: short(255),
  hotelName: short(255), hotelCode: short(100), hotelDiscount: short(50),
  guestNotes: short(10000), rsvpDeadline: short(50), heroVideoUrl: short(2048),
  heroBgUrl: short(2048), storyBgUrl: short(2048), countdownBgUrl: short(2048),
  detailsBgUrl: short(2048), galleryBgUrl: short(2048), faqBgUrl: short(2048), rsvpBgUrl: short(2048),
  rsvpAccessMode: z.enum(['open', 'invite_only', 'mixed']).nullable().optional(),
  storyChapters: validJson, sectionHeadings: validJson,
  sitePresentation: z.string().max(50000).transform((value, ctx) => {
    try {
      const result = sitePresentationSchema.safeParse(JSON.parse(value))
      if (result.success) return JSON.stringify(result.data)
    } catch { /* Report a validation error, never write unvalidated JSON. */ }
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid presentation settings' })
    return z.NEVER
  }).nullable().optional(),
  presentation: sitePresentationSchema.optional(),
}).strip()

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const db = getDb()
    const { sitePresentation, ...baseColumns } = getTableColumns(schema.weddingConfig)
    const [configs, rsvps] = await Promise.all([
      db.select(baseColumns).from(schema.weddingConfig).limit(1),
      db.select().from(schema.rsvps).orderBy(schema.rsvps.createdAt),
    ])
    let presentation: string | null = null
    let warning: string | undefined
    try {
      const extra = await db.select({ value: sitePresentation }).from(schema.weddingConfig).limit(1)
      presentation = extra[0]?.value ?? null
    } catch {
      warning = 'Presentation migration is required before saving presentation settings.'
    }
    return NextResponse.json({
      config: configs[0] ? { ...configs[0], ...(!warning ? { sitePresentation: presentation } : {}) } : null,
      warning, rsvps,
      stats: { total: rsvps.length, attending: rsvps.filter(r => r.attending).length, declining: rsvps.filter(r => !r.attending).length },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load settings. Check database connectivity and migrations.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let input: unknown
  try { input = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = configSchema.safeParse(input)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid settings', details: parsed.error.flatten() }, { status: 400 })
  const { presentation, ...body } = parsed.data
  if (presentation) body.sitePresentation = JSON.stringify(presentation)
  if (!Object.keys(body).length) return NextResponse.json({ error: 'No settings provided' }, { status: 400 })
  try {
    const db = getDb()
    if (Object.prototype.hasOwnProperty.call(body, 'sitePresentation')) {
      // Fail before any write when presentation was explicitly edited without its migration.
      await db.select({ value: schema.weddingConfig.sitePresentation }).from(schema.weddingConfig).limit(1)
    }
    // Reading only the id allows legacy settings updates before the optional migration.
    const existing = await db.select({ id: schema.weddingConfig.id }).from(schema.weddingConfig).limit(1)
    if (existing.length) {
      await db.update(schema.weddingConfig).set({ ...body, updatedAt: new Date() }).where(eq(schema.weddingConfig.id, existing[0].id))
    } else {
      await db.insert(schema.weddingConfig).values(body)
    }
    revalidatePath('/', 'layout')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Settings were not saved. Check database connectivity and apply the required site_presentation migration.' }, { status: 503 })
  }
}
