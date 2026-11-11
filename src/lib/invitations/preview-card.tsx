import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { PREVIEW_SIZE } from '@/lib/share-preview'

const INK = '#2E1F1A'
const INK_SOFT = '#7A5C54'
const ROSE = '#994657'
const CREAM = '#FDFAF6'
const RULE = '#CFC2BB'

interface PreviewFont { name: string; data: Buffer; weight: 400 | 500; style: 'normal' | 'italic' }

/** The site's own typefaces. If they cannot be read the card still renders with the built-in font. */
export async function loadFonts(): Promise<PreviewFont[]> {
  const file = (name: string) => readFile(path.join(process.cwd(), 'public', 'wedding', name))
  try {
    const [serif, serifItalic, sans] = await Promise.all([file('font-3.ttf'), file('font-1.ttf'), file('font-4.ttf')])
    return [
      { name: 'Cormorant', data: serif, weight: 500, style: 'normal' },
      { name: 'Cormorant', data: serifItalic, weight: 400, style: 'italic' },
      { name: 'Jost', data: sans, weight: 400, style: 'normal' },
    ]
  } catch {
    return []
  }
}

export interface PreviewCardInput {
  /** Small line at the top, e.g. "You are invited". */
  kicker: string
  /** A guest's first name, shown large. Leave empty for the general site card. */
  guestName?: string
  partner1: string
  partner2: string
  date: string
}

/**
 * The picture shown beside a shared link: cream card, the couple's names in
 * the site's serif with a rose ampersand, and the date. With a guest name it
 * becomes that guest's personal card. Returns PNG bytes at 1200 by 630.
 */
export async function renderPreviewCard(card: PreviewCardInput): Promise<ArrayBuffer> {
  const fonts = await loadFonts()
  const serif = fonts.length ? 'Cormorant' : 'serif'
  const sans = fonts.length ? 'Jost' : 'sans-serif'
  const personal = Boolean(card.guestName)
  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: CREAM, color: INK }}>
        <div style={{ display: 'flex', fontFamily: sans, fontSize: 26, letterSpacing: 8, color: INK_SOFT, textTransform: 'uppercase' }}>{card.kicker}</div>
        {personal && <div style={{ display: 'flex', marginTop: 28, fontFamily: serif, fontStyle: 'italic', fontSize: 120, lineHeight: 1.05 }}>{card.guestName}</div>}
        {personal && <div style={{ display: 'flex', width: 120, minWidth: 120, height: 2, minHeight: 2, flexShrink: 0, backgroundColor: RULE, marginTop: 40, marginBottom: 40 }} />}
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: personal ? 0 : 30, fontFamily: serif, fontWeight: 500, fontSize: personal ? 64 : 132, lineHeight: 1.05 }}>
          <span>{card.partner1}</span>
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: ROSE, marginLeft: personal ? 18 : 34, marginRight: personal ? 18 : 34 }}>&amp;</span>
          <span>{card.partner2}</span>
        </div>
        {!personal && <div style={{ display: 'flex', width: 120, minWidth: 120, height: 2, minHeight: 2, flexShrink: 0, backgroundColor: RULE, marginTop: 44, marginBottom: 34 }} />}
        <div style={{ display: 'flex', marginTop: personal ? 18 : 0, fontFamily: sans, fontSize: personal ? 30 : 34, letterSpacing: personal ? 0 : 3, color: INK_SOFT }}>{card.date}</div>
      </div>
    ),
    { ...PREVIEW_SIZE, fonts },
  )
  return image.arrayBuffer()
}
