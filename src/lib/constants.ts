import type { StoryChapter } from '@/types'

// ─── Default wedding config (used as fallback when DB is unavailable) ─────────
export const DEFAULT_CONFIG = {
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
}

// ─── Story chapters (instax section) ─────────────────────────────────────────
// Edit captions and emojis here to match Luis & Bee's real story.
export const STORY_CHAPTERS: StoryChapter[] = [
  { id: 1, emoji: '☕', caption: 'The beginning of everything',    stamp: 'Chapter I',    bg: 'bg-petal',   rotate: '-rotate-[4deg]',   delay: 0   },
  { id: 2, emoji: '🌿', caption: 'Adventures, big and small',     stamp: 'Chapter II',   bg: 'bg-sage',    rotate: 'rotate-[2.5deg]',  delay: 140 },
  { id: 3, emoji: '✈️', caption: 'Exploring the world together',  stamp: 'Chapter III',  bg: 'bg-lavender',rotate: '-rotate-[2deg]',   delay: 280 },
  { id: 4, emoji: '🎉', caption: 'Every season, better together', stamp: 'Chapter IV',   bg: 'bg-peach',   rotate: 'rotate-[3deg]',    delay: 80  },
  { id: 5, emoji: '💍', caption: 'He asked. She said yes.',       stamp: 'The Proposal', bg: 'bg-blush',   rotate: '-rotate-[3deg]',   delay: 220 },
  { id: 6, emoji: '🌸', caption: 'Feb 27, 2027 — forever begins', stamp: 'Chapter ∞',    bg: 'bg-sage',    rotate: 'rotate-[4deg]',    delay: 360 },
]

// ─── Meal options for RSVP form ───────────────────────────────────────────────
export const MEAL_OPTIONS = [
  'No preference',
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Halal',
  'Kosher',
]

// ─── Nav links ────────────────────────────────────────────────────────────────
export const NAV_LINKS = [
  { label: 'Story',   href: '#story'   },
  { label: 'Details', href: '#details' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'RSVP',   href: '#rsvp'    },
]
