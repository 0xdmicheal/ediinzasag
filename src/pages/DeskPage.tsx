import { Link } from "react-router-dom"

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

      <div className="mt-8 divide-y border-y">
        {list.map((story) => (
            <article key={story.slug} className="grid gap-4 py-6 md:grid-cols-[11rem_8rem_1fr] md:items-center">
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

function DeskHero({ lead, sides }: { lead: Story; sides: Story[] }) {
  const art = storyArt(lead.slug)
  return (
    <div className="mt-8 grid gap-4 lg:h-[28rem] lg:grid-cols-12">
      <Link
        to={`/story/${lead.slug}`}
        className="flex flex-col overflow-hidden rounded-lg border bg-card lg:col-span-7 lg:h-full"
      >
        <img src={art.src} alt={art.alt} className="h-52 w-full object-cover lg:min-h-0 lg:flex-1" />
        <div className="shrink-0 p-5">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {topicLabel[lead.topic]} · {formatStoryDate(lead.date)}
          </p>
          <h2 className="font-news mt-2 line-clamp-3 text-3xl leading-tight">{lead.title}</h2>
          <p className="text-muted-foreground mt-3 line-clamp-3">{lead.dek}</p>
        </div>
      </Link>
      <div className="grid gap-4 lg:col-span-5 lg:h-full lg:grid-rows-2">
        {sides.map((story) => {
          const side = storyArt(story.slug)
          return (
            <Link
              key={story.slug}
              to={`/story/${story.slug}`}
              className="grid h-36 grid-cols-[9rem_1fr] overflow-hidden rounded-lg border bg-card lg:h-full"
            >
              <img src={side.src} alt={side.alt} className="h-full w-full object-cover" />
              <div className="min-w-0 p-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {topicLabel[story.topic]} · {formatStoryDate(story.date)}
                </p>
                <h3 className="font-news mt-1 line-clamp-2 text-xl leading-snug">{story.title}</h3>
                <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{story.dek}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
