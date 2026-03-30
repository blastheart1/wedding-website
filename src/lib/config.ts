import { getDb, schema } from './db'
import { DEFAULT_CONFIG, STORY_CHAPTERS, DEFAULT_SECTION_HEADINGS } from './constants'
import type { StoryChapter, SectionHeadings } from '@/types'

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
  // Per-section background images
  heroBgUrl:      string
  storyBgUrl:     string
  countdownBgUrl: string
  detailsBgUrl:   string
  galleryBgUrl:   string
  faqBgUrl:       string
  rsvpBgUrl:      string
  // RSVP access control
  rsvpAccessMode: string
  // Editable story chapter text (caption, stamp, emoji)
  storyChapters:   StoryChapter[]
  // Editable section heading text
  sectionHeadings: SectionHeadings
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
        faqBgUrl:       (row.faqBgUrl       ?? DEFAULT_CONFIG.faqBgUrl).trim(),
        rsvpBgUrl:      (row.rsvpBgUrl      ?? DEFAULT_CONFIG.rsvpBgUrl).trim(),
        rsvpAccessMode: row.rsvpAccessMode  ?? DEFAULT_CONFIG.rsvpAccessMode,
        storyChapters:   parseStoryChapters(row.storyChapters),
        sectionHeadings: parseSectionHeadings(row.sectionHeadings),
      }
    }
  } catch {
    // DB unavailable (e.g. no DATABASE_URL in CI/build) — use defaults
  }
  return {
    ...DEFAULT_CONFIG,
    storyChapters:   STORY_CHAPTERS,
    sectionHeadings: DEFAULT_SECTION_HEADINGS,
  } as PublicConfig
}

function parseStoryChapters(raw: string | null | undefined): StoryChapter[] {
  if (!raw) return STORY_CHAPTERS
  try {
    const parsed = JSON.parse(raw) as StoryChapter[]
    return Array.isArray(parsed) && parsed.length === STORY_CHAPTERS.length
      ? parsed
      : STORY_CHAPTERS
  } catch {
    return STORY_CHAPTERS
  }
}

function parseSectionHeadings(raw: string | null | undefined): SectionHeadings {
  if (!raw) return DEFAULT_SECTION_HEADINGS
  try {
    const parsed = JSON.parse(raw) as Partial<SectionHeadings>
    // Merge with defaults so new sections added later still work
    return {
      story:     { ...DEFAULT_SECTION_HEADINGS.story,     ...parsed.story     },
      countdown: { ...DEFAULT_SECTION_HEADINGS.countdown, ...parsed.countdown },
      details:   { ...DEFAULT_SECTION_HEADINGS.details,   ...parsed.details   },
      gallery:   { ...DEFAULT_SECTION_HEADINGS.gallery,   ...parsed.gallery   },
      faq:       { ...DEFAULT_SECTION_HEADINGS.faq,       ...parsed.faq       },
      rsvp:      { ...DEFAULT_SECTION_HEADINGS.rsvp,      ...parsed.rsvp      },
    }
  } catch {
    return DEFAULT_SECTION_HEADINGS
  }
}
