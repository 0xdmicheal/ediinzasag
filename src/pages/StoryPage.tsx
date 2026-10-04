import { Link, useParams } from "react-router-dom"

import { Separator } from "@/components/ui/separator"
import {
  deskLabel,
  formatStoryDate,
  relatedStories,
  storyArt,
  storyBySlug,
  topicLabel,
} from "@/content/stories"

export function StoryPage() {
  const { slug = "" } = useParams()
  const story = storyBySlug(slug)

  if (!story) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="font-news text-4xl">Тойм олдсонгүй</h1>
        <Link to="/" className="mt-4 inline-block underline">
          Нүүр лүү
        </Link>
      </section>
    )
  }

  const related = relatedStories(story)

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
        <Link to={story.desk === "mongolia" ? "/mongolia" : "/world"} className="hover:text-foreground">
          {deskLabel[story.desk]}
        </Link>
        {" · "}
        {topicLabel[story.topic]}
      </p>
      <h1 className="font-news mt-3 text-4xl leading-tight sm:text-5xl">{story.title}</h1>
      <p className="mt-4 text-xl leading-relaxed">{story.dek}</p>
      <p className="text-muted-foreground mt-4 text-sm">
        {formatStoryDate(story.date)} · EZ тойм · {story.readMinutes} мин уншина
      </p>
      <figure className="mt-8">
        <img
          src={storyArt(story.slug).src}
          alt={storyArt(story.slug).alt}
          className="aspect-[16/9] w-full object-cover"
        />
        <figcaption className="text-muted-foreground mt-2 text-xs tracking-wide">Зураглал</figcaption>
      </figure>
      <Separator className="my-8" />
      <div className="space-y-5 text-[1.05rem] leading-8">
        {story.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <aside className="bg-muted/60 mt-10 p-5">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Эх сурвалж</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {story.sources.map((source) => (
            <li key={source.label}>
              {source.href ? (
                <a href={source.href} target="_blank" rel="noreferrer" className="underline">
                  {source.label}
                </a>
              ) : (
                source.label
              )}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          Энэ хуудас нийтийн мэдэгдэл, тоймыг нэгтгэсэн. Ишлэл, гэрээний нарийн тоог зохиогоогүй.
        </p>
      </aside>
      {related.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-news text-2xl">Дараа нь</h2>
          <ul className="mt-4 divide-y border-y">
            {related.map((item) => {
              const art = storyArt(item.slug)
              return (
                <li key={item.slug} className="py-4">
                  <Link to={`/story/${item.slug}`} className="grid grid-cols-[7.5rem_1fr] gap-4">
                    <img src={art.src} alt={art.alt} className="h-[7.5rem] w-[7.5rem] object-cover" />
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs tracking-wide uppercase">
                        {deskLabel[item.desk]} · {formatStoryDate(item.date)}
                      </p>
                      <h3 className="font-news mt-1 line-clamp-2 text-lg leading-snug">{item.title}</h3>
                      <p className="text-muted-foreground mt-1 line-clamp-3 text-sm leading-relaxed">{item.dek}</p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
