import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, ArrowUpRight, Play } from "lucide-react"

import { youtubeId } from "@/components/site/YoutubeFrame"
import { channels, type Episode } from "@/content/channels"
import {
  deskLabel,
  formatStoryDate,
  storyArt,
  topicLabel,
  type Story,
  type Topic,
} from "@/content/stories"
import type { SubstackPost } from "@/content/substack.posts"

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

const topicHue: Record<Topic, string> = {
  policy: "oklch(0.62 0.12 250)",
  mining: "oklch(0.62 0.12 45)",
  fuel: "oklch(0.64 0.16 30)",
  markets: "oklch(0.62 0.13 155)",
  energy: "oklch(0.74 0.14 85)",
  us: "oklch(0.58 0.11 265)",
  china: "oklch(0.6 0.17 25)",
  europe: "oklch(0.6 0.1 225)",
}

function letterDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatStoryDate(value) : value
}

export function SectionHeader({
  index,
  kicker,
  title,
  children,
}: {
  index: string
  kicker: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div>
        <p className="text-brand-strong flex items-center gap-2.5 font-mono text-[12px] tracking-[0.04em] uppercase">
          <span>{index}</span>
          <span aria-hidden>—</span>
          {kicker}
        </p>
        <h2 className="font-news mt-1.5 text-3xl leading-none sm:text-4xl">{title}</h2>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  )
}

export function HeaderLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="ez-hit group hover:bg-foreground hover:text-background inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors"
    >
      {children}
      <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  )
}

function TopicChip({ topic, onPhoto = false }: { topic: Topic; onPhoto?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${onPhoto ? "text-photo-foreground border-white/15 bg-black/35 backdrop-blur-sm" : "bg-background/60"}`}
    >
      <span className="size-1.5 rounded-full" style={{ background: topicHue[topic] }} />
      {topicLabel[topic]}
    </span>
  )
}

/** Round arrow that fills with the brand color when its card is hovered. */
function CardArrow({ className = "" }: { className?: string }) {
  return (
    <span
      className={`group-hover:bg-brand group-hover:text-brand-foreground group-hover:border-brand grid size-8 shrink-0 place-items-center rounded-full border transition-colors duration-300 ${className}`}
    >
      <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:rotate-45" />
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="bg-brand/20 text-brand-strong grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
      {(name || "E").slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Remote cover with a graceful fallback when the image fails. */
function Cover({ src, alt = "", className = "" }: { src?: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={`bg-brand/25 grid place-items-center ${className}`}>
        <span className="font-news text-brand-strong/50 text-4xl font-bold">EZ</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}

const zoom = "transition-transform duration-700 ease-out group-hover:scale-[1.05]"

/* ------------------------------------------------------------------ */
/* Нийтлэл: bento shelf                                                */
/* ------------------------------------------------------------------ */

export function LetterBento({ posts }: { posts: SubstackPost[] }) {
  const [feature, ...rest] = posts
  if (!feature) return null

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
      <Link
        to={`/letter/${feature.slug}`}
        className="group ez-lift relative isolate flex min-h-[19rem] flex-col justify-end overflow-hidden rounded-lg sm:min-h-[22rem] md:col-span-2 lg:row-span-2"
      >
        <Cover src={feature.image} className={`absolute inset-0 -z-10 h-full w-full ${zoom}`} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/95 from-25% via-black/70 via-55% to-black/15" />
        <div className="text-photo-foreground p-5 sm:p-6">
          <p className="text-photo-foreground/75 text-[11px] tracking-[0.16em] uppercase">
            Онцлох захидал · {letterDate(feature.date)}
          </p>
          <h3 className="font-news mt-2.5 text-2xl leading-[1.1] sm:text-[1.75rem]">
            <span className="ez-underline">{feature.title}</span>
          </h3>
          {feature.excerpt ? (
            <p className="text-photo-foreground/80 mt-2.5 line-clamp-2 max-w-lg text-sm leading-relaxed">
              {feature.excerpt}
            </p>
          ) : null}
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 text-sm">
              <Avatar name={feature.author} />
              {feature.author || "EZ"}
            </span>
            <span className="bg-brand text-brand-foreground inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-transform group-hover:translate-x-1">
              Унших
              <ArrowRight className="size-4" />
            </span>
          </div>
        </div>
      </Link>

      {rest.slice(0, 4).map((post) => (
        <Link
          key={post.slug}
          to={`/letter/${post.slug}`}
          // Phones: a compact row (thumbnail beside the title). Tablet up: a card.
          className="group ez-lift bg-card flex flex-row overflow-hidden rounded-lg border md:flex-col"
        >
          <div className="relative w-28 shrink-0 overflow-hidden sm:w-36 md:aspect-[2/1] md:w-auto">
            <Cover src={post.image} className={`h-full w-full ${zoom}`} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-3 md:p-3.5">
            <p className="text-muted-foreground text-[11px] tracking-[0.12em] uppercase">{letterDate(post.date)}</p>
            <h3 className="font-news mt-1.5 line-clamp-2 text-[17px] leading-snug">
              <span className="ez-underline">{post.title}</span>
            </h3>
            <div className="mt-auto flex items-center justify-between gap-3 pt-3">
              <span className="flex min-w-0 items-center gap-2 text-[13px]">
                <Avatar name={post.author} />
                <span className="truncate">{post.author || "EZ"}</span>
              </span>
              <CardArrow />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Монгол: newspaper spread                                            */
/* ------------------------------------------------------------------ */

export function DeskSpread({ stories }: { stories: Story[] }) {
  const [lead, ...rest] = stories
  if (!lead) return null
  const art = storyArt(lead.slug)

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-7">
      <Link
        to={`/story/${lead.slug}`}
        className="group ez-lift bg-card flex flex-col overflow-hidden rounded-lg border lg:col-span-7"
      >
        <div className="relative aspect-[16/9] overflow-hidden lg:aspect-[2/1]">
          <img src={art.src} alt={art.alt} className={`h-full w-full object-cover ${zoom}`} />
          <div className="absolute top-4 left-4">
            <TopicChip topic={lead.topic} onPhoto />
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-muted-foreground text-xs">
            {formatStoryDate(lead.date)} · {lead.readMinutes} мин уншина
          </p>
          <h3 className="font-news mt-2 text-2xl leading-[1.12] sm:text-[1.75rem]">
            <span className="ez-underline">{lead.title}</span>
          </h3>
          <p className="text-muted-foreground mt-2.5 line-clamp-2 text-sm leading-relaxed">{lead.dek}</p>
          <div className="mt-auto flex items-center justify-between pt-4">
            <span className="text-[13px] font-medium">Тоймыг унших</span>
            <CardArrow />
          </div>
        </div>
      </Link>

      <ol className="lg:col-span-5 lg:flex lg:flex-col">
        {rest.map((story, itemIndex) => {
          const thumb = storyArt(story.slug)
          return (
            <li key={story.slug} className="border-b first:border-t lg:flex lg:flex-1 lg:first:border-t-0">
              <Link
                to={`/story/${story.slug}`}
                className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 py-4"
              >
                <span className="font-news text-foreground/20 group-hover:text-brand-strong w-9 text-3xl leading-none tabular-nums transition-colors duration-300">
                  {String(itemIndex + 2).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase">
                    <span className="size-1.5 rounded-full" style={{ background: topicHue[story.topic] }} />
                    {topicLabel[story.topic]} · {formatStoryDate(story.date)}
                  </span>
                  <span className="font-news mt-1 line-clamp-2 block text-[17px] leading-snug">
                    <span className="ez-underline">{story.title}</span>
                  </span>
                </span>
                <span className="relative size-16 shrink-0 overflow-hidden rounded-md sm:size-[4.5rem]">
                  <img
                    src={thumb.src}
                    alt=""
                    className="h-full w-full object-cover grayscale-[60%] transition duration-500 group-hover:scale-105 group-hover:grayscale-0"
                  />
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Дэлхий: swipeable rail                                              */
/* ------------------------------------------------------------------ */

/**
 * Дэлхийн мэдээ: a grid of photo cards. Two columns on phones, three on
 * desktop. It used to be a sideways-scrolling rail, but sideways swipes on the
 * home page read as the page itself moving, and the scroll box clipped the
 * cards' hover shadow.
 */
export function StoryRail({
  index,
  kicker,
  title,
  ctaText,
  ctaTo,
  stories,
}: {
  index: string
  kicker: string
  title: string
  ctaText: string
  ctaTo: string
  stories: Story[]
}) {
  return (
    <>
      <SectionHeader index={index} kicker={kicker} title={title}>
        <HeaderLink to={ctaTo}>{ctaText}</HeaderLink>
      </SectionHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stories.map((story) => {
          const art = storyArt(story.slug)
          return (
            <Link
              key={story.slug}
              to={`/story/${story.slug}`}
              className="group ez-lift relative isolate flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-lg sm:aspect-[4/5]"
            >
              <img src={art.src} alt={art.alt} className={`absolute inset-0 -z-10 h-full w-full object-cover ${zoom}`} />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/95 from-20% via-black/60 via-55% to-black/15" />
              <div className="flex items-start justify-between gap-2 p-2.5 sm:p-3.5">
                <TopicChip topic={story.topic} onPhoto />
                <span className="text-photo-foreground/70 hidden text-[11px] tabular-nums sm:inline">{formatStoryDate(story.date)}</span>
              </div>
              <div className="text-photo-foreground p-3 sm:p-4">
                <h3 className="font-news line-clamp-4 text-[15px] leading-[1.2] sm:line-clamp-3 sm:text-xl sm:leading-[1.15]">
                  <span className="ez-underline">{story.title}</span>
                </h3>
                <div className="hidden grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr] sm:grid">
                  <p className="text-photo-foreground/80 overflow-hidden text-sm leading-relaxed">
                    <span className="line-clamp-3 pt-2 text-[13px]">{story.dek}</span>
                  </p>
                </div>
                <p className="text-photo-foreground/70 mt-2 flex items-center justify-between text-[11px] sm:mt-3">
                  <span>{story.readMinutes} мин уншина</span>
                  <ArrowUpRight className="group-hover:text-brand size-4 transition-transform duration-300 group-hover:rotate-45" />
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}

export function CompactGrid({ stories }: { stories: Story[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]">
      {stories.map((story) => {
        const art = storyArt(story.slug)
        return (
          <Link
            key={story.slug}
            to={`/story/${story.slug}`}
            className="group ez-lift bg-card flex items-center gap-3.5 rounded-lg border p-2.5"
          >
            <span className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-md">
              <img src={art.src} alt="" className={`h-full w-full object-cover ${zoom}`} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase">
                <span className="size-1.5 rounded-full" style={{ background: topicHue[story.topic] }} />
                {deskLabel[story.desk]} · {topicLabel[story.topic]}
              </span>
              <span className="font-news mt-0.5 line-clamp-2 block text-base leading-snug">
                <span className="ez-underline">{story.title}</span>
              </span>
              <span className="text-muted-foreground mt-1 block text-xs">{formatStoryDate(story.date)}</span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* EZ Talk: dark band                                                  */
/* ------------------------------------------------------------------ */

function minutes(seconds: number) {
  return `${Math.round(seconds / 60)} мин`
}

function EpisodeThumb({ episode, quality, className }: { episode: Episode; quality: "max" | "hq"; className: string }) {
  const id = youtubeId(episode.href)
  const [src, setSrc] = useState(
    id ? `https://i.ytimg.com/vi/${id}/${quality === "max" ? "maxresdefault" : "hqdefault"}.jpg` : "",
  )
  if (!src) return <div className={`bg-ink-foreground/10 ${className}`} />
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => {
        const fallback = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
        setSrc(src === fallback ? "" : fallback)
      }}
      className={`object-cover ${className}`}
    />
  )
}

export function TalkBand({ episodes }: { episodes: Episode[] }) {
  const [latest, ...more] = episodes
  if (!latest) return null

  return (
    <section className="bg-ink text-ink-foreground grid overflow-hidden rounded-lg lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Link to="/ez-talk" className="group relative isolate block aspect-video self-center overflow-hidden">
        <EpisodeThumb episode={latest} quality="max" className={`absolute inset-0 -z-10 h-full w-full ${zoom}`} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/95 from-15% via-black/45 via-45% to-black/5" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="bg-brand text-brand-foreground grid size-14 place-items-center rounded-full shadow-[0_0_0_8px_oklch(1_0_0/0.12)] transition-transform duration-300 group-hover:scale-110 sm:size-16">
            <Play className="ml-0.5 size-6 fill-current" />
          </span>
        </span>
        <div className="text-photo-foreground absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="text-photo-foreground/75 text-[11px] tracking-[0.16em] uppercase">
            Шинэ дугаар · {latest.date} · {minutes(latest.seconds)}
          </p>
          <h3 className="font-news mt-1.5 max-w-lg text-xl leading-tight sm:text-2xl">{latest.title}</h3>
        </div>
      </Link>

      <div className="flex flex-col p-5 sm:p-6">
        <p className="text-ink-foreground/65 text-[11px] tracking-[0.2em] uppercase">YouTube · @ediinzasag</p>
        <h2 className="font-news mt-1.5 text-4xl leading-none">EZ Talk</h2>
        <p className="text-ink-foreground/70 mt-3 max-w-md text-sm leading-relaxed">
          Эдийн засагч Nio, зах зээлийн шинжээч Ulemj. Сэдэв бүрийг тоогоор нь ярина.
        </p>
        <ul className="border-ink-foreground/15 mt-4 border-t">
          {more.slice(0, 3).map((episode) => (
            <li key={episode.href} className="border-ink-foreground/15 border-b">
              <Link to="/ez-talk" className="group hover:bg-ink-foreground/5 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors">
                <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-sm">
                  <EpisodeThumb episode={episode} quality="hq" className="h-full w-full" />
                </span>
                <span className="min-w-0">
                  <span className="text-ink-foreground/65 block text-[11px] tracking-wide uppercase">
                    {episode.date} · {minutes(episode.seconds)}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-sm">{episode.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Link
            to="/ez-talk"
            className="bg-brand text-brand-foreground inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-transform hover:-translate-y-0.5"
          >
            Бүх дугаар
            <ArrowRight className="size-4" />
          </Link>
          <a
            href={channels.youtube}
            target="_blank"
            rel="noreferrer"
            className="border-ink-foreground/25 hover:bg-ink-foreground/10 inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium transition-colors"
          >
            Суваг
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  )
}
