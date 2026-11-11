import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/** 128 random bits, base64url: 22 characters, safe in URLs and short enough for a clean QR. */
const TOKEN_BYTES = 16
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/
const KEY_ENV = 'INVITE_TOKEN_KEY'
const VERSION = 'v1'

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** Cheap shape check so malformed links never reach the database. */
export function isTokenShape(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

/** The database is searched by this hash; the token itself is never stored in the clear. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function encryptionKey(): Buffer {
  const secret = process.env[KEY_ENV]
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error(`${KEY_ENV} must be set to at least 32 characters`)
  }
  return createHash('sha256').update(secret).digest()
}

/** AES-256-GCM so the dashboard can show a link again without storing it readable. */
export function encryptToken(token: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.')
}

export function decryptToken(stored: string): string {
  const [version, iv, tag, body] = stored.split('.')
  if (version !== VERSION || !iv || !tag || !body) throw new Error('Stored invitation link is unreadable')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
}

export interface IssuedToken {
  token: string
  tokenHash: string
  tokenEnc: string
}

export function issueToken(): IssuedToken {
  const token = generateToken()
  return { token, tokenHash: hashToken(token), tokenEnc: encryptToken(token) }
}

/** Absolute guest link. `baseUrl` comes from NEXT_PUBLIC_BASE_URL, never from request headers. */
export function inviteUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/i/${token}`
}
