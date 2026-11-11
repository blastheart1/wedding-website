import { WeddingSite } from '@/components/WeddingSite'
import { getWeddingConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const config = await getWeddingConfig()
  return <WeddingSite config={config} />
}
