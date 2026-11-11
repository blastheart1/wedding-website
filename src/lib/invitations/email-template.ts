/** Themed invitation email. Pure: every value is escaped here, nothing is fetched. */

export interface InviteEmailInput {
  firstName: string
  partner1: string
  partner2: string
  date: string
  plus: number
  deadline: string
  intro: string
  subject: string
  link: string
  qrImageUrl: string
}

export interface InviteEmail {
  subject: string
  html: string
  text: string
}

const INK = '#2E1F1A'
const INK_SOFT = '#7A5C54'
const CREAM = '#FDFAF6'
const PAGE = '#F4EFEA'
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif"
const SANS = "'Jost', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`)
}

function seatsLine(plus: number): string {
  if (plus <= 0) return 'This invitation is reserved for you.'
  return `Your invitation includes you and ${plus} ${plus === 1 ? 'guest' : 'guests'}.`
}

export function buildInviteEmail(input: InviteEmailInput): InviteEmail {
  const e = escapeHtml
  const couple = `${input.partner1} & ${input.partner2}`
  const seats = seatsLine(input.plus)
  const deadline = input.deadline ? `Please RSVP by ${input.deadline}.` : ''
  // Header line breaks would let a subject smuggle extra headers.
  const subject = input.subject.replace(/[\r\n]+/g, ' ').trim()

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(seats)} ${e(deadline)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${CREAM};border-radius:16px;">
<tr><td align="center" style="padding:44px 32px 8px;font-family:${SANS};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${INK_SOFT};">${e(couple)}</td></tr>
<tr><td align="center" style="padding:8px 32px 0;font-family:${SERIF};font-size:38px;line-height:1.15;color:${INK};">Dear ${e(input.firstName)},</td></tr>
<tr><td align="center" style="padding:20px 36px 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${INK};">${e(input.intro)}</td></tr>
<tr><td align="center" style="padding:14px 36px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK_SOFT};">${e(input.date)}<br>${e(seats)}</td></tr>
<tr><td align="center" style="padding:30px 32px 0;">
<a href="${e(input.link)}" style="display:inline-block;background-color:${INK};color:${CREAM};font-family:${SANS};font-size:16px;font-weight:500;text-decoration:none;padding:14px 34px;border-radius:999px;">Open my invitation</a>
</td></tr>
<tr><td align="center" style="padding:34px 32px 0;">
<a href="${e(input.link)}" style="text-decoration:none;color:${INK_SOFT};"><img src="${e(input.qrImageUrl)}" width="200" height="200" alt="Your personal QR code" style="display:block;border:0;border-radius:12px;width:200px;height:200px;font-family:${SANS};font-size:13px;line-height:200px;text-align:center;color:${INK_SOFT};background-color:#F4EFEA;"></a>
</td></tr>
<tr><td align="center" style="padding:12px 36px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_SOFT};">Scan with your phone camera, or use the button above.${deadline ? `<br>${e(deadline)}` : ''}</td></tr>
<tr><td align="center" style="padding:28px 36px 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${INK_SOFT};">This link is personal to you. Please do not forward it.<br><a href="${e(input.link)}" style="color:${INK_SOFT};word-break:break-all;">${e(input.link)}</a></td></tr>
<tr><td style="padding:40px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    `Dear ${input.firstName},`, '', input.intro, '', input.date, seats, deadline, '',
    `Open your invitation: ${input.link}`, '', 'This link is personal to you. Please do not forward it.', '', couple,
  ].filter((line, index, lines) => !(line === '' && lines[index - 1] === '')).join('\n')

  return { subject, html, text }
}
