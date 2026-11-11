/**
 * Placeholders that can appear in invitation wording. They are stored as
 * {firstName} and so on, and shown to the couple as pills.
 */
export const TOKENS = [
  { key: 'firstName', label: 'First name' },
  { key: 'partner1', label: 'Partner 1' },
  { key: 'partner2', label: 'Partner 2' },
  { key: 'date', label: 'Date' },
  { key: 'link', label: 'Link' },
] as const

export type TokenKey = (typeof TOKENS)[number]['key']

const PERSON_AND_DATE: readonly TokenKey[] = ['firstName', 'partner1', 'partner2', 'date']

/** Which placeholders make sense in which piece of wording. The link only belongs in the share message. */
export const FIELD_TOKENS = {
  previewTitle: PERSON_AND_DATE,
  previewDescription: PERSON_AND_DATE,
  emailSubject: PERSON_AND_DATE,
  emailIntro: PERSON_AND_DATE,
  shareMessage: [...PERSON_AND_DATE, 'link'],
} as const satisfies Record<string, readonly TokenKey[]>

export type TemplateField = keyof typeof FIELD_TOKENS

export function tokenLabel(key: TokenKey): string {
  return TOKENS.find(token => token.key === key)?.label ?? key
}

/** Anything written in braces on one line counts as an attempted placeholder. */
const BRACES = /\{([^{}\n]{0,60})\}/g

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_unused, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

/** The allowed placeholder a mistyped one most likely meant, if any is close enough. */
export function suggestToken(raw: string, allowed: readonly TokenKey[]): TokenKey | null {
  const wanted = normalise(raw)
  if (!wanted) return null
  let best: { key: TokenKey; score: number } | null = null
  for (const key of allowed) {
    const score = Math.min(distance(wanted, normalise(key)), distance(wanted, normalise(tokenLabel(key))))
    if (!best || score < best.score) best = { key, score }
  }
  return best && best.score <= Math.max(2, Math.floor(wanted.length / 3)) ? best.key : null
}

export interface UnknownToken {
  /** Exactly what was written, braces included. */
  raw: string
  suggestion: TokenKey | null
}

/** Every braced word that is not an allowed placeholder for this field, each listed once. */
export function unknownTokens(text: string, allowed: readonly TokenKey[]): UnknownToken[] {
  const found = new Map<string, UnknownToken>()
  for (const match of text.matchAll(BRACES)) {
    const inner = match[1]
    if ((allowed as readonly string[]).includes(inner)) continue
    if (!found.has(match[0])) found.set(match[0], { raw: match[0], suggestion: suggestToken(inner, allowed) })
  }
  return [...found.values()]
}

export type Segment = { type: 'text'; value: string } | { type: 'token'; key: TokenKey }

/** Splits wording into plain text and allowed placeholders, in order. Unknown braces stay as text. */
export function toSegments(text: string, allowed: readonly TokenKey[]): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  for (const match of text.matchAll(BRACES)) {
    if (!(allowed as readonly string[]).includes(match[1])) continue
    const start = match.index ?? 0
    if (start > cursor) segments.push({ type: 'text', value: text.slice(cursor, start) })
    segments.push({ type: 'token', key: match[1] as TokenKey })
    cursor = start + match[0].length
  }
  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) })
  return segments
}

export function fromSegments(segments: readonly Segment[]): string {
  return segments.map(segment => (segment.type === 'text' ? segment.value : `{${segment.key}}`)).join('')
}

/** A sentence describing what is wrong with a field, or null when it is fine. */
export function templateProblem(field: TemplateField, text: string): string | null {
  const allowed = FIELD_TOKENS[field]
  const [unknown] = unknownTokens(text, allowed)
  if (unknown) {
    return unknown.suggestion
      ? `${unknown.raw} is not a placeholder. Did you mean ${tokenLabel(unknown.suggestion)}?`
      : `${unknown.raw} is not a placeholder. Use the buttons to insert one.`
  }
  if (field === 'shareMessage' && !text.includes('{link}')) return 'The message needs the Link placeholder, or the guest gets no link.'
  return null
}
