import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { importFromGuestList } from '@/lib/invitations/admin-store'
import { failFrom, ok, unauthorized } from '@/lib/invitations/admin-http'

export const dynamic = 'force-dynamic'

/** Creates invitations for allowed guests on the older email list that do not have one yet. */
export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok(await importFromGuestList(), 201)
  } catch (error) {
    return failFrom(error, 'import')
  }
}
