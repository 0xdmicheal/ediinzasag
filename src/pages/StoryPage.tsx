import { Link, useParams } from "react-router-dom"

import { ArticleLayout, EndActions, excerpt, proseClass, TakeBox, type TocItem } from "@/components/site/article"
import { articleAd } from "@/content/ads"
import { sortByDate, useStories, useTagLabels } from "@/content/live"
import { storyOutlines } from "@/content/story-outlines"
import { prepareArticle } from "@/lib/article-html"
import { deskLabel, formatStoryDate, storyArt, tagsOf } from "@/content/stories"
import { Comments } from "@/reader/Comments"
import { ArticleActions, useFire } from "@/reader/ArticleActions"
import { useMarkReadAtEnd } from "@/reader/useMarkRead"

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
  const { stories, ready } = useStories()
  const labels = useTagLabels()
  const story = stories.find((item) => item.slug === slug)
  useMarkReadAtEnd(story?.slug, "sources", story ? { desk: story.desk, topic: story.topic } : undefined)
  const fire = useFire(slug)

  if (!story && !ready) {
    return <p className="text-muted-foreground mx-auto max-w-3xl px-4 py-20 text-sm sm:px-6">Ачаалж байна…</p>
  }

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
  const storyTags = tagsOf(story)
  const related = sortByDate(
    stories.filter((item) => item.slug !== story.slug && tagsOf(item).some((tag) => storyTags.includes(tag))),
  ).slice(0, 3)
  const rich = story.html ? prepareArticle(story.html) : null
  const blocks = rich ? [] : storyBlocks(story.paragraphs, storyOutlines[story.slug])
  const headings = blocks.filter((block) => block.kind === "heading")
  const toc: TocItem[] = [
    ...(rich
      ? rich.toc
      : headings.length > 0
        ? headings.map((block) => ({ id: block.id, label: block.text }))
        : blocks.map((block) => ({ id: block.id, label: excerpt(block.text) }))),
    ...(story.take?.trim() ? [{ id: "take", label: "EZ-ийн дүгнэлт" }] : []),
    { id: "sources", label: "Эх сурвалж" },
    { id: "comments", label: "Сэтгэгдэл" },
    ...(related.length > 0 ? [{ id: "related", label: "Дараа нь" }] : []),
  ]

  return (
    <ArticleLayout
      back={{ to: story.desk === "mongolia" ? "/mongolia" : "/world", label: `${deskLabel[story.desk]} руу буцах` }}
      tags={[
        ...storyTags.map((tag) => ({ label: `#${labels.get(tag) ?? tag}`, to: `/tag/${tag}` })),
        `${story.readMinutes} мин`,
      ]}
      date={formatStoryDate(story.date)}
      title={story.title}
      dek={story.dek}
      image={{ src: art.src, alt: art.alt, caption: story.author ? art.alt : `${art.alt} · Зураглал`, credit: story.coverCredit }}
      author={{ name: story.author || "EZ тойм", role: "Эдийн засаг редакц" }}
      toc={toc}
      ad={articleAd}
      progressEnd="sources"
      rail={(layout) => <ArticleActions slug={story.slug} fire={fire} layout={layout} />}
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
      {rich ? <div className={proseClass} dangerouslySetInnerHTML={{ __html: rich.html }} /> : null}
      <div className={proseClass} hidden={Boolean(rich)}>
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

      {story.take?.trim() ? (
        <div id="take" className="scroll-mt-24">
          <TakeBox text={story.take} />
        </div>
      ) : null}

      <EndActions>
        <ArticleActions slug={story.slug} fire={fire} layout="horizontal" />
      </EndActions>

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

      <Comments slug={story.slug} />
    </ArticleLayout>
  )
}
