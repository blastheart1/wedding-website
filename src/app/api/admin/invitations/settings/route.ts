import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { loadSettingsForAdmin, saveSettings } from '@/lib/invitations/admin-store'
import { failFrom, ok, unauthorized } from '@/lib/invitations/admin-http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok(await loadSettingsForAdmin())
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
