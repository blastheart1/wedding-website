import { getWeddingConfig } from '@/lib/config'
import { loadInviteView } from '@/lib/invitations/service'
import { inviteStore } from '@/lib/invitations/store'
import { formatWeddingDate } from '@/lib/invitations/format'
import { renderPreviewCard } from '@/lib/invitations/preview-card'

export const dynamic = 'force-dynamic'

/** Link-preview picture for a personal link: the guest's first name on the wedding card. Unknown links get the general card. */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const config = await getWeddingConfig()
  let firstName = ''
  try {
    firstName = (await loadInviteView(inviteStore, params.token))?.firstName ?? ''
  } catch {
    firstName = ''
  }
  const png = await renderPreviewCard({
    kicker: firstName ? 'You are invited' : 'Our wedding',
    guestName: firstName || undefined,
    partner1: config.partner1,
    partner2: config.partner2,
    date: formatWeddingDate(config.weddingDate),
  })
  // A personalised picture must not be stored by shared caches, so the headers are set outright.
  return new Response(png, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  })
}
