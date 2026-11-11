import { getWeddingConfig } from '@/lib/config'
import { getInvitationDetail, loadSettingsForAdmin, recordShare, type InvitationDetail } from './admin-store'
import { buildInviteEmail, type InviteEmail } from './email-template'
import { formatWeddingDate, siteBaseUrl, templateValues } from './format'
import { SIMULATED_ID_PREFIX, sendEmail } from './mailer'
import { firstName, plusCount } from './policy'
import { renderTemplate } from './settings'
import { inviteStore } from './store'
import { inviteUrl } from './token'

export type SendOutcome = { sent: true } | { sent: false; reason: string }

/**
 * The exact email a guest would receive, built from current settings. Used to send and to preview.
 * `imageBase` only changes where the QR image is loaded from, so a preview opened on another
 * address (a local port, a preview deployment) still shows it. Links always use the site address.
 */
export async function composeInvitationEmail(detail: InvitationDetail, imageBase?: string): Promise<InviteEmail> {
  const [config, settings] = await Promise.all([getWeddingConfig(), loadSettingsForAdmin()])
  const link = inviteUrl(detail.token, siteBaseUrl())
  const name = firstName(detail.guestName)
  const values = templateValues({ firstName: name, partner1: config.partner1, partner2: config.partner2, weddingDate: config.weddingDate, link })
  return buildInviteEmail({
    firstName: name,
    partner1: config.partner1,
    partner2: config.partner2,
    date: formatWeddingDate(config.weddingDate),
    plus: plusCount(detail.seats),
    deadline: config.rsvpDeadline,
    intro: renderTemplate(settings.emailIntro, values),
    subject: renderTemplate(settings.emailSubject, values),
    link,
    qrImageUrl: imageBase ? `${inviteUrl(detail.token, imageBase)}/qr` : `${link}/qr`,
  })
}

/** Sends one guest's invitation email, then records when it went out. */
export async function sendInvitationEmail(detail: InvitationDetail, options: { resend: boolean }): Promise<SendOutcome> {
  if (detail.status !== 'active') return { sent: false, reason: 'The link is revoked.' }
  if (!detail.email) return { sent: false, reason: 'No email address on file.' }
  if (detail.sentAt && !options.resend) return { sent: false, reason: 'Already sent.' }

  const email = await composeInvitationEmail(detail)
  try {
    const emailId = await sendEmail({ to: detail.email, ...email })
    const simulated = emailId.startsWith(SIMULATED_ID_PREFIX)
    await recordShare(detail.id, 'email', 'email_sent', JSON.stringify(simulated ? { emailId, simulated: true } : { emailId }))
    return { sent: true }
  } catch (error) {
    await inviteStore.recordEvent(detail.id, 'email_failed', 'email', JSON.stringify({ error: error instanceof Error ? error.name : 'unknown' }))
    return { sent: false, reason: 'The email could not be sent.' }
  }
}

export async function sendInvitationEmailById(id: number, options: { resend: boolean }): Promise<SendOutcome> {
  const detail = await getInvitationDetail(id)
  return detail ? sendInvitationEmail(detail, options) : { sent: false, reason: 'That invitation no longer exists.' }
}
