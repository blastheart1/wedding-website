import { Navbar }        from '@/components/sections/Navbar'
import { Hero }          from '@/components/sections/Hero'
import { Story }         from '@/components/sections/Story'
import { Countdown }     from '@/components/sections/Countdown'
import { Details }       from '@/components/sections/Details'
import { Gallery }       from '@/components/sections/Gallery'
import { FAQSection }    from '@/components/sections/FAQSection'
import { GamesSection }  from '@/components/sections/GamesSection'
import { RSVPSection }   from '@/components/sections/RSVPSection'
import { Footer }        from '@/components/sections/Footer'
import {
  FlowersBox,
  HERO_FLOWERS,
  STORY_FLOWERS,
  COUNTDOWN_FLOWERS,
  FAQ_FLOWERS,
} from '@/components/ui/FlowersBox'
import { getWeddingConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const config = await getWeddingConfig()

  return (
    <main>
      <Navbar config={config} />

      {/* Hero */}
      <div className="relative overflow-visible">
        <Hero config={config} />
        <FlowersBox flowers={HERO_FLOWERS} />
      </div>

      {/* Story */}
      <div className="relative overflow-visible">
        <Story
          bgUrl={config.storyBgUrl || undefined}
          chapters={config.storyChapters}
          heading={config.sectionHeadings.story}
        />
        <FlowersBox flowers={STORY_FLOWERS} />
      </div>

      {/* Countdown */}
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

      {/* FAQ — before RSVP */}
      <div className="relative overflow-visible">
        <FAQSection
          bgUrl={config.faqBgUrl || undefined}
          heading={config.sectionHeadings.faq}
        />
        <FlowersBox flowers={FAQ_FLOWERS} />
      </div>

      {/* Mini-games */}
      <GamesSection />

      <RSVPSection config={config} heading={config.sectionHeadings.rsvp} />
      <Footer config={config} />
    </main>
  )
}
