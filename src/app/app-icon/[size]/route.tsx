import { ImageResponse } from 'next/og'
import { getWeddingConfig } from '@/lib/config'
import { loadFonts } from '@/lib/invitations/preview-card'
import { isIconSize, siteIdentity } from '@/lib/share-preview'

export const dynamic = 'force-dynamic'

/**
 * The site icon: the couple's initials in the site's serif on the dark
 * wedding ink, filling the square so each phone can apply its own corner shape.
 */
export async function GET(_request: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size)
  if (!isIconSize(size)) return new Response(null, { status: 404 })
  const [config, fonts] = await Promise.all([getWeddingConfig(), loadFonts()])
  const identity = siteIdentity(config.partner1, config.partner2)
  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: identity.ink, color: identity.background, fontFamily: fonts.length ? 'Cormorant' : 'serif', fontWeight: 500, fontSize: Math.round(size * 0.46), letterSpacing: size <= 32 ? 0 : Math.round(size * 0.01) }}>
        {identity.monogram}
      </div>
    ),
    { width: size, height: size, fonts },
  )
  return new Response(await image.arrayBuffer(), { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } })
}
