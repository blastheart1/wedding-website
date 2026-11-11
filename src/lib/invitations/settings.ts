import { z } from 'zod'

const line = (max: number) => z.string().trim().min(1).max(max)

export const inviteSettingsSchema = z.object({
  // Link preview shown by Messenger, Instagram and others. {firstName} {partner1} {partner2} {date}
  previewTitle: line(120),
  previewDescription: line(240),
  // Optional absolute https image; empty uses the generated themed image
  previewImageUrl: z.string().trim().max(2048).refine(value => value === '' || /^https:\/\//.test(value), 'Use an https image address').default(''),
  emailSubject: line(160),
  emailIntro: line(1200),
  shareMessage: line(1200),
  dos: z.array(line(240)).max(20),
  donts: z.array(line(240)).max(20),
  acknowledgement: line(400),
})

export type InviteSettings = z.infer<typeof inviteSettingsSchema>

export const DEFAULT_INVITE_SETTINGS: InviteSettings = {
  previewTitle: "{firstName}, you're invited",
  previewDescription: 'Join us as {partner1} and {partner2} get married on {date}. Tap to RSVP.',
  previewImageUrl: '',
  emailSubject: "{firstName}, you're invited to our wedding",
  emailIntro: 'We would love to have you with us as we get married on {date}. Your personal RSVP link and QR code are below.',
  shareMessage: 'Hi {firstName}! We would love to have you at our wedding on {date}. This is your personal RSVP link: {link}',
  dos: [
    'RSVP on or before the deadline so we can prepare your seat.',
    'Arrive at least 30 minutes before the ceremony.',
    'Follow the dress code on the wedding site.',
  ],
  donts: [
    'Please do not bring guests beyond the seats on your invitation.',
    'Please do not share your personal link; it is tied to your invitation.',
    'Please keep phones away during the ceremony.',
  ],
  acknowledgement: 'I have read the reminders above and will follow them.',
}

export type TemplateValues = Readonly<Record<string, string>>

/** Replaces {name} placeholders. Unknown placeholders are removed, never left visible. */
export function renderTemplate(template: string, values: TemplateValues): string {
  return template
    // Own properties only: {constructor} and similar must never resolve.
    .replace(/\{(\w+)\}/g, (_match, key: string) => (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Stored JSON is untrusted: invalid or missing data falls back to the defaults. */
export function parseInviteSettings(raw: string | null | undefined): InviteSettings {
  if (!raw) return DEFAULT_INVITE_SETTINGS
  try {
    const parsed = inviteSettingsSchema.safeParse({ ...DEFAULT_INVITE_SETTINGS, ...JSON.parse(raw) })
    return parsed.success ? parsed.data : DEFAULT_INVITE_SETTINGS
  } catch {
    return DEFAULT_INVITE_SETTINGS
  }
}
