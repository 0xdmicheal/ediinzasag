import { Link, useParams } from "react-router-dom"

import { sortByDate, useStories, useTagLabels } from "@/content/live"
import { deskLabel, formatStoryDate, storyArt, tagsOf } from "@/content/stories"

/** Every story with one tag, plus the tags that most often appear beside it. */
export function TagPage() {
  const { slug = "" } = useParams()
  const { stories, ready } = useStories()
  const labels = useTagLabels()
  const label = labels.get(slug) ?? slug
  const tagged = sortByDate(stories.filter((story) => tagsOf(story).includes(slug)))

  const nearby = new Map<string, number>()
  tagged.forEach((story) => tagsOf(story).forEach((tag) => tag !== slug && nearby.set(tag, (nearby.get(tag) ?? 0) + 1)))
  const related = [...nearby.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const [lead, ...rest] = tagged

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b pb-6">
        <p className="text-muted-foreground font-mono text-[12px] uppercase">Шошго</p>
        <h1 className="font-news mt-2 text-4xl sm:text-5xl">#{label}</h1>
        <p className="text-muted-foreground mt-2 text-[15px]">
          {tagged.length > 0 ? `${tagged.length} тойм` : ready ? "Энэ шошготой тойм одоогоор алга." : "Ачаалж байна…"}
        </p>
        {related.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-[12px]">Хамт гардаг:</span>
            {related.map(([tag, count]) => (
              <Link key={tag} to={`/tag/${tag}`} className="bg-card hover:border-foreground/30 rounded-full border px-3 py-1 text-[13px] transition-colors">
                #{labels.get(tag) ?? tag} <span className="text-muted-foreground font-mono text-[11px]">{count}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      {lead ? (
        <Link to={`/story/${lead.slug}`} className="group mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
          <span className="block overflow-hidden rounded-lg border">
            <img
              src={storyArt(lead.slug).src}
              alt={storyArt(lead.slug).alt}
              className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </span>
          <span>
            <span className="text-muted-foreground block font-mono text-[12px]">
              {deskLabel[lead.desk]} · {formatStoryDate(lead.date)} · {lead.readMinutes} мин
            </span>
            <span className="font-news mt-2 block text-3xl leading-tight group-hover:underline">{lead.title}</span>
            <span className="text-muted-foreground mt-3 line-clamp-3 block leading-relaxed">{lead.dek}</span>
          </span>
        </Link>
      ) : null}

      {rest.length > 0 ? (
        <ul className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((story) => (
            <li key={story.slug}>
              <Link to={`/story/${story.slug}`} className="group block">
                <span className="block overflow-hidden rounded-lg border">
                  <img
                    src={storyArt(story.slug).src}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </span>
                <span className="text-muted-foreground mt-3 block font-mono text-[12px]">
                  {deskLabel[story.desk]} · {formatStoryDate(story.date)}
                </span>
                <span className="font-news mt-1 line-clamp-2 block text-lg leading-snug group-hover:underline">{story.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
