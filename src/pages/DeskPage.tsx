import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { sortByDate, useStories } from "@/content/live"
import {
  deskLabel,
  formatStoryDate,
  storyArt,
  topicLabel,
  type Desk,
  type Story,
} from "@/content/stories"

export function DeskPage({ desk }: { desk: Desk }) {
  const { stories } = useStories()
  const items = sortByDate(stories.filter((story) => story.desk === desk))
  const heroLead = items[0]
  const heroSides = items.slice(1, 3)
  const list = items.slice(1 + heroSides.length)

  return (
    <section className="mx-auto min-w-0 max-w-6xl overflow-x-clip px-4 py-10 sm:px-6">
      <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
        {desk === "mongolia" ? "Дотоод ширээ" : "Гадаад ширээ"}
      </p>
      <h1 className="font-news mt-2 text-5xl">{deskLabel[desk]}</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
        {desk === "mongolia"
          ? "Монголбанк, уул уурхай, хөрөнгийн зах, шатахуун. Тойм бүр нийтийн эх сурвалжаа нэрлэнэ."
          : "Эрчим хүч, АНУ, Хятад, Европ. Монголын импорт, экспорт, хүүнд хамаарах хэсгийг нь ялгана."}
      </p>

      {heroLead ? <DeskHero lead={heroLead} sides={heroSides} /> : null}

      <div className="mt-8 flex flex-col gap-3">
        {list.map((story) => (
            <article key={story.slug} className="bg-muted grid gap-4 rounded-lg border p-4 md:grid-cols-[11rem_8rem_1fr] md:items-center">
              <img
                src={storyArt(story.slug).src}
                alt=""
                className="aspect-[16/10] w-full rounded-md object-cover"
              />
              <p className="text-muted-foreground text-sm">{formatStoryDate(story.date)}</p>
              <div>
                <Badge variant="secondary">{topicLabel[story.topic]}</Badge>
                <h2 className="font-news mt-2 text-3xl leading-tight">
                  <Link to={`/story/${story.slug}`} className="hover:underline">
                    {story.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground mt-2 max-w-3xl">{story.dek}</p>
              </div>
            </article>
        ))}
      </div>
    </section>
  )
}

/**
 * The desk's front page: the lead story as a full-bleed photo with the headline
 * set on it, and the next two as photo tiles beside it. Every card is numbered
 * like a running order (01, 02, 03), and the text sits on a dark fade so it
 * reads on any photo, in both themes.
 */
function DeskHero({ lead, sides }: { lead: Story; sides: Story[] }) {
  const art = storyArt(lead.slug)
  return (
    <div className="mt-8 grid gap-4 lg:h-[30rem] lg:grid-cols-12">
      <Link
        to={`/story/${lead.slug}`}
        className="group bg-studio text-photo-foreground relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-xl lg:col-span-7 lg:h-full"
      >
        <img
          src={art.src}
          alt={art.alt}
          className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

        <span className="font-news absolute top-5 left-6 text-[3.5rem] leading-none text-white/25 tabular-nums sm:text-[4.5rem]" aria-hidden>
          01
        </span>
        <span className="ez-glass-button absolute top-5 right-5 rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.12em] uppercase">
          Гол сэдэв
        </span>

        <div className="p-6 sm:p-8">
          <p className="text-photo-foreground/75 flex items-center gap-2 text-[12px] tracking-wide uppercase">
            <span className="bg-brand size-1.5 rounded-full" aria-hidden />
            {topicLabel[lead.topic]} · {formatStoryDate(lead.date)}
          </p>
          <h2 className="font-news mt-3 line-clamp-3 max-w-2xl text-3xl leading-[1.1] sm:text-[2.6rem]">{lead.title}</h2>
          <p className="text-photo-foreground/75 mt-3 line-clamp-2 max-w-xl text-[15px] leading-relaxed">{lead.dek}</p>
          <span className="ez-glass-light mt-5 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-[#131518]">
            Унших
            <ArrowRight className="size-4" />
          </span>
        </div>
      </Link>

      <div className="grid gap-4 lg:col-span-5 lg:h-full lg:grid-rows-2">
        {sides.map((story, index) => {
          const side = storyArt(story.slug)
          return (
            <Link
              key={story.slug}
              to={`/story/${story.slug}`}
              className="group bg-studio text-photo-foreground relative isolate flex min-h-[13rem] flex-col justify-end overflow-hidden rounded-xl lg:h-full lg:min-h-0"
            >
              <img
                src={side.src}
                alt={side.alt}
                className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/50 to-black/0" />
              <span className="font-news absolute top-4 left-5 text-[2.25rem] leading-none text-white/25 tabular-nums" aria-hidden>
                {String(index + 2).padStart(2, "0")}
              </span>
              <div className="p-5">
                <p className="text-photo-foreground/70 text-[11px] tracking-wide uppercase">
                  {topicLabel[story.topic]} · {formatStoryDate(story.date)}
                </p>
                <h3 className="font-news mt-1.5 line-clamp-2 text-xl leading-snug">{story.title}</h3>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
