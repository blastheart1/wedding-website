// ─── RSVP ─────────────────────────────────────────────────────────────────────
export interface RSVPFormData {
  name:        string
  email:       string
  attending:   'yes' | 'no'
  meal:        string
  songRequest: string
  plusOne:     boolean
  plusOneName: string
  message:     string
}

export interface RSVPResponse {
  success: boolean
  message: string
  id?:     number
}

// ─── Config ───────────────────────────────────────────────────────────────────
export interface WeddingConfigData {
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
}

// ─── Gallery ──────────────────────────────────────────────────────────────────
export interface GalleryPhotoData {
  id:        number
  url:       string
  caption:   string | null
  sortOrder: number
  album:     string
  visible:   boolean
  storySlot: number | null
}

// ─── Story Photo ──────────────────────────────────────────────────────────────
export interface StoryPhotoData {
  slot:    number
  url:     string
  caption: string | null
}

// ─── Countdown ────────────────────────────────────────────────────────────────
export interface CountdownValues {
  days:    number
  hours:   number
  minutes: number
  seconds: number
}

// ─── Section Headings ─────────────────────────────────────────────────────────
export interface SectionHeading {
  eyebrow: string
  heading: string
  italic:  string
}

export interface SectionHeadings {
  story:     SectionHeading
  countdown: SectionHeading
  details:   SectionHeading
  gallery:   SectionHeading
  rsvp:      SectionHeading
}

// ─── Story Chapter ────────────────────────────────────────────────────────────
export interface StoryChapter {
  id:      number
  emoji:   string
  caption: string
  stamp:   string
  bg:      string
  rotate:  string
  delay:   number
}
