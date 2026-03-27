# Luis & Bee — Wedding Website

A custom wedding website for **Luis & Bee · February 27, 2027**.

Built with Next.js 14 App Router, TypeScript, Tailwind CSS, Neon PostgreSQL (via Vercel), Drizzle ORM, Cloudinary, and Framer Motion.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Tech Stack](#tech-stack)
3. [Quick Start](#quick-start)
4. [Environment Variables](#environment-variables)
5. [Database Setup (Neon via Vercel)](#database-setup-neon-via-vercel)
6. [Cloudinary Setup](#cloudinary-setup)
7. [Design System](#design-system)
8. [Sections & Components](#sections--components)
9. [Admin Panel](#admin-panel)
10. [API Reference](#api-reference)
11. [Deployment](#deployment)
12. [Customisation Guide](#customisation-guide)
13. [Suggested Next Steps](#suggested-next-steps)
14. [AI Agent Instructions](#ai-agent-instructions)

---

## Project Structure

```
luis-and-bee-wedding/
├── public/
│   └── flowers/
│       └── garland.webp              ← Watercolor floral asset
│
├── scripts/
│   └── seed.ts                       ← DB seed script (npm run db:seed)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                ← Root layout, viewport, OG metadata, Toaster
│   │   ├── page.tsx                  ← Server component — fetches config, renders sections
│   │   ├── globals.css               ← Tailwind base + floral-banner classes + scrollbar
│   │   ├── admin/
│   │   │   ├── layout.tsx            ← Admin layout (noindex meta)
│   │   │   └── page.tsx              ← Full admin panel (password-gated)
│   │   └── api/
│   │       ├── rsvp/route.ts         ← POST: submit RSVP (Zod-validated, deduped by email)
│   │       ├── gallery/route.ts      ← GET: public photo list (force-dynamic)
│   │       └── admin/
│   │           ├── route.ts          ← GET: config+RSVPs+stats | POST: save config
│   │           ├── export/route.ts   ← GET: download RSVPs as .xlsx (header auth)
│   │           └── gallery/
│   │               ├── route.ts      ← GET/POST/PATCH/DELETE: manage gallery photos
│   │               └── sign/route.ts ← POST: sign Cloudinary upload params
│   │
│   ├── components/
│   │   ├── sections/
│   │   │   ├── Navbar.tsx            ← Floating pill nav, config-driven initials
│   │   │   ├── Hero.tsx              ← Floral garland + names + CTA, config-driven
│   │   │   ├── Story.tsx             ← Instax scroll-reveal cards (constants.ts)
│   │   │   ├── Countdown.tsx         ← Live digit-flip countdown, config-driven date
│   │   │   ├── Details.tsx           ← Event info 2×2 grid, fully config-driven
│   │   │   ├── Gallery.tsx           ← Cloudinary photos + animated lightbox
│   │   │   ├── RSVPSection.tsx       ← Form with validation, config-driven deadline
│   │   │   └── Footer.tsx            ← Monogram + date, config-driven
│   │   └── ui/
│   │       ├── SectionHeader.tsx     ← Animated eyebrow + heading + ornament
│   │       └── FloralDivider.tsx     ← Floral image strip (normal or flipped)
│   │
│   ├── lib/
│   │   ├── db.ts                     ← Lazy Neon + Drizzle client (getDb())
│   │   ├── schema.ts                 ← DB tables + Drizzle types
│   │   ├── config.ts                 ← getWeddingConfig() server helper
│   │   ├── constants.ts              ← Story chapters, nav links, meal options
│   │   ├── cloudinary.ts             ← Cloudinary client, sign helper, delete helper
│   │   └── animations.ts             ← Shared Framer Motion variants
│   │
│   └── types/
│       └── index.ts                  ← All TypeScript interfaces
│
├── drizzle.config.ts                 ← Drizzle Kit config
├── tailwind.config.ts                ← Custom colors, fonts, keyframes
├── next.config.js                    ← Cloudinary remotePatterns, external packages
├── .env.local                        ← Your local secrets (git-ignored)
├── .env.local.example                ← Template — commit this, not .env.local
└── README.md
```

---

## Tech Stack

| Layer        | Choice                         | Why                                                         |
|--------------|--------------------------------|-------------------------------------------------------------|
| Framework    | **Next.js 14.2 App Router**    | Server components, API routes, Vercel-native                |
| Language     | **TypeScript**                 | Type-safe DB models, forms, API contracts                   |
| Styling      | **Tailwind CSS**               | Utility-first, zero runtime, easy to extend                 |
| Animation    | **Framer Motion**              | Scroll-reveal, digit flip, lightbox transitions             |
| Database     | **Neon PostgreSQL**            | Serverless Postgres, free tier, Vercel integration          |
| ORM          | **Drizzle ORM**                | Type-safe SQL, lightweight, works with Neon HTTP driver     |
| Media        | **Cloudinary**                 | CDN delivery, signed uploads, auto-optimisation             |
| Forms        | **React Hook Form + Zod**      | Schema-driven validation, great DX                          |
| Toasts       | **Sonner**                     | Minimal, beautiful notifications                            |
| Excel export | **SheetJS (xlsx)**             | Server-side RSVP export with column formatting              |
| Deployment   | **Vercel**                     | Zero-config Next.js, Neon integration, custom domains       |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Fill in values — see sections below for how to get each one

# 3. Push DB schema to Neon
npm run db:push

# 4. Seed initial wedding config
npm run db:seed

# 5. Start dev server
npm run dev
```

- Guest site: [http://localhost:3000](http://localhost:3000)
- Admin panel: [http://localhost:3000/admin](http://localhost:3000/admin)

### npm scripts

| Script           | What it does                                        |
|------------------|-----------------------------------------------------|
| `npm run dev`    | Start Next.js dev server                            |
| `npm run build`  | Production build                                    |
| `npm run lint`   | ESLint                                              |
| `npm run db:push`    | Push Drizzle schema to Neon (creates/alters tables) |
| `npm run db:seed`    | Seed the initial `wedding_config` row               |
| `npm run db:studio`  | Open Drizzle Studio to browse DB                    |
| `npm run db:generate`| Generate SQL migration files                        |

---

## Environment Variables

All variables live in `.env.local` (git-ignored). Use `.env.local.example` as the template.

The fastest way to fill in database variables is `vercel env pull .env.local` after connecting Neon in the Vercel dashboard — it writes all `DATABASE_URL` and `POSTGRES_*` vars automatically.

| Variable                           | Required | Description                                               |
|------------------------------------|----------|-----------------------------------------------------------|
| `DATABASE_URL`                     | Yes      | Neon connection string (pooled)                           |
| `POSTGRES_URL`                     | No       | Set automatically by Vercel Neon integration              |
| `POSTGRES_URL_NON_POOLING`         | No       | Set automatically by Vercel Neon integration              |
| `PGHOST` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | No | Set automatically by Vercel Neon integration |
| `ADMIN_PASSWORD`                   | Yes      | Password for `/admin` — use 16+ chars                     |
| `CLOUDINARY_CLOUD_NAME`            | Yes      | From Cloudinary dashboard                                 |
| `CLOUDINARY_API_KEY`               | Yes      | From Cloudinary dashboard                                 |
| `CLOUDINARY_API_SECRET`            | Yes      | From Cloudinary dashboard — never exposed to browser      |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`| Yes      | Same as `CLOUDINARY_CLOUD_NAME` — safe to expose          |
| `NEXT_PUBLIC_BASE_URL`             | Yes      | Production URL (e.g. `https://luisandbee.wedding`)        |

---

## Database Setup (Neon via Vercel)

Neon is the Postgres database. The recommended setup uses Vercel's native Neon integration so credentials are managed automatically.

### Option A — Vercel integration (recommended)

1. Deploy to Vercel first (see [Deployment](#deployment) below)
2. In the Vercel dashboard: **Storage → Create Database → Neon**
3. Follow the prompts — Vercel creates the Neon project and links it
4. Pull the credentials to your local machine:
   ```bash
   vercel env pull .env.local
   ```
   This writes `DATABASE_URL` and all `POSTGRES_*` variables into `.env.local` automatically.
5. Push the schema and seed:
   ```bash
   npm run db:push
   npm run db:seed
   ```

### Option B — Manual Neon setup

1. Go to [console.neon.tech](https://console.neon.tech) → **New Project**
2. Name it `wedding`, choose the region closest to your guests
3. Copy the **Connection String** (pooled) into `DATABASE_URL` in `.env.local`
4. Push schema and seed:
   ```bash
   npm run db:push
   npm run db:seed
   ```

### Schema

```
rsvps             — guest RSVP submissions
  id, name, email (unique), attending, meal, song_request,
  plus_one, plus_one_name, message, created_at

gallery_photos    — photos managed via admin panel, served from Cloudinary
  id, url, public_id, caption, sort_order, created_at

wedding_config    — all editable content (managed via /admin → Settings)
  id, partner1, partner2, wedding_date, ceremony_time, reception_time,
  ceremony_venue, reception_venue, location, dress_code,
  hotel_name, hotel_code, hotel_discount, guest_notes,
  rsvp_deadline, updated_at
```

> **Note:** `rsvps.email` has a unique index — each guest can RSVP exactly once. Duplicate attempts return a 409 with a clear message.

### Browsing your data

```bash
npm run db:studio
# Opens Drizzle Studio at https://local.drizzle.studio
```

---

## Cloudinary Setup

Cloudinary stores and delivers all gallery photos via CDN.

1. Sign in at [cloudinary.com](https://cloudinary.com) (free tier is plenty for a wedding)
2. From the Dashboard, copy:
   - **Cloud name**
   - **API Key**
   - **API Secret**
3. Add all three to `.env.local` (see [Environment Variables](#environment-variables))
4. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` to the same cloud name

Photos are uploaded **directly from the browser to Cloudinary** using a signed request — the API secret never leaves the server. After upload, the Cloudinary URL is saved to the `gallery_photos` table.

To upload photos: go to `/admin` → **Gallery** tab → choose a file.

---

## Design System

### Colors (`tailwind.config.ts`)

| Token       | Hex       | Usage                                           |
|-------------|-----------|--------------------------------------------------|
| `cream`     | `#FDFAF6` | Page background (warm off-white)                |
| `petal`     | `#F9EEF0` | Story section bg, RSVP section, admin login     |
| `blush`     | `#F2D9DF` | Card accents, ornament lines                    |
| `rose`      | `#C96070` | Primary accent — buttons, eyebrows, dots        |
| `rosedark`  | `#A84D5B` | Button hover state                              |
| `lavender`  | `#EAE6F4` | Countdown section background                    |
| `lilac`     | `#9E8EC2` | Countdown digit color                           |
| `sage`      | `#E6EFE4` | Gallery section background                      |
| `forest`    | `#6B9668` | Attending badge text                            |
| `peach`     | `#FAF0E6` | Detail card hover background                    |
| `ink`       | `#2E1F1A` | Primary text (warm near-black)                  |
| `ink2`      | `#7A5C54` | Secondary text (warm brown-grey)                |
| `muted`     | `#A89088` | Labels, placeholders, tertiary text             |
| `rule`      | `#E8DDD8` | Borders and dividers                            |

### Typography

```
font-display  →  Cormorant Garamond (Google Fonts)
                 Headings, names, dates, instax captions
                 Weights: 300, 400, 600 · italic variants

font-sans     →  Jost (Google Fonts)
                 Body text, labels, buttons, nav
                 Weights: 300, 400, 500
```

### Animation variants (`src/lib/animations.ts`)

| Variant        | Effect                                              |
|----------------|-----------------------------------------------------|
| `fadeUp`       | Opacity 0→1, y 28px→0                               |
| `fadeDown`     | Opacity 0→1, y -20px→0                              |
| `fadeIn`       | Opacity 0→1 only                                    |
| `scaleReveal`  | Opacity + scale 0.94→1                              |
| `cardPop`      | Spring pop for instax cards                         |
| `stagger()`    | Container that staggers children (configurable gap) |

All animations use the `[0.22, 1, 0.36, 1]` expo-out easing curve.

### Conventions

- Section padding: `py-24 px-6`
- Max content widths: `max-w-[860px]` (story), `max-w-[820px]` (details), `max-w-[880px]` (gallery)
- Cards: `border border-rule` — the editorial border is intentional, do not remove it
- Corner radius: `rounded-sm` only — keep it sharp, not bubbly
- No gradients — flat spring palette only
- No emojis in buttons or headings

---

## Sections & Components

### Page flow (`src/app/page.tsx`)

`page.tsx` is a **server component** (`export const dynamic = 'force-dynamic'`). It calls `getWeddingConfig()` once and passes the result as props to every section that needs content. All displayed text comes from the DB — nothing is hardcoded in components.

```
Navbar(config)
Hero(config)
Story()                 ← chapters from constants.ts
FloralDivider
Countdown(config)
Details(config)
FloralDivider
Gallery()               ← self-fetches from /api/gallery
RSVPSection(config)
FloralDivider
Footer(config)
```

### `<Navbar />`

Floating pill, always visible. Initials update from `config.partner1` and `config.partner2`. Shadow/blur intensity increases on scroll.

### `<Hero />`

Three-part: floral top → names + date + CTA → floral bottom (mirrored). Names and date come from `config`. Location shown if set (not TBA). Animated scroll cue bounces.

### `<Story />`

Instax-style polaroid cards with spring pop + tilt. Data comes from `STORY_CHAPTERS` in `src/lib/constants.ts`. To add real photos, replace the emoji `<div>` inside each card with a `<Image>` from `next/image`.

### `<Countdown />`

Live countdown to the ceremony. Date and time come from `config.weddingDate` + `config.ceremonyTime`. Each digit has an `AnimatePresence` flip animation on every second tick.

### `<Details />`

2×2 grid of event cards (Ceremony, Reception, Attire, Accommodations). All content from `config` — venue, time, hotel, dress code. Shows "Details coming soon" for any field still set to `TBA`.

### `<Gallery />`

Fetches photos from `/api/gallery` on mount. Renders `<Image>` from Cloudinary with a staggered scroll-reveal. First photo spans two columns (featured). Clicking opens an animated lightbox. Shows coloured placeholder slots while loading or if no photos uploaded yet.

### `<RSVPSection />`

React Hook Form + Zod validation. Meal / plus-one / song fields slide in/out with `AnimatePresence` based on the attending selection. On success, replaces the form with a personalised thank-you message using the submitted name and wedding date from `config`.

### `<Footer />`

Initials, date, and location — all from `config`. Scroll-triggered fade-in.

---

## Admin Panel

**URL:** `/admin`
**Password:** set `ADMIN_PASSWORD` in `.env.local`

The password is validated server-side before the admin UI unlocks — the client never sets `authed = true` optimistically.

### Settings tab

Edit everything visible on the wedding site:

| Field           | Where it appears               |
|-----------------|--------------------------------|
| Partner 1 & 2   | Navbar initials, Hero, Footer  |
| Wedding date    | Hero, Countdown, Details, Footer|
| Ceremony time   | Countdown target, Details      |
| Reception time  | Details                        |
| RSVP deadline   | RSVPSection                    |
| Ceremony venue  | Details                        |
| Reception venue | Details                        |
| Location        | Hero, Footer, Details          |
| Dress code      | Details                        |
| Hotel name/code/discount | Details                |
| Guest notes     | Details                        |

Changes take effect on the next page load (server-side fetch, `force-dynamic`).

### RSVPs tab

- Stats: total / attending / declining
- Full table of all responses
- **Export to Excel** — streams a formatted `.xlsx` directly from the server using `SheetJS`. The admin password stays in the HTTP header — never in the URL.

### Gallery tab

- Upload photos (file picker → signed Cloudinary upload → saved to DB)
- Edit captions inline
- Delete photos (removes from DB and Cloudinary)
- Order reflects `sort_order` column — first photo in the list appears as the wide featured tile on the site

---

## API Reference

All admin routes require the header `x-admin-password: <ADMIN_PASSWORD>`.

### `POST /api/rsvp`

Submit a guest RSVP. Validates with Zod. Returns 409 if the email has already RSVPed.

**Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@email.com",
  "attending": "yes",
  "meal": "Vegetarian",
  "songRequest": "Perfect – Ed Sheeran",
  "plusOne": true,
  "plusOneName": "John Smith",
  "message": "Can't wait!"
}
```

**Responses:**
```json
{ "success": true, "message": "RSVP received!", "id": 42 }
{ "success": false, "message": "You've already RSVPed with this email." }  // 409
{ "success": false, "message": "Please enter your full name" }             // 400
```

---

### `GET /api/gallery`

Returns all gallery photos ordered by `sort_order`. Public, no auth.

```json
{ "photos": [{ "id": 1, "url": "https://res.cloudinary.com/...", "caption": "Engagement", "sortOrder": 0 }] }
```

---

### `GET /api/admin` *(auth required)*

Returns wedding config, all RSVPs, and attendance stats.

### `POST /api/admin` *(auth required)*

Upserts the `wedding_config` row. Body: any subset of config fields.

### `GET /api/admin/export` *(auth required)*

Streams a formatted `.xlsx` file with all RSVP data.

### `GET /api/admin/gallery` *(auth required)*

Returns all gallery photos including `public_id`.

### `POST /api/admin/gallery` *(auth required)*

Saves a newly uploaded photo's metadata to DB.
```json
{ "url": "https://res.cloudinary.com/...", "publicId": "wedding/abc123", "caption": "Engagement" }
```

### `PATCH /api/admin/gallery` *(auth required)*

Updates a photo's caption.
```json
{ "id": 1, "caption": "New caption" }
```

### `DELETE /api/admin/gallery?id=1` *(auth required)*

Deletes a photo from DB and from Cloudinary (via `public_id`).

### `POST /api/admin/gallery/sign` *(auth required)*

Signs Cloudinary upload params. Called by the admin upload flow before the browser uploads directly to Cloudinary.
```json
// Request
{ "paramsToSign": { "timestamp": "1234567890", "folder": "wedding" } }
// Response
{ "signature": "abc...", "apiKey": "...", "cloudName": "..." }
```

---

## Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI (once)
npm i -g vercel

# Deploy
vercel

# Or connect your GitHub repo at vercel.com for automatic deploys on push
```

### Add environment variables on Vercel

In the Vercel dashboard → **Settings → Environment Variables**, add:

| Variable                             | Notes                                     |
|--------------------------------------|-------------------------------------------|
| `ADMIN_PASSWORD`                     | Strong password, 16+ chars                |
| `CLOUDINARY_CLOUD_NAME`              | From Cloudinary dashboard                 |
| `CLOUDINARY_API_KEY`                 | From Cloudinary dashboard                 |
| `CLOUDINARY_API_SECRET`              | From Cloudinary dashboard                 |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`  | Same as `CLOUDINARY_CLOUD_NAME`           |
| `NEXT_PUBLIC_BASE_URL`               | e.g. `https://luisandbee.wedding`         |

`DATABASE_URL` and all `POSTGRES_*` vars are set automatically by the Neon integration — no need to add them manually.

### Connect Neon (Vercel Storage)

1. Vercel dashboard → **Storage** → **Create Database** → **Neon**
2. Follow the prompts — Vercel links the database and injects all credentials
3. Run schema push and seed from local (after `vercel env pull .env.local`):
   ```bash
   npm run db:push
   npm run db:seed
   ```

### Custom domain

Vercel dashboard → **Settings → Domains** → add your domain.

---

## Customisation Guide

### Update couple names, date, venue

Go to `/admin` → **Settings** tab. All content is DB-driven and updates instantly — no redeploy needed.

### Update the story chapters

Edit `STORY_CHAPTERS` in `src/lib/constants.ts`. Each chapter has:

```typescript
{
  id:      number
  emoji:   string    // placeholder — replace with <Image> for real photos
  caption: string    // shown below the instax card
  stamp:   string    // shown in bottom-right corner of card
  bg:      string    // Tailwind bg class for the photo area
  rotate:  string    // Tailwind rotate class for the tilt
  delay:   number    // animation delay in ms
}
```

To use real photos, replace the emoji `<div>` in `Story.tsx` with:

```tsx
<Image src="/photos/chapter-1.jpg" alt={chapter.caption} fill className="object-cover" />
```

### Add a new section

1. Create `src/components/sections/YourSection.tsx`
2. If it needs config, accept `config: PublicConfig` as a prop
3. Import and add it to `src/app/page.tsx`
4. Follow the section template:

```tsx
'use client'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { fadeUp, stagger } from '@/lib/animations'

export function YourSection() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="your-section" className="bg-cream py-24 px-6">
      <SectionHeader eyebrow="Eyebrow" heading="Main" headingItalic="heading" />
      <motion.div
        ref={ref}
        variants={stagger()}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
      >
        {/* content */}
      </motion.div>
    </section>
  )
}
```

### Add a new DB field

1. Add the column to the relevant table in `src/lib/schema.ts`
2. Run `npm run db:push` — Drizzle Kit applies the change to Neon
3. Update `src/lib/config.ts` if it's a config field
4. Update the admin Settings tab in `src/app/admin/page.tsx`

---

## Suggested Next Steps

### Before going live

- [ ] Upload real engagement/story photos via `/admin` → Gallery
- [ ] Fill in all venue, hotel, and dress code details in `/admin` → Settings
- [ ] Set a strong `ADMIN_PASSWORD` (16+ chars, stored in Vercel env)
- [ ] Set `NEXT_PUBLIC_BASE_URL` to your production domain
- [ ] Replace instax chapter emojis with real photos in `constants.ts` + `Story.tsx`

### Recommended enhancements

**Email notifications (Resend)**

Install `resend` and add to `POST /api/rsvp`:
```typescript
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
// Notify Luis & Bee of each new RSVP
await resend.emails.send({ from: '...', to: '...', subject: `New RSVP from ${data.name}`, html: '...' })
// Also send a branded confirmation to the guest
```

**RSVP deadline enforcement**

Add to `POST /api/rsvp`:
```typescript
const config = await getWeddingConfig()
if (config.rsvpDeadline && new Date() > new Date(config.rsvpDeadline)) {
  return NextResponse.json({ success: false, message: 'RSVP deadline has passed.' }, { status: 410 })
}
```

**Guest guestbook**

Add a `guestbook_messages` table, a public `POST /api/guestbook` route, and a `<Guestbook />` section between Gallery and RSVP.

**Registry links**

Add a `<Registry />` section with cards linking to Amazon, Zola, honeymoon fund, etc.

**QR code**

```bash
npm install react-qr-code
```
Add a QR code generator in the admin panel pointing to `NEXT_PUBLIC_BASE_URL`. Print on invitations.

**Scroll progress bar**

Add a thin `bg-rose` bar at the top of `Navbar.tsx` using `useScroll` from Framer Motion.

**Vercel Analytics**

```bash
npm install @vercel/analytics
# Add <Analytics /> to src/app/layout.tsx
```

---

## AI Agent Instructions

> Read this before making any changes to the codebase.

### Architecture

- `page.tsx` is the **only place** that calls `getWeddingConfig()`. It passes the result as `config` props down to sections. Never fetch config inside a section component.
- `getDb()` must be called **inside a function body** — never at module scope. This keeps `next build` working without `DATABASE_URL`.
- All API routes validate admin requests with `isAuthenticated(request)` — never skip this check.
- Zod validates all POST request bodies at the API boundary.

### Design rules

- Only use colors defined in `tailwind.config.ts` — never introduce new hex values
- `font-display` for all headings; `font-sans` for all body/UI text — never use system fonts
- No gradients — flat spring colors only
- `rounded-sm` for cards and buttons — never `rounded-xl` or larger
- `border border-rule` on all cards — the editorial border defines the aesthetic
- Section structure: `<section id="x" className="bg-[color] py-24 px-6">` → `<SectionHeader />` → content
- Animations: use variants from `src/lib/animations.ts`, use `useInView` with `{ once: true, margin: '-80px' }` for scroll triggers

### DB changes

1. Update `src/lib/schema.ts`
2. Run `npm run db:push`
3. If it's a config field: update `src/lib/config.ts` (both `PublicConfig` interface and `getWeddingConfig()`)
4. Update admin Settings tab

### What not to change

- Font families (Cormorant Garamond + Jost are intentional)
- The `border border-rule` pattern on cards
- The lazy `getDb()` pattern — do not revert to module-level DB init

---

*Made with love for Luis & Bee · February 27, 2027* 🌸
