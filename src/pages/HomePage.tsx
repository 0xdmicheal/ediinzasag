import { Link } from "react-router-dom"

import { FrontPhoto } from "@/components/site/FrontPhoto"
import { MarketStrip } from "@/components/site/MarketStrip"
import Blog1 from "@/components/ui/blog-1"
import { Button } from "@/components/ui/button"
import { channels, episodes } from "@/content/channels"
import { substackPosts } from "@/content/substack.posts"
import {
  byDate,
  deskLabel,
  formatStoryDate,
  storiesByDesk,
  storyArt,
  topicLabel,
  type Story,
} from "@/content/stories"

export function HomePage() {
  const latest = byDate().slice(0, 5)
  const heroSlugs = new Set(latest.map((story) => story.slug))
  const mongoliaDesk = storiesByDesk("mongolia")
  const mongolia = [
    ...mongoliaDesk.filter((story) => !heroSlugs.has(story.slug)),
    ...mongoliaDesk.filter((story) => heroSlugs.has(story.slug)),
  ].slice(0, 6)
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
      <section className="px-4 pt-6 xl:px-[300px]">
        <FrontPhoto stories={latest} />
        <div className="-mx-4 mt-10 xl:-mx-[300px]">
          <MarketStrip />
        </div>
      </section>

      <Blog1
        className="px-4 py-10 sm:px-6 xl:px-[440px]"
        header={{
          badge: "Substack",
          heading: "Нийтлэл",
          ctaText: "Бүх нийтлэлүүд",
          ctaHref: "/newsletter",
        }}
        posts={substackPosts.slice(0, 6).map((post) => ({
          date: /^\d{4}-\d{2}-\d{2}$/.test(post.date) ? formatStoryDate(post.date) : post.date,
          title: post.title,
          author: { name: post.author || "Нийтлэл", role: "Захидал" },
          href: `/letter/${post.slug}`,
          imageSrc: post.image,
          imageAlt: "",
        }))}
        renderCtaLink={({ href, children }) => <Link to={href}>{children}</Link>}
        renderCardLink={({ href, children }) => (
          <Link to={href} className="block h-full focus-visible:ring-2 focus-visible:outline-none">
            {children}
          </Link>
        )}
      />

      <Blog1
        className="px-4 py-10 sm:px-6 xl:px-[440px]"
        header={{
          badge: "Өнөөдрийн тойм",
          heading: "Монголын мэдээ",
          ctaText: "Бүх монгол тойм",
          ctaHref: "/mongolia",
        }}
        posts={mongolia.slice(0, 6).map(toBlogPost)}
        renderCtaLink={({ href, children }) => <Link to={href}>{children}</Link>}
        renderCardLink={({ href, children }) => (
          <Link to={href} className="block h-full focus-visible:ring-2 focus-visible:outline-none">
            {children}
          </Link>
        )}
      />

      <Blog1
        id="delhiin-shiree"
        className="px-4 py-10 sm:px-6 xl:px-[440px]"
        header={{
          badge: "Дэлхий",
          heading: "Дэлхийн мэдээ",
          ctaText: "Бүх дэлхийн тойм",
          ctaHref: "/world",
        }}
        posts={world.map(toBlogPost)}
        renderCtaLink={({ href, children }) => <Link to={href}>{children}</Link>}
        renderCardLink={({ href, children }) => (
          <Link to={href} className="block h-full focus-visible:ring-2 focus-visible:outline-none">
            {children}
          </Link>
        )}
      />

      {more.length > 0 ? (
        <section className="px-4 py-6 sm:px-6 xl:px-[440px]">
          <h2 className="font-news text-3xl">Бусад тойм</h2>
          <div className="mt-4 divide-y border-y">
            {more.map((story) => (
              <article key={story.slug} className="grid gap-4 py-5 md:grid-cols-[9rem_8rem_1fr]">
                <img
                  src={storyArt(story.slug).src}
                  alt=""
                  className="h-36 w-full object-cover md:h-24"
                />
                <p className="text-muted-foreground text-sm">{formatStoryDate(story.date)}</p>
                <div>
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    {deskLabel[story.desk]} · {topicLabel[story.topic]}
                  </p>
                  <h3 className="font-news mt-1 text-2xl leading-snug">
                    <Link to={`/story/${story.slug}`} className="hover:underline">
                      {story.title}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{story.dek}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="px-4 py-10 sm:px-6 xl:px-[440px]">
        <div className="overflow-hidden border">
          <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="flex flex-col justify-between gap-8 p-6">
              <div>
                <p className="text-muted-foreground text-[11px] tracking-[0.22em] uppercase">
                  EZ Talk · {episodes[0].date}
                </p>
                <h2 className="font-news mt-3 text-3xl leading-tight sm:text-4xl">{episodes[0].title}</h2>
                {episodes[0].note ? (
                  <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">{episodes[0].note}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="w-fit">
                  <Link to="/ez-talk">Дугаарууд</Link>
                </Button>
                <Button asChild variant="outline" className="w-fit">
                  <a href={channels.youtube} target="_blank" rel="noreferrer">
                    Суваг
                  </a>
                </Button>
              </div>
            </div>
            <div className="grid border-t md:border-t-0 md:border-l">
              {episodes.slice(1, 4).map((episode) => (
                <Link
                  key={episode.href}
                  to="/ez-talk"
                  className="flex flex-col justify-center border-b px-5 py-4 hover:bg-muted/60"
                >
                  <span className="text-muted-foreground text-[11px] tracking-wide uppercase">{episode.date}</span>
                  <span className="mt-1 text-sm leading-snug">{episode.title}</span>
                </Link>
              ))}
              <Link to="/about#partner" className="flex items-center justify-between px-5 py-4 hover:bg-muted/60">
                <span>
                  <span className="text-muted-foreground block text-[11px] tracking-[0.18em] uppercase">Хамтрах</span>
                  <span className="mt-1 block text-sm">Зочин, брэнд, судалгаа</span>
                </span>
                <span className="text-muted-foreground text-sm">Бид</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function toBlogPost(story: Story) {
  const art = storyArt(story.slug)
  return {
    date: `${formatStoryDate(story.date)} · ${topicLabel[story.topic]}`,
    title: story.title,
    author: { name: "EZ тойм", role: `${story.readMinutes} мин` },
    href: `/story/${story.slug}`,
    imageSrc: art.src,
    imageAlt: art.alt,
  }
}

