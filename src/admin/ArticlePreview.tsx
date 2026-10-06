import { proseClass } from "@/components/site/article"
import type { ArticleDraft, Tag } from "@/admin/types"
import { readMinutes } from "@/admin/rules"
import { bodyToHtml } from "@/lib/article-html"

/** How the article will read on the site, rendered from the current draft. */
export function ArticlePreview({ draft, tags, authorName }: { draft: ArticleDraft; tags: Tag[]; authorName: string }) {
  const labels = new Map(tags.map((tag) => [tag.slug, tag.label]))
  const html = bodyToHtml(draft.body)

  return (
    <article className="bg-background text-foreground">
      <div className="px-5 pt-6 pb-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="bg-muted rounded-md border px-2 py-0.5 text-[11px]">{draft.desk === "mongolia" ? "Монгол" : "Дэлхий"}</span>
          {draft.tags.map((slug) => (
            <span key={slug} className="bg-muted rounded-md border px-2 py-0.5 text-[11px]">
              #{labels.get(slug) ?? slug}
            </span>
          ))}
          <span className="text-muted-foreground text-[11px]">{readMinutes(draft.body)} мин</span>
        </div>
        <h1 className="font-news mt-4 text-[1.75rem] leading-[1.12] text-balance sm:text-[2.25rem]">
          {draft.title || <span className="text-muted-foreground">Гарчиг</span>}
        </h1>
        {draft.dek ? <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed sm:text-lg">{draft.dek}</p> : null}
        <p className="text-muted-foreground mt-3 text-[12px]">{authorName}</p>
      </div>
      {draft.coverUrl ? (
        <figure>
          <img src={draft.coverUrl} alt={draft.coverAlt} className="aspect-[16/9] w-full object-cover" />
          {draft.coverAlt ? <figcaption className="text-muted-foreground px-5 py-2 text-[11px] sm:px-8">{draft.coverAlt}</figcaption> : null}
        </figure>
      ) : null}
      {html ? (
        <div className={`${proseClass} px-5 py-6 sm:px-8`} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-muted-foreground px-5 py-6 text-[14px] sm:px-8">Текст энд харагдана.</p>
      )}
      {draft.sources.length > 0 ? (
        <div className="bg-muted/60 mx-5 mb-6 rounded-lg border p-4 sm:mx-8">
          <p className="text-[13px] font-semibold">Эх сурвалж</p>
          <ul className="mt-2 space-y-1 text-[13px]">
            {draft.sources.map((source, index) => (
              <li key={index} className={source.href ? "text-brand-strong underline" : ""}>
                {source.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}
