import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { WeddingSite } from '@/components/WeddingSite'
import { SitePreloader } from '@/components/loading/SitePreloader'
import { StatusBarColor } from '@/components/loading/StatusBarColor'
import { getWeddingConfig } from '@/lib/config'
import { formatWeddingDate, siteBaseUrl } from '@/lib/invitations/format'
import { sharePreview } from '@/lib/share-preview'
import { VISITED_COOKIE } from '@/lib/loading/assets'

export const dynamic = 'force-dynamic'

/** The preview apps show when the site address is shared, built from Site settings. */
export async function generateMetadata(): Promise<Metadata> {
  const config = await getWeddingConfig()
  const preview = sharePreview({
    partner1: config.partner1,
    partner2: config.partner2,
    date: formatWeddingDate(config.weddingDate),
    title: config.presentation.shareTitle,
    description: config.presentation.shareDescription,
    imageUrl: config.presentation.shareImageUrl,
    baseUrl: siteBaseUrl(),
  })
  return {
    alternates: { canonical: preview.url },
    openGraph: { type: 'website', locale: 'en_PH', url: preview.url, siteName: `${config.partner1} & ${config.partner2}`, title: preview.title, description: preview.description, images: [preview.image] },
    twitter: { card: 'summary_large_image', title: preview.title, description: preview.description, images: [preview.image.url] },
  }
}

export default async function Home() {
  const config = await getWeddingConfig()
  const returning = cookies().get(VISITED_COOKIE)?.value === '1'
  return (
    <>
      {/* Without scripts there is nothing to wait for, so the welcome is not shown at all. */}
      <noscript><style>{'.site-preloader{display:none}'}</style></noscript>
      <SitePreloader partner1={config.partner1} partner2={config.partner2} date={formatWeddingDate(config.weddingDate)} returning={returning} />
      <WeddingSite config={config} />
      <StatusBarColor />
    </>
  )
}
