import { getWeddingConfig } from '@/lib/config'
import { siteBaseUrl } from '@/lib/invitations/format'
import { coupleMonogram } from '@/lib/invitations/qr'
import { renderQrPng } from '@/lib/invitations/qr-png'
import { resolveInvitation } from '@/lib/invitations/service'
import { inviteStore } from '@/lib/invitations/store'
import { inviteUrl } from '@/lib/invitations/token'

export const dynamic = 'force-dynamic'

/** The guest's own QR as a PNG, used by the invitation email. Only an active link can fetch it. */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const invitation = await resolveInvitation(inviteStore, params.token)
    if (!invitation) return new Response(null, { status: 404 })
    const config = await getWeddingConfig()
    const png = await renderQrPng(inviteUrl(params.token, siteBaseUrl()), coupleMonogram(config.partner1, config.partner2), 600)
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600', 'X-Robots-Tag': 'noindex' },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
