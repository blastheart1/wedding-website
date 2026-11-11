import { z } from 'zod'
import { normalizeEmail, normalizePhone } from './phone'
import { MAX_SEATS } from './policy'

export const MAX_BULK = 500
export const SHARE_CHANNELS = ['messenger', 'instagram', 'sms', 'email', 'other'] as const
export type ShareChannel = (typeof SHARE_CHANNELS)[number]

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

/** Optional contact that is normalised for exact matching, or rejected with a clear message. */
const emailField = z.preprocess(blankToUndefined, z.string().max(255).optional()).transform((value, context) => {
  if (value === undefined) return null
  const email = normalizeEmail(value)
  if (!email) context.addIssue({ code: z.ZodIssueCode.custom, message: 'That email address does not look right.' })
  return email
})

const phoneField = z.preprocess(blankToUndefined, z.string().max(40).optional()).transform((value, context) => {
  if (value === undefined) return null
  const phone = normalizePhone(value)
  if (!phone) context.addIssue({ code: z.ZodIssueCode.custom, message: 'That phone number does not look right. Use 0917 123 4567 or +63 917 123 4567.' })
  return phone
})

const nameField = z.string().trim().min(2, 'Please enter the guest\'s name.').max(255)
const seatsField = z.number().int().min(1).max(MAX_SEATS)

export const guestInputSchema = z.object({
  guestName: nameField,
  email: emailField,
  phone: phoneField,
  seats: seatsField.default(1),
})
export type GuestInput = z.infer<typeof guestInputSchema>

export const bulkInputSchema = z.object({ guests: z.array(guestInputSchema).min(1).max(MAX_BULK) })

export const updateInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), id: z.number().int().positive(), guestName: nameField, email: emailField, phone: phoneField, seats: seatsField }),
  z.object({ action: z.literal('revoke'), id: z.number().int().positive() }),
  z.object({ action: z.literal('restore'), id: z.number().int().positive() }),
  z.object({ action: z.literal('regenerate'), id: z.number().int().positive() }),
  z.object({ action: z.literal('shared'), id: z.number().int().positive(), channel: z.enum(SHARE_CHANNELS) }),
])
export type UpdateInput = z.infer<typeof updateInputSchema>

export const deleteInputSchema = z.object({ id: z.number().int().positive() })

export interface BulkLineError {
  line: number
  message: string
}

export interface ParsedBulk {
  guests: GuestInput[]
  errors: BulkLineError[]
}

/**
 * Pasted guest lines, one per line: `Name, email or phone, plus`.
 * The contact and the plus count are optional. "plus" is extra guests, so 2 means three seats.
 */
export function parseBulkLines(text: string): ParsedBulk {
  const guests: GuestInput[] = []
  const errors: BulkLineError[] = []
  const seen = new Set<string>()
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    if (!raw.trim()) return
    const [name = '', ...rest] = raw.split(/[,\t;]/).map(part => part.trim())
    const contacts = rest.filter(part => part !== '' && !/^\+?\d{1,2}$/.test(part))
    const plusText = rest.find(part => /^\+?\d{1,2}$/.test(part))
    const plus = plusText ? Number(plusText.replace('+', '')) : 0
    const email = contacts.find(part => part.includes('@'))
    const phone = contacts.find(part => !part.includes('@'))
    const parsed = guestInputSchema.safeParse({ guestName: name, email, phone, seats: plus + 1 })
    if (!parsed.success) return void errors.push({ line, message: parsed.error.errors[0].message })
    for (const contact of [parsed.data.email, parsed.data.phone]) {
      if (contact && seen.has(contact)) return void errors.push({ line, message: 'This contact appears more than once in the list.' })
    }
    for (const contact of [parsed.data.email, parsed.data.phone]) if (contact) seen.add(contact)
    guests.push(parsed.data)
  })
  if (guests.length > MAX_BULK) errors.push({ line: 0, message: `Add at most ${MAX_BULK} guests at a time.` })
  return { guests: guests.slice(0, MAX_BULK), errors }
}
