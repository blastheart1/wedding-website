import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { ok, unauthorized } from '@/lib/invitations/admin-http'
import { seatingFailure } from '@/lib/seating/http'
import { moveSchema } from '@/lib/seating/schemas'
import { moveSeat } from '@/lib/seating/store'

export const dynamic = 'force-dynamic'

/** Seats, moves, swaps or unseats one person and answers with everyone's seats as they now stand. */
export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok({ assignments: await moveSeat(moveSchema.parse(await request.json())) })
  } catch (error) {
    return seatingFailure(error, 'seat change')
  }
}
