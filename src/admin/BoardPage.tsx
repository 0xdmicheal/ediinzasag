import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FilePlus2, Search } from "lucide-react"
import { cn } from "cn"

import { isEditor, readiness, statusMeta, statusOrder, timeAgo } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { Avatar, buttonClass, inputClass, Notice } from "@/admin/ui"
import type { Article, Status, Tag } from "@/admin/types"

/** A tiny ring showing how many required readiness checks pass. */
function ReadinessRing({ article }: { article: Article }) {
  const checks = readiness(article).filter((check) => check.required)
  const done = checks.filter((check) => check.ok).length
  const ratio = done / checks.length
  const r = 9
  const c = 2 * Math.PI * r
  return (
    <span className="flex items-center gap-1.5" title={`Бэлэн байдал ${done}/${checks.length}`}>
      <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke={ratio === 1 ? "var(--up)" : "var(--brand)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${c * ratio} ${c}`}
        />
      </svg>
      <span className="text-muted-foreground font-mono text-[11px]">
        {done}/{checks.length}
      </span>
    </span>
  )
}

function ArticleCard({ article, tags }: { article: Article; tags: Map<string, string> }) {
  return (
    <Link
      to={`/admin/edit/${article.id}`}
      className="bg-card hover:border-foreground/25 group flex flex-col gap-2.5 rounded-lg border p-3.5 transition-colors"
    >
      <p className="font-news line-clamp-2 text-[15px] leading-snug group-hover:underline">
        {article.title || <span className="text-muted-foreground">Гарчиггүй ноорог</span>}
      </p>
      {article.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {article.tags.slice(0, 3).map((slug) => (
            <span key={slug} className="bg-foreground/[0.06] rounded-md px-1.5 py-0.5 text-[11px]">
              #{tags.get(slug) ?? slug}
            </span>
          ))}
          {article.tags.length > 3 ? <span className="text-muted-foreground text-[11px]">+{article.tags.length - 3}</span> : null}
        </div>
      ) : null}
      {article.status === "changes_requested" && article.reviewNote ? (
        <p className="line-clamp-2 rounded-md bg-[color-mix(in_oklch,var(--down)_10%,transparent)] px-2 py-1.5 text-[12px]">
          “{article.reviewNote}”
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar name={article.authorName} size="sm" />
          <span className="text-muted-foreground truncate text-[12px]">{timeAgo(article.updatedAt)}</span>
        </span>
        <ReadinessRing article={article} />
      </div>
    </Link>
  )
}

export function BoardPage() {
  const { backend, member } = useTeam()
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [tagFilter, setTagFilter] = useState("")
  const [mine, setMine] = useState(false)

  useEffect(() => {
    Promise.all([backend.listArticles(), backend.listTags()])
      .then(([list, tagList]) => {
        setArticles(list)
        setTags(tagList)
      })
      .catch((failure: Error) => setError(failure.message))
  }, [backend])

  const tagLabels = useMemo(() => new Map(tags.map((tag) => [tag.slug, tag.label])), [tags])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (articles ?? []).filter(
      (article) =>
        (!q || article.title.toLowerCase().includes(q) || article.authorName.toLowerCase().includes(q)) &&
        (!tagFilter || article.tags.includes(tagFilter)) &&
        (!mine || article.authorId === member.id),
    )
  }, [articles, query, tagFilter, mine, member.id])

  const byStatus = (status: Status) =>
    filtered.filter((article) => article.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  // "Your turn": what needs this person's action right now.
  const yourTurn = (articles ?? []).filter((article) =>
    isEditor(member)
      ? article.status === "in_review" || article.status === "approved"
      : article.authorId === member.id && article.status === "changes_requested",
  )

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Редакцын самбар</p>
          <h1 className="font-news mt-1 text-3xl">Сайн байна уу, {member.name.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1 text-[14px]">
            {articles === null
              ? "Ачаалж байна…"
              : yourTurn.length > 0
                ? isEditor(member)
                  ? `${yourTurn.length} нийтлэл таны шийдвэрийг хүлээж байна.`
                  : `${yourTurn.length} нийтлэлд засвар хүссэн байна.`
                : "Таны ээлжинд хүлээгдэж буй зүйл алга."}
          </p>
        </div>
        <Link to="/admin/new" className={buttonClass.primary}>
          <FilePlus2 className="size-4" />
          Шинэ нийтлэл
        </Link>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Хайх</span>
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            id="board-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Гарчиг, зохиогч…"
            className={cn(inputClass, "pl-9")}
          />
        </label>
        <label className="sr-only" htmlFor="board-tag">
          Шошгоор шүүх
        </label>
        <select id="board-tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className={cn(inputClass, "w-auto")}>
          <option value="">Бүх шошго</option>
          {tags.map((tag) => (
            <option key={tag.slug} value={tag.slug}>
              #{tag.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={mine}
          onClick={() => setMine((value) => !value)}
          className={cn(buttonClass.ghost, mine && "bg-foreground text-background hover:bg-foreground/90")}
        >
          Миний нийтлэл
        </button>
      </div>

      {/* Columns scroll sideways on narrow screens. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="grid min-w-[68rem] grid-cols-5 gap-3">
          {statusOrder.map((status) => {
            const column = byStatus(status)
            return (
              <section key={status} aria-label={statusMeta[status].label} className="bg-muted/50 flex flex-col gap-2 rounded-xl p-2.5">
                <header className="flex items-center justify-between px-1 pt-1">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className={cn("size-2 rounded-full", statusMeta[status].tone)} aria-hidden />
                    {statusMeta[status].label}
                  </span>
                  <span className="text-muted-foreground font-mono text-[12px]">{column.length}</span>
                </header>
                <p className="text-muted-foreground px-1 text-[11px]">{statusMeta[status].hint}</p>
                {column.map((article) => (
                  <ArticleCard key={article.id} article={article} tags={tagLabels} />
                ))}
                {articles !== null && column.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-[12px]">Хоосон</p>
                ) : null}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
