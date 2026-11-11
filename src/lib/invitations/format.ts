const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2027-02-27" becomes "February 27, 2027". Anything else is returned unchanged. */
export function formatWeddingDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return value
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : value
}

/** Site address for links and QR codes. Comes from configuration, never from request headers. */
export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

export interface TemplateContext {
  firstName: string
  partner1: string
  partner2: string
  weddingDate: string
  link?: string
}

export function templateValues(context: TemplateContext): Record<string, string> {
  return {
    firstName: context.firstName,
    partner1: context.partner1,
    partner2: context.partner2,
    date: formatWeddingDate(context.weddingDate),
    link: context.link ?? '',
  }
}
