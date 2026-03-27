import bcrypt      from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies }  from 'next/headers'
import type { NextRequest } from 'next/server'

export const COOKIE_NAME = 'admin_token'
export const MAX_AGE     = 60 * 60 * 24 * 7 // 7 days

function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET env var is not set')
  return new TextEncoder().encode(s)
}

/** Verify a plaintext password against the stored bcrypt hash. */
export async function verifyPassword(plain: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH
  if (!hash) return false
  return bcrypt.compare(plain, hash)
}

/** Issue a signed JWT for the admin session. */
export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

/** Verify a JWT string — returns true if valid and not expired. */
async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

/**
 * For use in Server Components / server actions.
 * Reads the httpOnly cookie from the incoming request context.
 */
export async function isAdminSession(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return false
  return verifyToken(token)
}

/**
 * For use in API Route Handlers (NextRequest available).
 * Reads the cookie from the request object.
 */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return false
  return verifyToken(token)
}
