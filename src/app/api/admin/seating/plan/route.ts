import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { ok, unauthorized } from '@/lib/invitations/admin-http'
import { seatingFailure } from '@/lib/seating/http'
import { savePlan } from '@/lib/seating/store'

export const dynamic = 'force-dynamic'

/** Saves the floor (room size and labelled shapes) and whether guests can see their tables. */
export async function PUT(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok(await savePlan(await request.json()))
  } catch (error) {
    return seatingFailure(error, 'plan save')
  }
}
