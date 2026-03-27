/**
 * Seed script — run once after `npm run db:push` to populate initial data.
 * Usage: npm run db:seed
 */
import { drizzle } from 'drizzle-orm/neon-http'
import { neon }    from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import * as schema from '../src/lib/schema'

dotenv.config({ path: '.env.local' })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('❌  DATABASE_URL is not set in .env.local')
  process.exit(1)
}

const db = drizzle(neon(url), { schema })

async function seed() {
  console.log('🌱  Seeding database…')

  // ── Wedding config ────────────────────────────────────────────────────────
  const existingConfig = await db.select().from(schema.weddingConfig).limit(1)
  if (existingConfig.length === 0) {
    await db.insert(schema.weddingConfig).values({
      partner1:       'Luis',
      partner2:       'Bee',
      weddingDate:    '2027-02-27',
      ceremonyTime:   '3:00 PM',
      receptionTime:  '6:00 PM',
      ceremonyVenue:  'TBA',
      receptionVenue: 'TBA',
      location:       'TBA',
      dressCode:      'Garden formal — spring & pastel tones',
      hotelName:      'TBA',
      hotelCode:      'LUISBEE2027',
      hotelDiscount:  '20%',
      guestNotes:     '',
      rsvpDeadline:   'January 27, 2027',
    })
    console.log('  ✓  Wedding config created')
  } else {
    console.log('  –  Wedding config already exists, skipping')
  }

  // ── Gallery placeholder (optional) ───────────────────────────────────────
  // Remove this block once you upload real photos via the admin panel.
  const existingPhotos = await db.select().from(schema.galleryPhotos).limit(1)
  if (existingPhotos.length === 0) {
    console.log('  –  No gallery photos found — upload via /admin → Gallery tab')
  }

  console.log('\n✅  Seed complete\n')
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
