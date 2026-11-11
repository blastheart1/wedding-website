import type { MetadataRoute } from 'next'
import { getWeddingConfig } from '@/lib/config'
import { siteIdentity } from '@/lib/share-preview'

export const dynamic = 'force-dynamic'

/** Name, colours and icons used when a guest saves the site to their phone's home screen. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getWeddingConfig()
  const identity = siteIdentity(config.partner1, config.partner2)
  return {
    name: identity.name,
    short_name: identity.shortName,
    description: `The wedding of ${identity.name}.`,
    start_url: '/',
    display: 'standalone',
    background_color: identity.background,
    theme_color: identity.background,
    icons: [
      { src: '/app-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
