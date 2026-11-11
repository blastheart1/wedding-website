import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { isAdminRequest } from '@/lib/auth'
import { fail, failFrom, ok, unauthorized } from '@/lib/invitations/admin-http'
import { isEmailConfigured } from '@/lib/invitations/mailer'
import { sendInvitationEmailById } from '@/lib/invitations/send'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_PER_REQUEST = 100
/** Stay under the provider's per-second limit. */
const SPACING_MS = 600

const sendSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(MAX_PER_REQUEST, `Send at most ${MAX_PER_REQUEST} emails at a time.`),
  resend: z.boolean().default(false),
})

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** Emails the chosen guests one by one. A guest already emailed is skipped unless `resend` is true. */
export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  if (!isEmailConfigured()) return fail('Email sending is not set up yet. Add RESEND_API_KEY and INVITE_EMAIL_FROM, or INVITE_EMAIL_SIMULATE=1 to try it without sending.', 503)
  try {
    const { ids, resend } = sendSchema.parse(await request.json())
    const unique = [...new Set(ids)]
    const skipped: { id: number; reason: string }[] = []
    let sent = 0
    for (const [index, id] of unique.entries()) {
      if (index > 0) await pause(SPACING_MS)
      const outcome = await sendInvitationEmailById(id, { resend })
      if (outcome.sent) sent += 1
      else skipped.push({ id, reason: outcome.reason })
    }
    if (unique.length === 1 && skipped.length === 1) return fail(skipped[0].reason, 409)
    return ok({ sent, skipped })
  } catch (error) {
    return failFrom(error, 'send')
  }
}
