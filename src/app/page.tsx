import { Navbar }      from '@/components/sections/Navbar'
import { Hero }        from '@/components/sections/Hero'
import { Story }       from '@/components/sections/Story'
import { Countdown }   from '@/components/sections/Countdown'
import { Details }     from '@/components/sections/Details'
import { Gallery }     from '@/components/sections/Gallery'
import { RSVPSection } from '@/components/sections/RSVPSection'
import { Footer }      from '@/components/sections/Footer'
import {
  FlowersBox,
  HERO_FLOWERS,
  STORY_FLOWERS,
  COUNTDOWN_FLOWERS,
} from '@/components/ui/FlowersBox'
import { getWeddingConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const config = await getWeddingConfig()

  return (
    <main>
      <Navbar config={config} />

      {/* Hero — flowers at the bottom edges, each pops in independently on scroll */}
      <div className="relative overflow-visible">
        <Hero config={config} />
        <FlowersBox flowers={HERO_FLOWERS} />
      </div>

      {/* Story — flowers visible at bottom while scrolling through */}
      <div className="relative overflow-visible">
        <Story
          bgUrl={config.storyBgUrl || undefined}
          chapters={config.storyChapters}
          heading={config.sectionHeadings.story}
        />
        <FlowersBox flowers={STORY_FLOWERS} />
      </div>

      {/* Countdown — flowers at bottom edges */}
      <div className="relative overflow-visible">
        <Countdown
          config={config}
          bgUrl={config.countdownBgUrl || undefined}
          heading={config.sectionHeadings.countdown}
        />
        <FlowersBox flowers={COUNTDOWN_FLOWERS} />
      </div>

      <Details
        config={config}
        bgUrl={config.detailsBgUrl || undefined}
        heading={config.sectionHeadings.details}
      />

      <Gallery
        bgUrl={config.galleryBgUrl || undefined}
        heading={config.sectionHeadings.gallery}
      />

      <RSVPSection config={config} heading={config.sectionHeadings.rsvp} />
      <Footer config={config} />
    </main>
  )
}
