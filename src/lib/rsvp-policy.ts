/**
 * RSVPs are made only through a guest's personal invitation link. The earlier
 * open email form and its endpoints are closed; this message is what they answer.
 */
export const RSVP_BY_INVITATION = 'RSVPs are by personal invitation. Please open the link we sent you, or check your invitation from the RSVP button on the site.'

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
