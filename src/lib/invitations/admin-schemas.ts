import { z } from 'zod'
import { normalizeEmail, normalizePhone } from './phone'
import { MAX_SEATS } from './policy'
import { MAX_PLUS_ONES, checkPlusOnes, parsePastedPlusOnes, seatsFor } from './plus-ones'

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

// The people named as this guest's plus ones. Cleaned and checked here; the seat count then follows the list.
const plusOnesField = z.array(z.string().max(255)).max(MAX_PLUS_ONES, `A guest can have up to ${MAX_PLUS_ONES} plus ones.`).default([])

/** The cleaned list, or nothing when it is not valid (the refinement beside it reports why). */
const cleanNames = (names: string[]): string[] => {
  const checked = checkPlusOnes(names)
  return checked.ok ? checked.names : []
}

export const guestInputSchema = z.object({
  guestName: nameField,
  email: emailField,
  phone: phoneField,
  seats: seatsField.default(1),
  plusOnes: plusOnesField,
}).superRefine((guest, context) => {
  const checked = checkPlusOnes(guest.plusOnes, guest.guestName)
  if (!checked.ok) context.addIssue({ code: z.ZodIssueCode.custom, path: ['plusOnes'], message: checked.message })
}).transform(guest => {
  const names = cleanNames(guest.plusOnes)
  return { ...guest, plusOnes: names, seats: seatsFor(names, guest.seats) }
})
export type GuestInput = z.infer<typeof guestInputSchema>

export const bulkInputSchema = z.object({ guests: z.array(guestInputSchema).min(1).max(MAX_BULK) })

export const updateInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), id: z.number().int().positive(), guestName: nameField, email: emailField, phone: phoneField, seats: seatsField, plusOnes: plusOnesField }),
  z.object({ action: z.literal('revoke'), id: z.number().int().positive() }),
  z.object({ action: z.literal('restore'), id: z.number().int().positive() }),
  z.object({ action: z.literal('regenerate'), id: z.number().int().positive() }),
  z.object({ action: z.literal('shared'), id: z.number().int().positive(), channel: z.enum(SHARE_CHANNELS) }),
]).superRefine((input, context) => {
  if (input.action !== 'edit') return
  const checked = checkPlusOnes(input.plusOnes, input.guestName)
  if (!checked.ok) context.addIssue({ code: z.ZodIssueCode.custom, path: ['plusOnes'], message: checked.message })
}).transform(input => {
  // For an edit, the seat count follows the cleaned list, exactly as when a guest is added.
  if (input.action !== 'edit') return input
  const names = cleanNames(input.plusOnes)
  return { ...input, plusOnes: names, seats: seatsFor(names, input.seats) }
})
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
 * Pasted guest lines, one per line. Two shapes are understood:
 *   `Name, email or phone, plus`          the plus count is a number of unnamed extra seats;
 *   `Name | email or phone | Plus One, Plus One`   the plus ones are named, as in the couple's own list
 *                                         (a leading "2:" before the names is checked against them).
 * The contact and the plus ones are optional. Only the name is required.
 */
export function parseBulkLines(text: string): ParsedBulk {
  const guests: GuestInput[] = []
  const errors: BulkLineError[] = []
  const seen = new Set<string>()
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    if (!raw.trim()) return
    let candidate: { guestName: string; email?: string; phone?: string; seats?: number; plusOnes?: string[] }
    if (raw.includes('|')) {
      const [name = '', contact = '', listed = ''] = raw.split('|').map(part => part.trim())
      const pasted = parsePastedPlusOnes(listed)
      if (!pasted.ok) return void errors.push({ line, message: pasted.message })
      candidate = { guestName: name, email: contact.includes('@') ? contact : undefined, phone: contact && !contact.includes('@') ? contact : undefined, plusOnes: pasted.names }
    } else {
      const [name = '', ...rest] = raw.split(/[,\t;]/).map(part => part.trim())
      const contacts = rest.filter(part => part !== '' && !/^\+?\d{1,2}$/.test(part))
      const plusText = rest.find(part => /^\+?\d{1,2}$/.test(part))
      const plus = plusText ? Number(plusText.replace('+', '')) : 0
      candidate = { guestName: name, email: contacts.find(part => part.includes('@')), phone: contacts.find(part => !part.includes('@')), seats: plus + 1 }
    }
    const parsed = guestInputSchema.safeParse(candidate)
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
