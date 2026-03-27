import { Navbar }      from '@/components/sections/Navbar'
import { Hero }        from '@/components/sections/Hero'
import { Story }       from '@/components/sections/Story'
import { Countdown }   from '@/components/sections/Countdown'
import { Details }     from '@/components/sections/Details'
import { Gallery }     from '@/components/sections/Gallery'
import { RSVPSection } from '@/components/sections/RSVPSection'
import { Footer }      from '@/components/sections/Footer'
import { FloralBand, FloralPop } from '@/components/ui/FloralDivider'
import { getWeddingConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const config = await getWeddingConfig()

  return (
    <main>
      <Navbar config={config} />
      <Hero   config={config} />

      <FloralBand height={130} />

      <Story />

      <FloralPop className="bg-petal" />

      <Countdown   config={config} />
      <Details     config={config} />

      <FloralBand height={130} />

      <Gallery />
      <RSVPSection config={config} />
      <Footer config={config} />
    </main>
  )
}
