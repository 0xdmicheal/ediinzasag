import { HeroShowcase } from "@/components/site/HeroShowcase"
import {
  CompactGrid,
  DeskSpread,
  HeaderLink,
  LetterBento,
  SectionHeader,
  StoryRail,
  TalkBand,
} from "@/components/site/home-sections"
import { MarketStrip } from "@/components/site/MarketStrip"
import { episodes } from "@/content/channels"
import { heroSlides } from "@/content/hero"
import { sortByDate, useStories } from "@/content/live"
import { byDate } from "@/content/stories"
import { substackPosts } from "@/content/substack.posts"

const container = "mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8"
// Sections sit in a narrower column than the hero so the hero stays the focal point.
const sectionContainer = "mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8"
const MORE_LIMIT = 6

export function HomePage() {
  // The hero shows the three newest built-in stories; lists include admin-published ones too.
  const { stories } = useStories()
  const all = sortByDate(stories)
  const heroSlugs = new Set(byDate().slice(0, 3).map((story) => story.slug))
  const mongoliaDesk = all.filter((story) => story.desk === "mongolia")
  const mongolia = [
    ...mongoliaDesk.filter((story) => !heroSlugs.has(story.slug)),
    ...mongoliaDesk.filter((story) => heroSlugs.has(story.slug)),
  ].slice(0, 5)
  const worldDesk = all.filter((story) => story.desk === "world")
  const world = [
    ...worldDesk.filter((story) => !heroSlugs.has(story.slug)),
    ...worldDesk.filter((story) => heroSlugs.has(story.slug)),
  ].slice(0, 6)
  const featured = new Set<string>([
    ...heroSlugs,
    ...mongolia.map((story) => story.slug),
    ...world.map((story) => story.slug),
  ])
  // A fixed shelf of the newest leftovers (two rows of three on desktop), so the home page
  // doesn't grow with every article. The full archive lives on the /mongolia and /world desks.
  const more = all.filter((story) => !featured.has(story.slug)).slice(0, MORE_LIMIT)

  return (
    <>
      <div className={`${container} pt-5`}>
        <HeroShowcase slides={heroSlides()} />
      </div>
      {/* The ticker sits with equal space above and below: hero → 40px → ticker → 40px → Нийтлэл. */}
      <div className="mt-8 sm:mt-10">
        <MarketStrip />
      </div>

      <div className={`${sectionContainer} flex flex-col gap-16 pt-8 pb-16 sm:gap-20 sm:pt-10 sm:pb-20`}>
        <section>
          <SectionHeader title="Нийтлэл">
            <HeaderLink to="/newsletter">Бүх нийтлэл</HeaderLink>
          </SectionHeader>
          <LetterBento posts={substackPosts.slice(0, 5)} />
        </section>

        <section>
          <SectionHeader title="Монголын мэдээ">
            <HeaderLink to="/mongolia">Бүх монгол тойм</HeaderLink>
          </SectionHeader>
          <DeskSpread stories={mongolia} />
        </section>

        <section id="delhiin-shiree">
          <StoryRail
            title="Дэлхийн мэдээ"
            ctaText="Бүх дэлхийн тойм"
            ctaTo="/world"
            stories={world}
          />
        </section>

        {more.length > 0 ? (
          <section>
            <SectionHeader title="Бусад тойм" />
            <CompactGrid stories={more} />
          </section>
        ) : null}

        <TalkBand episodes={episodes} />
      </div>
    </>
  )
}
