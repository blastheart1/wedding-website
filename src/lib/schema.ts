import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ─── RSVPs ────────────────────────────────────────────────────────────────────
export const rsvps = pgTable(
  'rsvps',
  {
    id:          serial('id').primaryKey(),
    name:        varchar('name',         { length: 255 }).notNull(),
    email:       varchar('email',        { length: 255 }).notNull(),
    attending:   boolean('attending').notNull(),
    meal:        varchar('meal',         { length: 100 }),
    songRequest: varchar('song_request', { length: 255 }),
    plusOne:     boolean('plus_one').default(false),
    plusOneName: varchar('plus_one_name',{ length: 255 }),
    message:     text('message'),
    createdAt:   timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // One RSVP per email address
    emailUnique: uniqueIndex('rsvps_email_unique').on(table.email),
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
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
})

// ─── Inferred types ───────────────────────────────────────────────────────────
export type RSVP            = typeof rsvps.$inferSelect
export type NewRSVP         = typeof rsvps.$inferInsert
export type GalleryPhoto    = typeof galleryPhotos.$inferSelect
export type NewGalleryPhoto = typeof galleryPhotos.$inferInsert
export type WeddingConfig   = typeof weddingConfig.$inferSelect
