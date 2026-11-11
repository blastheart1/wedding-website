import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DuplicateContactError } from './admin-store'

const headers = { 'Cache-Control': 'no-store' }

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status, headers })
}

export function fail(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers })
}

export const unauthorized = (): NextResponse => fail('Unauthorized', 401)

/** Maps known failures to clear messages; anything else is logged by name only and stays generic. */
export function failFrom(error: unknown, action: string): NextResponse {
  if (error instanceof z.ZodError) return fail(error.errors[0].message, 400)
  if (error instanceof SyntaxError) return fail('Invalid request.', 400)
  if (error instanceof DuplicateContactError) return fail(error.message, 409)
  console.error(`Invitation admin ${action} failed`, error instanceof Error ? error.name : 'unknown error')
  return fail('Something went wrong. Please try again.', 500)
}

export function parseId(value: string): number | null {
  return /^\d{1,9}$/.test(value) ? Number(value) : null
}
