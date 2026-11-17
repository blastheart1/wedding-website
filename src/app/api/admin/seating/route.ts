import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { fail, ok, unauthorized } from '@/lib/invitations/admin-http'
import { seatingFailure } from '@/lib/seating/http'
import { tableCreateSchema, tableDeleteSchema, tableUpdateSchema } from '@/lib/seating/schemas'
import { createTable, deleteTable, loadSeating, updateTable } from '@/lib/seating/store'

export const dynamic = 'force-dynamic'

/** The whole plan: tables, who sits where, the floor, and the invitations the name list is built from. */
export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok(await loadSeating())
  } catch (error) {
    return seatingFailure(error, 'load')
  }
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok(await createTable(tableCreateSchema.parse(await request.json())), 201)
  } catch (error) {
    return seatingFailure(error, 'table create')
  }
}

export async function PATCH(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    return ok(await updateTable(tableUpdateSchema.parse(await request.json())))
  } catch (error) {
    return seatingFailure(error, 'table update')
  }
}

export async function DELETE(request: NextRequest) {
  if (!await isAdminRequest(request)) return unauthorized()
  try {
    const { id } = tableDeleteSchema.parse(await request.json())
    return await deleteTable(id) ? ok({ id }) : fail('That table no longer exists.', 404)
  } catch (error) {
    return seatingFailure(error, 'table delete')
  }
}
