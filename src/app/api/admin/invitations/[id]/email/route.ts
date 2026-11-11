import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { getInvitationDetail } from '@/lib/invitations/admin-store'
import { fail, failFrom, parseId, unauthorized } from '@/lib/invitations/admin-http'
import { composeInvitationEmail } from '@/lib/invitations/send'

export const dynamic = 'force-dynamic'

/** Shows the exact email this guest would receive, without sending anything. Admin only. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(request)) return unauthorized()
  const id = parseId(params.id)
  if (id === null) return fail('That invitation no longer exists.', 404)
  try {
    const detail = await getInvitationDetail(id)
    if (!detail) return fail('That invitation no longer exists.', 404)
    const email = await composeInvitationEmail(detail, new URL(request.url).origin)
    return new Response(email.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
        'Referrer-Policy': 'no-referrer',
        // The preview is static markup: no scripts, frames or form posts may run in it.
        'Content-Security-Policy': "default-src 'none'; img-src 'self' https: http: data:; style-src 'unsafe-inline'",
        'X-Email-Subject': encodeURIComponent(email.subject),
      },
    })
  } catch (error) {
    return failFrom(error, 'email preview')
  }
}
