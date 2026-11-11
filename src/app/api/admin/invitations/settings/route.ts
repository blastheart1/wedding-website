import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { getWeddingConfig } from '@/lib/config'
import { loadSettingsForAdmin, saveSettings } from '@/lib/invitations/admin-store'
import { formatWeddingDate, siteBaseUrl } from '@/lib/invitations/format'
import { failFrom, ok, unauthorized } from '@/lib/invitations/admin-http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    const [settings, config] = await Promise.all([loadSettingsForAdmin(), getWeddingConfig()])
    // The sample fills the placeholders in the editor's live preview. It is not a real guest.
    const sample = { firstName: 'Maria', partner1: config.partner1, partner2: config.partner2, date: formatWeddingDate(config.weddingDate), link: `${siteBaseUrl()}/i/your-guests-link` }
    return ok({ settings, sample })
  } catch (error) {
    return failFrom(error, 'settings read')
  }
}

export async function PUT(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok(await saveSettings(await request.json()))
  } catch (error) {
    return failFrom(error, 'settings save')
  }
}
