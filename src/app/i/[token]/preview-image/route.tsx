import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { getWeddingConfig } from '@/lib/config'
import { loadInviteView } from '@/lib/invitations/service'
import { inviteStore } from '@/lib/invitations/store'
import { formatWeddingDate } from '@/lib/invitations/format'

export const dynamic = 'force-dynamic'

const SIZE = { width: 1200, height: 630 }
const INK = '#2E1F1A'
const INK_SOFT = '#7A5C54'
const CREAM = '#FDFAF6'

type FontWeight = 400 | 500
interface PreviewFont { name: string; data: Buffer; weight: FontWeight; style: 'normal' | 'italic' }

/** The site's own typefaces. If they cannot be read the image still renders with the built-in font. */
async function loadFonts(): Promise<PreviewFont[]> {
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

/** Link-preview image: the guest's first name on the wedding theme. Unknown links get the same image without a name. */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const [config, fonts] = await Promise.all([getWeddingConfig(), loadFonts()])
  let firstName = ''
  try {
    firstName = (await loadInviteView(inviteStore, params.token))?.firstName ?? ''
  } catch {
    firstName = ''
  }
  const serif = fonts.length ? 'Cormorant' : 'serif'
  const sans = fonts.length ? 'Jost' : 'sans-serif'

  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: CREAM, color: INK }}>
        <div style={{ display: 'flex', fontFamily: sans, fontSize: 26, letterSpacing: 8, color: INK_SOFT, textTransform: 'uppercase' }}>
          {firstName ? 'You are invited' : 'Our wedding'}
        </div>
        {firstName && (
          <div style={{ display: 'flex', marginTop: 28, fontFamily: serif, fontStyle: 'italic', fontSize: 120, lineHeight: 1.05 }}>
            {firstName}
          </div>
        )}
        <div style={{ display: 'flex', width: 120, minWidth: 120, height: 2, minHeight: 2, flexShrink: 0, backgroundColor: '#CFC2BB', marginTop: 40, marginBottom: 40 }} />
        <div style={{ display: 'flex', fontFamily: serif, fontWeight: 500, fontSize: firstName ? 64 : 110 }}>
          {config.partner1} &amp; {config.partner2}
        </div>
        <div style={{ display: 'flex', marginTop: 18, fontFamily: sans, fontSize: 30, color: INK_SOFT }}>
          {formatWeddingDate(config.weddingDate)}
        </div>
      </div>
    ),
    { ...SIZE, fonts },
  )
  // ImageResponse adds a year-long public cache header by default. A personalised
  // image must not be stored by shared caches, so the headers are set outright.
  return new Response(image.body, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  })
}
