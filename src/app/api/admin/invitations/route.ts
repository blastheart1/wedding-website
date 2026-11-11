import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { bulkInputSchema, deleteInputSchema, guestInputSchema, updateInputSchema } from '@/lib/invitations/admin-schemas'
import {
  createInvitation, createInvitations, deleteInvitation, editInvitation, listInvitations,
  recordShare, regenerateInvitation, setInvitationStatus,
} from '@/lib/invitations/admin-store'
import { fail, failFrom, ok, unauthorized } from '@/lib/invitations/admin-http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok(await listInvitations())
  } catch (error) {
    return failFrom(error, 'list')
  }
}

/** One guest (`{ guestName, email?, phone?, seats? }`) or many (`{ guests: [...] }`). */
export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'guests' in body) {
      return ok(await createInvitations(bulkInputSchema.parse(body).guests), 201)
    }
    return ok({ id: await createInvitation(guestInputSchema.parse(body)) }, 201)
  } catch (error) {
    return failFrom(error, 'create')
  }
}

export async function PATCH(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    const input = updateInputSchema.parse(await request.json())
    const found =
      input.action === 'edit' ? await editInvitation(input.id, input)
      : input.action === 'revoke' ? await setInvitationStatus(input.id, 'revoked')
      : input.action === 'restore' ? await setInvitationStatus(input.id, 'active')
      : input.action === 'regenerate' ? await regenerateInvitation(input.id)
      : await recordShare(input.id, input.channel)
    return found ? ok({ id: input.id }) : fail('That invitation no longer exists.', 404)
  } catch (error) {
    return failFrom(error, 'update')
  }
}

export async function DELETE(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    const { id } = deleteInputSchema.parse(await request.json())
    const outcome = await deleteInvitation(id)
    if (outcome === 'has_response') return fail('This guest has already responded. Revoke the link instead of deleting it.', 409)
    return outcome === 'deleted' ? ok({ id }) : fail('That invitation no longer exists.', 404)
  } catch (error) {
    return failFrom(error, 'delete')
  }
}
