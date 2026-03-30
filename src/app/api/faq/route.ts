import { NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq, asc } from 'drizzle-orm'

export async function GET() {
  try {
    const db    = getDb()
    const items = await db
      .select()
      .from(schema.faqItems)
      .where(eq(schema.faqItems.visible, true))
      .orderBy(asc(schema.faqItems.sortOrder), asc(schema.faqItems.createdAt))

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch FAQ items' },
      { status: 500 },
    )
  }
}
