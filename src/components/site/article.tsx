import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ArrowUpRight } from "lucide-react"

import type { AdSlot } from "@/content/ads"
import { publicUrl } from "@/lib/public-url"

/*
 * Shared article layout for stories and letters: a header over a faint dot
 * grid, then a framed two-column body with the article on the left and a
 * sidebar (author, "on this page", ad slot) on the right.
 */

export interface TocItem {
  id: string
  label: string
}

/** First words of a paragraph, for a table of contents when there are no headings. */
export function excerpt(text: string, words = 7) {
  const parts = text.replace(/\s+/g, " ").trim().split(" ")
  return parts.length > words ? `${parts.slice(0, words).join(" ")}…` : parts.join(" ")
}

/** Tracks which section is currently being read. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "")
  const key = ids.join("|")
  useEffect(() => {
    const nodes = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: "-88px 0px -65% 0px" },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [key])
  return active
}

function TableOfContents({ items }: { items: TocItem[] }) {
  const active = useActiveSection(items.map((item) => item.id))
  return (
    <nav aria-label="Энэ хуудсанд" className="bg-card rounded-lg border p-5">
      <p className="text-ds-label font-semibold">Энэ хуудсанд</p>
      <ol className="mt-3 flex flex-col gap-2.5">
        {items.map((item) => {
          const current = item.id === active
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                className={`text-ds-label block leading-snug transition-colors ${current ? "text-foreground underline underline-offset-4" : "text-muted-foreground hover:text-foreground"}`}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function AdCard({ ad }: { ad: AdSlot }) {
  const body = (
    <>
      <span className="text-muted-foreground block font-mono text-[10px] uppercase">{ad.label}</span>
      {ad.image ? (
        <img src={ad.image} alt="" className="mt-2 aspect-[16/10] w-full rounded-md object-cover" />
      ) : (
        <span className="bg-studio mt-2 grid aspect-[16/10] place-items-center rounded-md">
          <img src={publicUrl("brand/logo-white.png")} alt="" className="h-8 w-auto" />
        </span>
      )}
      <span className="font-news mt-4 block text-lg">{ad.title}</span>
      <span className="text-muted-foreground text-ds-label mt-1 block leading-relaxed">{ad.body}</span>
      <span className="text-brand-strong text-ds-label mt-3 inline-flex items-center gap-1 font-medium">
        {ad.cta}
        <ArrowUpRight className="size-3.5" />
      </span>
    </>
  )
  const className = "bg-card hover:border-foreground/20 block rounded-lg border p-4 transition-colors"
  return ad.external ? (
    <a href={ad.href} target="_blank" rel="noreferrer sponsored" className={className}>
      {body}
    </a>
  ) : (
    <Link to={ad.href} className={className}>
      {body}
    </Link>
  )
}

export function ArticleLayout({
  back,
  tags,
  date,
  title,
  dek,
  image,
  author,
  toc,
  ad,
  children,
  after,
}: {
  back: { to: string; label: string }
  tags: string[]
  date: string
  title: string
  dek?: string
  image?: { src: string; alt: string; caption?: string; referrer?: boolean }
  author: { name: string; role: string; avatar?: ReactNode }
  toc: TocItem[]
  ad: AdSlot
  children: ReactNode
  after?: ReactNode
}) {
  return (
    <article>
      <header className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(var(--color-gray-300)_1px,transparent_1px)] [background-size:14px_14px] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)] dark:bg-[radial-gradient(var(--color-gray-700)_1px,transparent_1px)]"
        />
        <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={back.to}
              aria-label={back.label}
              className="bg-card hover:bg-muted grid size-8 place-items-center rounded-md border transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            {tags.map((tag) => (
              <span key={tag} className="bg-muted text-ds-label rounded-md border px-2.5 py-1">
                {tag}
              </span>
            ))}
            <span className="text-muted-foreground text-ds-label ml-1">{date}</span>
          </div>
          {/* Sized to stay within two lines on desktop; longer titles step down. */}
          <h1
            className={`font-news mt-6 max-w-[58rem] leading-[1.12] text-balance ${title.length > 45 ? "text-[1.875rem] sm:text-[2.25rem] lg:text-[2.625rem]" : "text-[2rem] sm:text-[2.5rem] lg:text-[3rem]"}`}
          >
            {title}
          </h1>
          {dek ? <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">{dek}</p> : null}
        </div>
      </header>

      <div className="border-t">
        <div className="mx-auto grid max-w-[1200px] lg:grid-cols-[minmax(0,1fr)_20rem] lg:border-x">
          <div className="min-w-0">
            {image ? (
              <figure>
                <img
                  src={image.src}
                  alt={image.alt}
                  referrerPolicy={image.referrer ? "no-referrer" : undefined}
                  className="aspect-[16/9] w-full object-cover"
                />
                {image.caption ? (
                  <figcaption className="text-muted-foreground border-b px-5 py-2 text-[12px] sm:px-10">{image.caption}</figcaption>
                ) : null}
              </figure>
            ) : null}

            <div className="px-4 py-10 sm:px-10">{children}</div>
            {after ? <div className="border-t px-4 py-10 sm:px-10">{after}</div> : null}
          </div>

          <aside className="bg-muted/50 border-t px-4 py-8 sm:px-6 lg:border-t-0 lg:border-l lg:px-8">
            <div className="flex flex-col gap-6 lg:sticky lg:top-20">
              <div className="flex items-center gap-3">
                {author.avatar ?? (
                  <span className="bg-studio text-photo-foreground font-news grid size-9 shrink-0 place-items-center rounded-full text-[13px]">
                    EZ
                  </span>
                )}
                <span>
                  <span className="text-ds-label block font-semibold">{author.name}</span>
                  <span className="text-muted-foreground text-ds-caption block">{author.role}</span>
                </span>
              </div>
              <div className="hidden lg:block">
                <TableOfContents items={toc} />
              </div>
              <AdCard ad={ad} />
            </div>
          </aside>
        </div>
      </div>
    </article>
  )
}

/** Typography for article bodies (plain paragraphs and rendered letter HTML). */
export const proseClass =
  "text-[1.0625rem] leading-[1.75] text-foreground/90 [&_a]:text-brand-strong [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/20 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h2:first-child]:mt-0 [&_h2]:font-news [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:text-foreground [&_h3]:font-news [&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:scroll-mt-24 [&_h3]:text-xl [&_h3]:text-foreground [&_img]:my-8 [&_img]:w-full [&_img]:rounded-lg [&_li]:ml-5 [&_li]:mt-2 [&_ol]:my-5 [&_ol]:list-decimal [&_p]:mt-5 [&_p]:scroll-mt-24 [&_p:first-child]:mt-0 [&_strong]:text-foreground [&_ul]:my-5 [&_ul]:list-disc"
