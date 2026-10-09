import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ArrowUpRight, Expand } from "lucide-react"

import { Lightbox, useLightbox, zoomableImages } from "@/components/site/Lightbox"
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
      <span className="text-muted-foreground block font-mono text-[11px] uppercase">{ad.label}</span>
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

/**
 * Reading progress: a thin brand line pinned to the bottom edge of the screen
 * that fills as the reader moves through the article. At the bottom it stays put
 * on phones, where browser bars slide in and out at the top while scrolling.
 * 0% at the top of the article, 100% when the end marker (`endId`, the same
 * element that counts the article as read) comes into view; then a small burst
 * of confetti rises from the line, once. The line fades out once the comments
 * are on screen and returns if the reader scrolls back up. Updated straight on
 * the element, once per frame, so scrolling never re-renders the page.
 */
function ReadingProgress({ article, endId }: { article: RefObject<HTMLElement | null>; endId: string }) {
  const bar = useRef<HTMLDivElement>(null)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    let frame = 0
    let celebrated = false
    let last = 0
    function update() {
      frame = 0
      const start = article.current
      const end = document.getElementById(endId) ?? start
      const node = bar.current
      const track = node?.parentElement
      if (!start || !end || !node || !track) return
      const top = start.getBoundingClientRect().top + window.scrollY
      const finish = end.getBoundingClientRect().top + window.scrollY - window.innerHeight
      const span = finish - top
      const ratio = span <= 0 ? 1 : Math.min(1, Math.max(0, (window.scrollY - top) / span))
      node.style.transform = `scaleX(${ratio})`
      track.setAttribute("aria-valuenow", String(Math.round(ratio * 100)))

      // Past the article, into the comments: the line steps aside.
      const comments = document.getElementById("comments")
      const inComments = Boolean(comments && comments.getBoundingClientRect().top < window.innerHeight - 24)
      track.style.opacity = inComments ? "0" : "1"
      track.toggleAttribute("aria-hidden", inComments)

      // Only for reading to the end: not a short article that fits one screen, and not a jump
      // straight to the comments or sources from the contents list (the line has to come from 85%+).
      if (ratio >= 1 && last >= 0.85 && last < 1 && span > 0 && !celebrated) {
        celebrated = true
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setBurst(Date.now())
      }
      last = ratio
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    // Pictures loading and comments arriving change the length, so watch the page size too.
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    update()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [article, endId])

  useEffect(() => {
    if (!burst) return
    const timer = window.setTimeout(() => setBurst(0), 2000)
    return () => window.clearTimeout(timer)
  }, [burst])

  return (
    <>
      <div
        role="progressbar"
        aria-label="Уншсан хэсэг"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        className="pointer-events-none fixed inset-x-0 bottom-[env(safe-area-inset-bottom,0px)] z-40 h-[3px] transition-opacity duration-300"
      >
        <div ref={bar} className="bg-brand h-full origin-left" style={{ transform: "scaleX(0)" }} />
      </div>
      {burst ? <Confetti key={burst} /> : null}
    </>
  )
}

const CONFETTI_COLORS = ["#298dff", "#8fcbff", "#1759c4", "#f97316", "#fbbf24", "#a1a7b2"]

/** About 40 small pieces that rise a little from the bottom edge, tumble and fade. Decorative only. */
function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 40 }, (_, index) => {
      const round = index % 3 === 0
      return {
        x: Math.random() * 100,
        dx: (Math.random() - 0.5) * 60,
        rise: 50 + Math.random() * 90,
        rot: (Math.random() - 0.5) * 720,
        delay: Math.random() * 180,
        duration: 1000 + Math.random() * 500,
        w: round ? 6 : 5 + Math.random() * 3,
        h: round ? 6 : 8 + Math.random() * 5,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        round,
      }
    }),
  )
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-[env(safe-area-inset-bottom,0px)] z-40 h-0 overflow-visible">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="ez-confetti"
          style={
            {
              left: `${piece.x}%`,
              width: piece.w,
              height: piece.h,
              background: piece.color,
              borderRadius: piece.round ? 9999 : 1.5,
              animationDuration: `${piece.duration}ms`,
              animationDelay: `${piece.delay}ms`,
              "--dx": `${piece.dx}px`,
              "--rise": `${piece.rise}px`,
              "--rot": `${piece.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
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
  rail,
  children,
  after,
  progressEnd,
}: {
  back: { to: string; label: string }
  /** Plain labels, or links (e.g. tag pages). */
  tags: (string | { label: string; to: string })[]
  date: string
  title: string
  dek?: string
  image?: { src: string; alt: string; caption?: string; credit?: string; referrer?: boolean }
  author: { name: string; role: string; avatar?: ReactNode }
  toc: TocItem[]
  ad: AdSlot
  /**
   * Article actions (🔥, save): a sticky column left of the text on desktop.
   * Phones and tablets get them at the end of the text instead (EndActions),
   * so readers react where they finish without scrolling back up.
   */
  rail?: (layout: "vertical" | "horizontal") => ReactNode
  children: ReactNode
  after?: ReactNode
  /** Id of the element that marks the end of the reading (shows the progress line at the bottom of the screen). */
  progressEnd?: string
}) {
  const lightbox = useLightbox()
  const articleRef = useRef<HTMLElement>(null)
  const caption = [image?.caption, image?.credit].filter(Boolean).join(" · ")
  return (
    <article ref={articleRef}>
      {progressEnd ? <ReadingProgress article={articleRef} endId={progressEnd} /> : null}
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
              className="ez-hit bg-card hover:bg-muted grid size-8 place-items-center rounded-md border transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            {tags.map((tag) =>
              typeof tag === "string" ? (
                <span key={tag} className="bg-muted text-ds-label rounded-md border px-2.5 py-1">
                  {tag}
                </span>
              ) : (
                <Link
                  key={tag.to}
                  to={tag.to}
                  className="bg-muted text-ds-label hover:border-foreground/30 hover:bg-card rounded-md border px-2.5 py-1 transition-colors"
                >
                  {tag.label}
                </Link>
              ),
            )}
            <span className="text-muted-foreground text-ds-label ml-1">{date}</span>
          </div>
          {/* Sized to stay within two lines on desktop; longer titles step down. */}
          <h1
            className={`font-news mt-6 max-w-[58rem] leading-[1.12] text-balance ${title.length > 45 ? "text-[1.875rem] sm:text-[2.25rem] lg:text-[2.625rem]" : "text-[2rem] sm:text-[2.5rem] lg:text-[3rem]"}`}
          >
            {title}
          </h1>
          {dek ? <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">{dek}</p> : null}
          {/* Below lg the sidebar is hidden, so the byline sits here. */}
          <p className="text-muted-foreground text-ds-label mt-5 lg:hidden">
            <span className="text-foreground font-semibold">{author.name}</span> · {author.role}
          </p>
        </div>
      </header>

      <div className="border-t">
        <div
          className={`mx-auto grid max-w-[1200px] lg:border-x ${rail ? "lg:grid-cols-[5rem_minmax(0,1fr)_20rem]" : "lg:grid-cols-[minmax(0,1fr)_20rem]"}`}
        >
          {rail ? (
            <div className="hidden border-r lg:block">
              <div className="sticky top-20 flex flex-col items-center gap-3 py-8" role="group" aria-label="Нийтлэлийн үйлдэл">
                {rail("vertical")}
              </div>
            </div>
          ) : null}
          <div className="min-w-0">
            {image ? (
              <figure className="px-4 pt-6 sm:px-10 sm:pt-8">
                <button
                  type="button"
                  onClick={() => lightbox.open({ src: image.src, alt: image.alt, caption: caption || undefined, referrer: image.referrer })}
                  aria-label="Зургийг бүтнээр нь харах"
                  className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    referrerPolicy={image.referrer ? "no-referrer" : undefined}
                    className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
                  />
                  <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-medium text-white opacity-90 backdrop-blur-md transition-opacity group-hover:opacity-100 sm:opacity-0 sm:group-focus-visible:opacity-100">
                    <Expand className="size-3.5" />
                    Бүтнээр харах
                  </span>
                </button>
                {caption ? <figcaption className="text-muted-foreground mt-2 text-[12px]">{caption}</figcaption> : null}
              </figure>
            ) : null}

            <div className={`px-4 py-10 sm:px-10 ${zoomableImages}`} onClick={lightbox.onContentClick}>
              {children}
            </div>
            {after ? <div className="border-t px-4 py-10 sm:px-10">{after}</div> : null}
          </div>

          {/* Desktop only: on phones the author, contents and ad slot would pile up under the comments. */}
          <aside className="bg-muted/50 hidden px-8 py-8 lg:block lg:border-l">
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
      <Lightbox image={lightbox.image} onClose={lightbox.close} />
    </article>
  )
}

/** 🔥 and save at the end of the text, below lg (desktop has the sticky rail). */
export function EndActions({ children }: { children: ReactNode }) {
  return (
    <div role="group" aria-label="Нийтлэлийн үйлдэл" className="mt-12 flex flex-wrap items-center gap-2 border-t pt-6 lg:hidden">
      {children}
    </div>
  )
}

/** "EZ-ийн дүгнэлт": the newsroom's own analysis, set apart from the reported text. */
export function TakeBox({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  if (paragraphs.length === 0) return null
  return (
    <aside aria-label="EZ-ийн дүгнэлт" className="bg-brand-soft/60 border-brand/30 mt-12 rounded-xl border p-5 sm:p-6">
      <p className="text-brand-strong font-mono text-[11px] font-semibold uppercase">EZ-ийн дүгнэлт</p>
      <div className="mt-3 space-y-3 text-[1.0625rem] leading-[1.7]">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </aside>
  )
}

/** Typography for article bodies (plain paragraphs and rendered letter HTML). */
export const proseClass =
  "text-[1.0625rem] leading-[1.75] text-foreground/90 [&_a]:text-brand-strong [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/20 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h2:first-child]:mt-0 [&_h2]:font-news [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:text-foreground [&_h3]:font-news [&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:scroll-mt-24 [&_h3]:text-xl [&_h3]:text-foreground [&_img]:my-8 [&_img]:w-full [&_img]:rounded-lg [&_figure]:my-8 [&_figure_img]:my-0 [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-[13px] [&_figcaption]:text-muted-foreground [&_li]:ml-5 [&_li]:mt-2 [&_ol]:my-5 [&_ol]:list-decimal [&_p]:mt-5 [&_p]:scroll-mt-24 [&_p:first-child]:mt-0 [&_strong]:text-foreground [&_ul]:my-5 [&_ul]:list-disc"
