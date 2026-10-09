import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { Bookmark, Flame } from "lucide-react"

import type { ArticleDraft, Tag } from "@/admin/types"
import { ArticleLayout, EndActions, proseClass, TakeBox, type TocItem } from "@/components/site/article"
import { articleAd } from "@/content/ads"
import { deskLabel, formatStoryDate } from "@/content/stories"
import { countWords, prepareArticle } from "@/lib/article-html"

/*
 * The editor's "Урьдчилан харах": the draft drawn with the public article
 * layout (ArticleLayout, same as StoryPage), inside an iframe the admin sizes to
 * a real phone or desktop width so the site's breakpoints apply. The admin
 * posts the draft here; only messages from our own page are accepted. Links
 * don't navigate, and reactions are inert copies.
 */

export interface PreviewPayload {
  draft: ArticleDraft
  tags: Tag[]
  authorName: string
  date: string
  dark: boolean
}

export const PREVIEW_READY = "ez-preview-ready"
export const PREVIEW_DRAFT = "ez-preview-draft"
export const PREVIEW_HEIGHT = "ez-preview-height"

export default function PreviewFrame() {
  const [payload, setPayload] = useState<PreviewPayload | null>(null)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      if (event.data?.type === PREVIEW_DRAFT) setPayload(event.data.payload as PreviewPayload)
    }
    window.addEventListener("message", onMessage)
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  useLayoutEffect(() => {
    if (payload) document.documentElement.classList.toggle("dark", payload.dark)
  }, [payload])

  // Tell the admin how tall the article is (not the frame), so it can size the frame to fit, growing or shrinking.
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = content.current
    if (!node) return
    const report = () => window.parent.postMessage({ type: PREVIEW_HEIGHT, height: Math.ceil(node.getBoundingClientRect().height) }, window.location.origin)
    const observer = new ResizeObserver(report)
    observer.observe(node)
    report()
    return () => observer.disconnect()
  }, [payload])

  return <div ref={content}>{payload ? <DraftArticle {...payload} /> : null}</div>
}

function DraftArticle({ draft, tags, authorName, date }: PreviewPayload) {
  const labels = new Map(tags.map((tag) => [tag.slug, tag.label]))
  const prepared = prepareArticle(draft.body || "")
  const minutes = Math.max(1, Math.round(countWords(draft.body || "") / 200))
  const toc: TocItem[] = [
    ...prepared.toc,
    ...(draft.take.trim() ? [{ id: "take", label: "EZ-ийн дүгнэлт" }] : []),
    { id: "sources", label: "Эх сурвалж" },
    { id: "comments", label: "Сэтгэгдэл" },
  ]

  // A preview never leaves the page: links and tag chips stay put (the cover still opens the lightbox).
  function stayHere(event: MouseEvent) {
    if ((event.target as Element).closest("a")) event.preventDefault()
  }

  return (
    <div className="bg-background text-foreground" onClickCapture={stayHere}>
      <ArticleLayout
        back={{ to: "/", label: `${deskLabel[draft.desk]} руу буцах` }}
        tags={[...draft.tags.map((slug) => ({ label: `#${labels.get(slug) ?? slug}`, to: `/tag/${slug}` })), `${minutes} мин`]}
        date={formatStoryDate(date)}
        title={draft.title || "Гарчиг"}
        dek={draft.dek}
        image={draft.coverUrl ? { src: draft.coverUrl, alt: draft.coverAlt, caption: draft.coverAlt, credit: draft.coverCredit } : undefined}
        author={{ name: authorName || "EZ тойм", role: "Эдийн засаг редакц" }}
        toc={toc}
        ad={articleAd}
        rail={(layout) => <PreviewActions layout={layout} />}
      >
        {prepared.html ? (
          <div className={proseClass} dangerouslySetInnerHTML={{ __html: prepared.html }} />
        ) : (
          <p className="text-muted-foreground">Текст энд харагдана.</p>
        )}

        {draft.take.trim() ? (
          <div id="take" className="scroll-mt-24">
            <TakeBox text={draft.take} />
          </div>
        ) : null}

        <EndActions>
          <PreviewActions layout="horizontal" />
        </EndActions>

        <section id="sources" className="bg-muted/60 mt-12 scroll-mt-24 rounded-lg border p-5">
          <h2 className="text-ds-label font-semibold">Эх сурвалж</h2>
          {draft.sources.length > 0 ? (
            <ul className="mt-3 space-y-2 text-[14px]">
              {draft.sources.map((source, index) => (
                <li key={index}>
                  {source.href ? (
                    <a href={source.href} className="text-brand-strong underline underline-offset-2">
                      {source.label}
                    </a>
                  ) : (
                    source.label
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-3 text-[14px]">Эх сурвалж нэмээгүй байна.</p>
          )}
          <p className="text-muted-foreground mt-3 text-[12px]">
            Энэ хуудас нийтийн мэдэгдэл, тоймыг нэгтгэсэн. Ишлэл, гэрээний нарийн тоог зохиогоогүй.
          </p>
        </section>

        <section id="comments" className="mt-12 scroll-mt-24">
          <h2 className="font-news text-2xl">Сэтгэгдэл</h2>
          <p className="text-muted-foreground mt-3 rounded-lg border border-dashed p-5 text-center text-[14px]">
            Нийтлэгдсэний дараа уншигчдын сэтгэгдэл энд гарна.
          </p>
        </section>
      </ArticleLayout>
    </div>
  )
}

/** Looks like ArticleActions (🔥 and save) but does nothing. */
function PreviewActions({ layout }: { layout: "vertical" | "horizontal" }) {
  const items = [
    { icon: Flame, label: "0" },
    { icon: Bookmark, label: "Хадгалах" },
  ]
  return (
    <>
      {items.map(({ icon: Icon, label }) =>
        layout === "vertical" ? (
          <span key={label} className="text-muted-foreground flex w-14 flex-col items-center gap-1 py-1 text-[11px] font-medium">
            <span className="bg-card grid size-11 place-items-center rounded-full border">
              <Icon className="size-5" />
            </span>
            {label}
          </span>
        ) : (
          <span
            key={label}
            className="border-foreground/20 inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium"
          >
            <Icon className="size-4" />
            {label}
          </span>
        ),
      )}
    </>
  )
}
