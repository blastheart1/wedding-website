import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { getWeddingConfig } from '@/lib/config'
import { getInvitationDetail, loadSettingsForAdmin } from '@/lib/invitations/admin-store'
import { fail, failFrom, ok, parseId, unauthorized } from '@/lib/invitations/admin-http'
import { siteBaseUrl, templateValues } from '@/lib/invitations/format'
import { firstName } from '@/lib/invitations/policy'
import { coupleMonogram, renderQrSvg } from '@/lib/invitations/qr'
import { renderTemplate } from '@/lib/invitations/settings'
import { inviteUrl } from '@/lib/invitations/token'

export const dynamic = 'force-dynamic'

/** One invitation with its link, styled QR, ready-to-send message and timeline. Admin only. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(request)) return unauthorized()
  const id = parseId(params.id)
  if (id === null) return fail('That invitation no longer exists.', 404)
  try {
    const [detail, config, settings] = await Promise.all([getInvitationDetail(id), getWeddingConfig(), loadSettingsForAdmin()])
    if (!detail) return fail('That invitation no longer exists.', 404)
    const { token, ...invitation } = detail
    const link = inviteUrl(token, siteBaseUrl())
    const values = templateValues({ firstName: firstName(detail.guestName), partner1: config.partner1, partner2: config.partner2, weddingDate: config.weddingDate, link })
    return ok({
      invitation,
      link,
      qrSvg: renderQrSvg(link, { monogram: coupleMonogram(config.partner1, config.partner2) }),
      shareMessage: renderTemplate(settings.shareMessage, values),
      preview: {
        title: renderTemplate(settings.previewTitle, values),
        description: renderTemplate(settings.previewDescription, values),
        image: settings.previewImageUrl || `${link}/preview-image`,
      },
    })
  } catch (error) {
    return failFrom(error, 'detail')
  }
}
