import { Link, useParams } from "react-router-dom"

import { ArticleLayout, excerpt, proseClass, type TocItem } from "@/components/site/article"
import { articleAd } from "@/content/ads"
import { storyOutlines } from "@/content/story-outlines"
import {
  deskLabel,
  formatStoryDate,
  relatedStories,
  storyArt,
  storyBySlug,
  topicLabel,
} from "@/content/stories"

type Block = { kind: "heading" | "paragraph"; id: string; text: string }

/**
 * Builds the article body. Headings come from the story's outline (one label
 * per paragraph, see story-outlines.ts) or from paragraphs written as "## ...".
 * A story with neither lists its paragraph openings in the contents box.
 */
function storyBlocks(paragraphs: string[], outline?: string[]): Block[] {
  if (outline && outline.length === paragraphs.length) {
    return paragraphs.flatMap((text, index) => [
      { kind: "heading" as const, id: `section-${index}`, text: outline[index] },
      { kind: "paragraph" as const, id: `p-${index}`, text },
    ])
  }
  return paragraphs.map((text, index) =>
    text.startsWith("## ")
      ? { kind: "heading" as const, id: `section-${index}`, text: text.slice(3).trim() }
      : { kind: "paragraph" as const, id: `p-${index}`, text },
  )
}

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

  const art = storyArt(story.slug)
  const related = relatedStories(story)
  const blocks = storyBlocks(story.paragraphs, storyOutlines[story.slug])
  const headings = blocks.filter((block) => block.kind === "heading")
  const toc: TocItem[] = [
    ...(headings.length > 0
      ? headings.map((block) => ({ id: block.id, label: block.text }))
      : blocks.map((block) => ({ id: block.id, label: excerpt(block.text) }))),
    { id: "sources", label: "Эх сурвалж" },
    ...(related.length > 0 ? [{ id: "related", label: "Дараа нь" }] : []),
  ]

  return (
    <ArticleLayout
      back={{ to: story.desk === "mongolia" ? "/mongolia" : "/world", label: `${deskLabel[story.desk]} руу буцах` }}
      tags={[deskLabel[story.desk], topicLabel[story.topic], `${story.readMinutes} мин`]}
      date={formatStoryDate(story.date)}
      title={story.title}
      dek={story.dek}
      image={{ src: art.src, alt: art.alt, caption: `${art.alt} · Зураглал` }}
      author={{ name: "EZ тойм", role: "Эдийн засаг редакц" }}
      toc={toc}
      ad={articleAd}
      after={
        related.length > 0 ? (
          <section id="related" className="scroll-mt-24">
            <h2 className="font-news text-2xl">Дараа нь</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {related.map((item) => {
                const itemArt = storyArt(item.slug)
                return (
                  <li key={item.slug}>
                    <Link to={`/story/${item.slug}`} className="group block">
                      <span className="block overflow-hidden rounded-lg border">
                        <img
                          src={itemArt.src}
                          alt={itemArt.alt}
                          className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </span>
                      <span className="text-muted-foreground mt-3 block text-[12px]">
                        {deskLabel[item.desk]} · {formatStoryDate(item.date)}
                      </span>
                      <span className="font-news mt-1 line-clamp-2 block text-[17px] leading-snug group-hover:underline">
                        {item.title}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null
      }
    >
      <div className={proseClass}>
        {blocks.map((block) =>
          block.kind === "heading" ? (
            <h2 key={block.id} id={block.id}>
              {block.text}
            </h2>
          ) : (
            <p key={block.id} id={block.id}>
              {block.text}
            </p>
          ),
        )}
      </div>

      <section id="sources" className="bg-muted/60 mt-12 scroll-mt-24 rounded-lg border p-5">
        <h2 className="text-ds-label font-semibold">Эх сурвалж</h2>
        <ul className="mt-3 space-y-2 text-[14px]">
          {story.sources.map((source) => (
            <li key={source.label}>
              {source.href ? (
                <a href={source.href} target="_blank" rel="noreferrer" className="text-brand-strong underline underline-offset-2">
                  {source.label}
                </a>
              ) : (
                source.label
              )}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-[12px]">
          Энэ хуудас нийтийн мэдэгдэл, тоймыг нэгтгэсэн. Ишлэл, гэрээний нарийн тоог зохиогоогүй.
        </p>
      </section>
    </ArticleLayout>
  )
}
