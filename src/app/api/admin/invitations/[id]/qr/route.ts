import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { getWeddingConfig } from '@/lib/config'
import { getInvitationDetail } from '@/lib/invitations/admin-store'
import { fail, failFrom, parseId, unauthorized } from '@/lib/invitations/admin-http'
import { siteBaseUrl } from '@/lib/invitations/format'
import { coupleMonogram } from '@/lib/invitations/qr'
import { renderQrPng } from '@/lib/invitations/qr-png'
import { inviteUrl } from '@/lib/invitations/token'

export const dynamic = 'force-dynamic'

/** Downloadable PNG of one guest's QR. Admin only. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(request)) return unauthorized()
  const id = parseId(params.id)
  if (id === null) return fail('That invitation no longer exists.', 404)
  try {
    const [detail, config] = await Promise.all([getInvitationDetail(id), getWeddingConfig()])
    if (!detail) return fail('That invitation no longer exists.', 404)
    const png = await renderQrPng(inviteUrl(detail.token, siteBaseUrl()), coupleMonogram(config.partner1, config.partner2))
    const filename = `invitation-${detail.guestName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || id}.png`
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return failFrom(error, 'qr')
  }
}
