import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  varchar,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

// ─── RSVPs ────────────────────────────────────────────────────────────────────
export const rsvps = pgTable(
  'rsvps',
  {
    id:          serial('id').primaryKey(),
    name:        varchar('name',         { length: 255 }).notNull(),
    email:       varchar('email',        { length: 255 }).notNull(),
    attending:   boolean('attending').notNull(),
    // Legacy field — kept for existing data; new submissions use `dietary`
    meal:        varchar('meal',         { length: 100 }),
    songRequest: varchar('song_request', { length: 255 }),
    // Legacy field — kept for existing data; replaced by guest_list.seats
    plusOne:     boolean('plus_one').default(false),
    plusOneName: varchar('plus_one_name',{ length: 255 }),
    dietary:     text('dietary'),
    message:     text('message'),
    createdAt:   timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // One RSVP per email address — enforces no double submissions at DB level
    emailUnique: uniqueIndex('rsvps_email_unique').on(table.email),
  }),
)

// ─── FAQ Items ────────────────────────────────────────────────────────────────
export const faqItems = pgTable('faq_items', {
  id:        serial('id').primaryKey(),
  question:  text('question').notNull(),
  answer:    text('answer').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  visible:   boolean('visible').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Guest List (whitelist/blacklist + seat assignment) ───────────────────────
export const guestList = pgTable(
  'guest_list',
  {
    id:        serial('id').primaryKey(),
    email:     varchar('email',  { length: 255 }).notNull(),
    name:      varchar('name',   { length: 255 }),
    // 'allow' = whitelisted, 'block' = blacklisted
    status:    varchar('status', { length: 20 }).notNull().default('allow'),
    // Number of seats including the guest themselves (1 = solo, 2 = +1, etc.)
    seats:     integer('seats').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex('guest_list_email_unique').on(table.email),
    statusIdx:   index('guest_list_status_idx').on(table.status),
  }),
)

// ─── Quiz Questions ───────────────────────────────────────────────────────────
export const quizQuestions = pgTable('quiz_questions', {
  id:            serial('id').primaryKey(),
  question:      text('question').notNull(),
  optionA:       varchar('option_a', { length: 255 }).notNull(),
  optionB:       varchar('option_b', { length: 255 }).notNull(),
  optionC:       varchar('option_c', { length: 255 }).notNull(),
  optionD:       varchar('option_d', { length: 255 }).notNull(),
  correctOption: varchar('correct_option', { length: 1 }).notNull(), // 'A' | 'B' | 'C' | 'D'
  sortOrder:     integer('sort_order').notNull().default(0),
  visible:       boolean('visible').notNull().default(true),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

// ─── Quiz Scores (leaderboard) ────────────────────────────────────────────────
export const quizScores = pgTable(
  'quiz_scores',
  {
    id:          serial('id').primaryKey(),
    playerName:  varchar('player_name', { length: 100 }).notNull(),
    score:       integer('score').notNull().default(0),
    totalQ:      integer('total_q').notNull().default(0),
    timeTakenMs: integer('time_taken_ms'),
    createdAt:   timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    scoreIdx: index('quiz_scores_score_idx').on(table.score),
  }),
)

// ─── Bouquet Game Scores (leaderboard) ───────────────────────────────────────
export const bouquetScores = pgTable(
  'bouquet_scores',
  {
    id:         serial('id').primaryKey(),
    playerName: varchar('player_name', { length: 100 }).notNull(),
    score:      integer('score').notNull().default(0),
    createdAt:  timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    scoreIdx: index('bouquet_scores_score_idx').on(table.score),
  }),
)

// ─── Gallery Photos ───────────────────────────────────────────────────────────
export const galleryPhotos = pgTable('gallery_photos', {
  id:        serial('id').primaryKey(),
  url:       text('url').notNull(),           // Cloudinary secure_url
  publicId:  text('public_id'),               // Cloudinary public_id (for deletion)
  caption:   varchar('caption',  { length: 255 }),
  sortOrder: integer('sort_order').notNull().default(0),
  // F2: album discriminates gallery vs story photos
  album:     varchar('album', { length: 20 }).notNull().default('gallery'),
  // F2: maps a story photo to a chapter slot (1-6); null for gallery photos
  storySlot: integer('story_slot'),
  // F3: hide without deleting
  visible:   boolean('visible').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Wedding Config (editable from admin) ─────────────────────────────────────
export const weddingConfig = pgTable('wedding_config', {
  id:              serial('id').primaryKey(),
  partner1:        varchar('partner1',        { length: 100 }).default('Luis'),
  partner2:        varchar('partner2',        { length: 100 }).default('Bee'),
  weddingDate:     varchar('wedding_date',    { length: 50  }).default('2027-02-27'),
  ceremonyTime:    varchar('ceremony_time',   { length: 20  }).default('3:00 PM'),
  receptionTime:   varchar('reception_time',  { length: 20  }).default('6:00 PM'),
  ceremonyVenue:   varchar('ceremony_venue',  { length: 255 }),
  receptionVenue:  varchar('reception_venue', { length: 255 }),
  location:        varchar('location',        { length: 255 }),
  dressCode:       varchar('dress_code',      { length: 255 }),
  hotelName:       varchar('hotel_name',      { length: 255 }),
  hotelCode:       varchar('hotel_code',      { length: 100 }),
  hotelDiscount:   varchar('hotel_discount',  { length: 50  }),
  guestNotes:      text('guest_notes'),
  rsvpDeadline:    varchar('rsvp_deadline',   { length: 50  }),
  heroVideoUrl:    text('hero_video_url'),
  // F4: per-section background images (Cloudinary URLs)
  heroBgUrl:       text('hero_bg_url'),
  storyBgUrl:      text('story_bg_url'),
  countdownBgUrl:  text('countdown_bg_url'),
  detailsBgUrl:    text('details_bg_url'),
  galleryBgUrl:    text('gallery_bg_url'),
  faqBgUrl:        text('faq_bg_url'),
  rsvpBgUrl:       text('rsvp_bg_url'),
  // 'open' | 'invite_only' | 'mixed'
  rsvpAccessMode:  varchar('rsvp_access_mode', { length: 20 }).default('open'),
  // Story chapter text (JSON string: StoryChapter[]) — editable from admin
  storyChapters:   text('story_chapters'),
  // Section heading text (JSON string: SectionHeadings) — editable from admin
  sectionHeadings: text('section_headings'),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
})

// ─── Inferred types ───────────────────────────────────────────────────────────
export type RSVP              = typeof rsvps.$inferSelect
export type NewRSVP           = typeof rsvps.$inferInsert
export type GalleryPhoto      = typeof galleryPhotos.$inferSelect
export type NewGalleryPhoto   = typeof galleryPhotos.$inferInsert
export type WeddingConfig     = typeof weddingConfig.$inferSelect
export type FAQItem           = typeof faqItems.$inferSelect
export type NewFAQItem        = typeof faqItems.$inferInsert
export type GuestListEntry    = typeof guestList.$inferSelect
export type NewGuestListEntry = typeof guestList.$inferInsert
export type QuizQuestion      = typeof quizQuestions.$inferSelect
export type NewQuizQuestion   = typeof quizQuestions.$inferInsert
export type QuizScore         = typeof quizScores.$inferSelect
export type BouquetScore      = typeof bouquetScores.$inferSelect
