/**
 * Phone and contact normalisation for exact-match lookup.
 * Philippine numbers are the default: 0917…, 917…, 63917… and +63 917… all
 * become +63917…. Other countries must be written with a leading +.
 */
const PH_MOBILE = /^9\d{9}$/

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed || /[^\d\s()+.-]/.test(trimmed)) return null
  const international = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (international) {
    if (digits.startsWith('63')) return PH_MOBILE.test(digits.slice(2)) ? `+${digits}` : null
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  }
  if (digits.startsWith('63') && PH_MOBILE.test(digits.slice(2))) return `+${digits}`
  if (digits.startsWith('0') && PH_MOBILE.test(digits.slice(1))) return `+63${digits.slice(1)}`
  if (PH_MOBILE.test(digits)) return `+63${digits}`
  return null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase()
  return value.length <= 255 && EMAIL.test(value) ? value : null
}

export type Contact = { kind: 'email'; value: string } | { kind: 'phone'; value: string }

/** One field accepts either an email or a phone number. Anything else is rejected. */
export function normalizeContact(input: string): Contact | null {
  if (input.includes('@')) {
    const email = normalizeEmail(input)
    return email ? { kind: 'email', value: email } : null
  }
  const phone = normalizePhone(input)
  return phone ? { kind: 'phone', value: phone } : null
}
