import { cookies } from 'next/headers'
import { WeddingSite } from '@/components/WeddingSite'
import { SitePreloader } from '@/components/loading/SitePreloader'
import { StatusBarColor } from '@/components/loading/StatusBarColor'
import { getWeddingConfig } from '@/lib/config'
import { formatWeddingDate } from '@/lib/invitations/format'
import { VISITED_COOKIE } from '@/lib/loading/assets'

export const dynamic = 'force-dynamic'

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
