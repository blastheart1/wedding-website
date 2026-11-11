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
import { sql } from 'drizzle-orm'

// ─── RSVPs ────────────────────────────────────────────────────────────────────
export const rsvps = pgTable(
  'rsvps',
  {
    id:          serial('id').primaryKey(),
    name:        varchar('name',         { length: 255 }).notNull(),
    // Optional: guests invited by personal link may have no email on file.
    email:       varchar('email',        { length: 255 }),
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
    // Personal-invitation RSVPs (all nullable; absent on legacy email RSVPs)
    invitationId:   integer('invitation_id'),
    // How many of the invitation's seats will be used, including the guest
    partySize:      integer('party_size'),
    // JSON string: string[] of additional guest names
    companions:     text('companions'),
    acknowledgedAt: timestamp('acknowledged_at'),
    updatedAt:      timestamp('updated_at'),
  },
  (table) => ({
    // One RSVP per email address — enforces no double submissions at DB level
    emailUnique: uniqueIndex('rsvps_email_unique').on(table.email),
    // One RSVP per personal invitation
    invitationUnique: uniqueIndex('rsvps_invitation_unique').on(table.invitationId).where(sql`${table.invitationId} IS NOT NULL`),
  }),
)

// ─── Personal invitations (link + QR) ─────────────────────────────────────────
export const invitations = pgTable(
  'invitations',
  {
    id:              serial('id').primaryKey(),
    guestName:       varchar('guest_name', { length: 255 }).notNull(),
    email:           varchar('email', { length: 255 }),
    // Normalised E.164, e.g. +639171234567
    phone:           varchar('phone', { length: 32 }),
    // Seats including the guest: 1 = solo, 3 = guest plus two
    seats:           integer('seats').notNull().default(1),
    // SHA-256 hex of the link token (lookup) and AES-256-GCM copy (re-display)
    tokenHash:       varchar('token_hash', { length: 64 }).notNull(),
    tokenEnc:        text('token_enc').notNull(),
    // 'active' | 'revoked'
    status:          varchar('status', { length: 20 }).notNull().default('active'),
    guestListId:     integer('guest_list_id'),
    sentAt:          timestamp('sent_at'),
    lastChannel:     varchar('last_channel', { length: 20 }),
    firstOpenedAt:   timestamp('first_opened_at'),
    lastOpenedAt:    timestamp('last_opened_at'),
    openCount:       integer('open_count').notNull().default(0),
    respondedAt:     timestamp('responded_at'),
    linkRequestedAt: timestamp('link_requested_at'),
    createdAt:       timestamp('created_at').defaultNow().notNull(),
    updatedAt:       timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex('invitations_token_hash_unique').on(table.tokenHash),
    emailUnique:     uniqueIndex('invitations_email_unique').on(table.email).where(sql`${table.email} IS NOT NULL`),
    phoneUnique:     uniqueIndex('invitations_phone_unique').on(table.phone).where(sql`${table.phone} IS NOT NULL`),
  }),
)

export const invitationEvents = pgTable(
  'invitation_events',
  {
    id:           serial('id').primaryKey(),
    invitationId: integer('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
    type:         varchar('type', { length: 40 }).notNull(),
    channel:      varchar('channel', { length: 20 }),
    meta:         text('meta'),
    createdAt:    timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    invitationIdx: index('invitation_events_invitation_idx').on(table.invitationId),
  }),
)

// Single row of validated JSON: preview/email/share templates, do's and don'ts, acknowledgement
export const inviteSettings = pgTable('invite_settings', {
  id:        serial('id').primaryKey(),
  data:      text('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Shared (cross-instance) attempt counters for the public status lookup
export const rateLimits = pgTable('rate_limits', {
  key:         varchar('key', { length: 255 }).primaryKey(),
  windowStart: timestamp('window_start').notNull(),
  count:       integer('count').notNull().default(0),
})

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
  sitePresentation: text('site_presentation'),
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
export type Invitation        = typeof invitations.$inferSelect
export type NewInvitation     = typeof invitations.$inferInsert
export type InvitationEvent   = typeof invitationEvents.$inferSelect
