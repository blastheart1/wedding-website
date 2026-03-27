import { getDb, schema } from './db'
import { DEFAULT_CONFIG } from './constants'

// ─── Public shape — all fields guaranteed non-null ────────────────────────────
export interface PublicConfig {
  partner1:       string
  partner2:       string
  weddingDate:    string
  ceremonyTime:   string
  receptionTime:  string
  ceremonyVenue:  string
  receptionVenue: string
  location:       string
  dressCode:      string
  hotelName:      string
  hotelCode:      string
  hotelDiscount:  string
  guestNotes:     string
  rsvpDeadline:   string
  heroVideoUrl:   string
  // F4: per-section background images
  heroBgUrl:      string
  storyBgUrl:     string
  countdownBgUrl: string
  detailsBgUrl:   string
  galleryBgUrl:   string
}

/**
 * Fetch wedding config from DB, falling back to DEFAULT_CONFIG on any error.
 * Called from the root Server Component — safe to use without DATABASE_URL
 * (returns defaults instead of throwing, so `next build` always succeeds).
 */
export async function getWeddingConfig(): Promise<PublicConfig> {
  try {
    const db   = getDb()
    const rows = await db.select().from(schema.weddingConfig).limit(1)

    if (rows.length > 0) {
      const row = rows[0]
      return {
        partner1:       row.partner1       ?? DEFAULT_CONFIG.partner1,
        partner2:       row.partner2       ?? DEFAULT_CONFIG.partner2,
        weddingDate:    row.weddingDate    ?? DEFAULT_CONFIG.weddingDate,
        ceremonyTime:   row.ceremonyTime   ?? DEFAULT_CONFIG.ceremonyTime,
        receptionTime:  row.receptionTime  ?? DEFAULT_CONFIG.receptionTime,
        ceremonyVenue:  row.ceremonyVenue  ?? DEFAULT_CONFIG.ceremonyVenue,
        receptionVenue: row.receptionVenue ?? DEFAULT_CONFIG.receptionVenue,
        location:       row.location       ?? DEFAULT_CONFIG.location,
        dressCode:      row.dressCode      ?? DEFAULT_CONFIG.dressCode,
        hotelName:      row.hotelName      ?? DEFAULT_CONFIG.hotelName,
        hotelCode:      row.hotelCode      ?? DEFAULT_CONFIG.hotelCode,
        hotelDiscount:  row.hotelDiscount  ?? DEFAULT_CONFIG.hotelDiscount,
        guestNotes:     row.guestNotes     ?? DEFAULT_CONFIG.guestNotes,
        rsvpDeadline:   row.rsvpDeadline   ?? DEFAULT_CONFIG.rsvpDeadline,
        heroVideoUrl:   (row.heroVideoUrl ?? DEFAULT_CONFIG.heroVideoUrl).trim(),
        heroBgUrl:      (row.heroBgUrl      ?? DEFAULT_CONFIG.heroBgUrl).trim(),
        storyBgUrl:     (row.storyBgUrl     ?? DEFAULT_CONFIG.storyBgUrl).trim(),
        countdownBgUrl: (row.countdownBgUrl ?? DEFAULT_CONFIG.countdownBgUrl).trim(),
        detailsBgUrl:   (row.detailsBgUrl   ?? DEFAULT_CONFIG.detailsBgUrl).trim(),
        galleryBgUrl:   (row.galleryBgUrl   ?? DEFAULT_CONFIG.galleryBgUrl).trim(),
      }
    }
  } catch {
    // DB unavailable (e.g. no DATABASE_URL in CI/build) — use defaults
  }
  return { ...DEFAULT_CONFIG } as PublicConfig
}
