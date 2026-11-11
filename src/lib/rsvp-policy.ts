import { z } from 'zod'
import type { GuestVerification } from '@/types'

/** Shared by both endpoints so the form gate cannot bypass server-side policy. */
export const emailSchema = z.string().trim().toLowerCase().email('Please enter a valid email').max(255)

export const rsvpSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255),
  email: emailSchema,
  attending: z.enum(['yes', 'no']),
  dietary: z.string().trim().max(500).optional(),
  songRequest: z.string().trim().max(255).optional(),
  message: z.string().trim().max(2000).optional(),
})

type Guest = { status: string; seats: number; name: string | null } | null

export function rsvpEligibility(guest: Guest, alreadyResponded: boolean, accessMode: string): GuestVerification {
  if (alreadyResponded) return { allowed: false, seats: null, name: null, reason: 'already_rsvped' }
  if (guest?.status === 'block') return { allowed: false, seats: null, name: null, reason: 'blocked' }
  if (guest?.status === 'allow') {
    return { allowed: true, seats: guest.seats, name: guest.name ?? null }
  }
  // Unknown modes fail closed rather than silently opening invitations.
  if (accessMode !== 'open' && accessMode !== 'mixed') {
    return { allowed: false, seats: null, name: null, reason: 'not_invited' }
  }
  return { allowed: true, seats: null, name: null }
}

export const denialMessages = {
  blocked: "We're unable to process your RSVP. Please contact us directly.",
  not_invited: 'This event is by invitation only. Please contact us if you believe this is an error.',
  already_rsvped: "You've already RSVPed with this email. Contact us if you need to make changes.",
}

/**
 * Best-effort per-process abuse protection, not distributed identity verification.
 * Bounded storage prevents arbitrary forwarded addresses from growing memory forever.
 */
export function createRsvpRateLimiter(limit = 10, windowMs = 60_000, maxEntries = 10_000) {
  const entries = new Map<string, { count: number; resetAt: number }>()
  return (key: string, now = Date.now()): boolean => {
    const entry = entries.get(key)
    if (entry && now < entry.resetAt) {
      if (entry.count >= limit) return true
      entry.count++
      return false
    }
    if (entries.size >= maxEntries) {
      for (const [ip, item] of entries) if (now >= item.resetAt) entries.delete(ip)
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!)
    }
    entries.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
}
