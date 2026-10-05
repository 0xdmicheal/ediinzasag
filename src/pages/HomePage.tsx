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
import { byDate, storiesByDesk } from "@/content/stories"
import { substackPosts } from "@/content/substack.posts"

const container = "mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8"
// Sections sit in a narrower column than the hero so the hero stays the focal point.
const sectionContainer = "mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8"

export function HomePage() {
  const latest = byDate().slice(0, 3)
  const heroSlugs = new Set(latest.map((story) => story.slug))
  const mongoliaDesk = storiesByDesk("mongolia")
  const mongolia = [
    ...mongoliaDesk.filter((story) => !heroSlugs.has(story.slug)),
    ...mongoliaDesk.filter((story) => heroSlugs.has(story.slug)),
  ].slice(0, 5)
  const worldDesk = storiesByDesk("world")
  const world = [
    ...worldDesk.filter((story) => !heroSlugs.has(story.slug)),
    ...worldDesk.filter((story) => heroSlugs.has(story.slug)),
  ].slice(0, 6)
  const featured = new Set<string>([
    ...heroSlugs,
    ...mongolia.map((story) => story.slug),
    ...world.map((story) => story.slug),
  ])
  const more = byDate().filter((story) => !featured.has(story.slug))

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
          <SectionHeader index="01" kicker="Substack" title="Нийтлэл">
            <HeaderLink to="/newsletter">Бүх нийтлэл</HeaderLink>
          </SectionHeader>
          <LetterBento posts={substackPosts.slice(0, 5)} />
        </section>

        <section>
          <SectionHeader index="02" kicker="Өнөөдрийн тойм" title="Монголын мэдээ">
            <HeaderLink to="/mongolia">Бүх монгол тойм</HeaderLink>
          </SectionHeader>
          <DeskSpread stories={mongolia} />
        </section>

        <section id="delhiin-shiree">
          <StoryRail
            index="03"
            kicker="Дэлхий"
            title="Дэлхийн мэдээ"
            ctaText="Бүх дэлхийн тойм"
            ctaTo="/world"
            stories={world}
          />
        </section>

        {more.length > 0 ? (
          <section>
            <SectionHeader index="04" kicker="Архив" title="Бусад тойм" />
            <CompactGrid stories={more} />
          </section>
        ) : null}

        <TalkBand episodes={episodes} />
      </div>
    </>
  )
}
