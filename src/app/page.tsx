import { Navbar }        from '@/components/sections/Navbar'
import { Hero }          from '@/components/sections/Hero'
import { Story }         from '@/components/sections/Story'
import { Countdown }     from '@/components/sections/Countdown'
import { Details }       from '@/components/sections/Details'
import { Gallery }       from '@/components/sections/Gallery'
import { RSVPSection }   from '@/components/sections/RSVPSection'
import { Footer }        from '@/components/sections/Footer'
import { FloralDivider } from '@/components/ui/FloralDivider'
import { getWeddingConfig } from '@/lib/config'

// Always render at request time so config changes show immediately.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const config = await getWeddingConfig()

  return (
    <main>
      <Navbar config={config} />
      <Hero   config={config} />
      <Story />
      <FloralDivider height={120} />
      <Countdown   config={config} />
      <Details     config={config} />
      <FloralDivider height={120} />
      <Gallery />
      <RSVPSection config={config} />
      <FloralDivider height={130} flip />
      <Footer config={config} />
    </main>
  )
}
