import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, signAdminToken, COOKIE_NAME, MAX_AGE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { password } = body as { password?: string }

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  const valid = await verifyPassword(password)
  if (!valid) {
    return NextResponse.json({ error: 'Wrong password — try again' }, { status: 401 })
  }

  const token = await signAdminToken()
  const res   = NextResponse.json({ ok: true })

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   MAX_AGE,
    path:     '/',
  })

  return res
}
