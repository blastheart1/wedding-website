import { getWeddingConfig } from '@/lib/config'
import { formatWeddingDate } from '@/lib/invitations/format'
import { renderPreviewCard } from '@/lib/invitations/preview-card'

export const dynamic = 'force-dynamic'

/** The picture shown when the site's address is shared: the couple's names and date on the wedding card. */
export async function GET() {
  const config = await getWeddingConfig()
  const png = await renderPreviewCard({
    kicker: 'We are getting married',
    partner1: config.partner1,
    partner2: config.partner2,
    date: formatWeddingDate(config.weddingDate),
  })
  // Nothing personal here, so apps and browsers may keep it for an hour.
  return new Response(png, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  })
}
