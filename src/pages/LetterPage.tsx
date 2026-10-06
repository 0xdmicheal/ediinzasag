import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"

import { ArticleLayout, excerpt, proseClass, type TocItem } from "@/components/site/article"
import { SubstackShelf } from "@/components/site/SubstackShelf"
import { articleAd } from "@/content/ads"
import { formatStoryDate } from "@/content/stories"
import { substackPosts } from "@/content/substack.posts"
import { Comments } from "@/reader/Comments"
import { letterKey } from "@/reader/library-items"
import { ArticleActions, useFire } from "@/reader/ArticleActions"
import { useMarkReadAtEnd } from "@/reader/useMarkRead"

/**
 * Gives the letter's headings ids for "on this page". Letters with fewer than
 * two headings list their paragraphs' opening words instead. The HTML was
 * sanitised to an allowlist when it was pulled from the feed.
 */
function prepareLetter(html: string): { html: string; toc: TocItem[] } {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild as HTMLElement
  const headings = Array.from(root.querySelectorAll("h2, h3")).filter((node) => node.textContent?.trim())
  let toc: TocItem[]
  if (headings.length >= 2) {
    toc = headings.map((node, index) => {
      node.id = `section-${index}`
      return { id: node.id, label: node.textContent!.trim() }
    })
  } else {
    const paragraphs = Array.from(root.querySelectorAll("p")).filter((node) => (node.textContent ?? "").trim().length > 40)
    toc = paragraphs.slice(0, 8).map((node, index) => {
      node.id = `p-${index}`
      return { id: node.id, label: excerpt(node.textContent ?? "") }
    })
  }
  return { html: root.innerHTML, toc }
}

export function LetterPage() {
  const { slug = "" } = useParams()
  const post = substackPosts.find((item) => item.slug === slug)
  const prepared = useMemo(() => (post?.html ? prepareLetter(post.html) : { html: "", toc: [] }), [post])
  useMarkReadAtEnd(post ? letterKey(post.slug) : undefined, "letter-end")
  const fire = useFire(letterKey(slug))

  if (!post) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="font-news text-4xl">Захидал олдсонгүй</h1>
        <Link to="/newsletter" className="mt-4 inline-block underline">
          Нийтлэл лүү
        </Link>
      </section>
    )
  }

  const more = substackPosts.filter((item) => item.slug !== post.slug).slice(0, 3)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(post.date) ? formatStoryDate(post.date) : post.date
  const toc: TocItem[] = [
    ...prepared.toc,
    { id: "comments", label: "Сэтгэгдэл" },
    ...(more.length > 0 ? [{ id: "more", label: "Бусад захидал" }] : []),
  ]

  return (
    <ArticleLayout
      back={{ to: "/newsletter", label: "Нийтлэл рүү буцах" }}
      tags={["Нийтлэл", "Substack"]}
      date={date}
      title={post.title}
      dek={post.excerpt}
      image={post.image ? { src: post.image, alt: "", referrer: true } : undefined}
      author={{
        name: post.author || "EZ Эдийн засаг",
        role: "Захидлын зохиогч",
        avatar: (
          <span className="bg-brand text-brand-foreground grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold">
            {(post.author || "E").slice(0, 1).toUpperCase()}
          </span>
        ),
      }}
      toc={toc}
      ad={articleAd}
      rail={(layout) => <ArticleActions slug={letterKey(post.slug)} fire={fire} layout={layout} />}
      after={
        more.length > 0 ? (
          <section id="more" className="scroll-mt-24">
            <h2 className="font-news text-2xl">Бусад захидал</h2>
            <div className="mt-6">
              <SubstackShelf posts={more} layout="list" />
            </div>
          </section>
        ) : null
      }
    >
      {prepared.html ? (
        <div className={proseClass} dangerouslySetInnerHTML={{ __html: prepared.html }} />
      ) : (
        <p className="text-muted-foreground">
          Энэ захидлын бүтэн эх{" "}
          <a href={post.link} target="_blank" rel="noreferrer" className="text-brand-strong underline">
            Substack дээр
          </a>{" "}
          байна.
        </p>
      )}
      <p id="letter-end" className="text-muted-foreground mt-12 text-[13px]">
        Эх хувь:{" "}
        <a href={post.link} target="_blank" rel="noreferrer" className="text-brand-strong underline underline-offset-2">
          niots.substack.com
        </a>
      </p>

      <Comments slug={letterKey(post.slug)} />
    </ArticleLayout>
  )
}
