import type { NextResponse } from 'next/server'
import { z } from 'zod'
import { fail } from '@/lib/invitations/admin-http'
import { isMissingReference, isMissingTable, isUniqueViolation, SEATING_NOT_READY, SeatingError } from './errors'

/** Maps known failures to clear messages; anything else is logged by name only and stays generic. */
export function seatingFailure(error: unknown, action: string): NextResponse {
  if (error instanceof SeatingError) return fail(error.message, error.status)
  if (error instanceof z.ZodError) return fail(error.errors[0].message, 400)
  if (error instanceof SyntaxError) return fail('Invalid request.', 400)
  if (isMissingTable(error)) return fail(SEATING_NOT_READY, 503)
  if (isUniqueViolation(error)) return fail('Someone else just changed that seat. The plan has been refreshed.', 409)
  if (isMissingReference(error)) return fail('That table or guest was just removed. The plan has been refreshed.', 409)
  console.error(`Seat plan ${action} failed`, error instanceof Error ? error.name : 'unknown error')
  return fail('Something went wrong. Please try again.', 500)
}
