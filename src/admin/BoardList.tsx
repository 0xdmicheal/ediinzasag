import { useMemo } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowRight, Bot, CalendarClock, ChevronLeft, ChevronRight, Columns3, Globe2, List, Search, Tag as TagIcon, UserRound, Users } from "lucide-react"
import { cn } from "cn"

import { formatWhen, isEditor, isScheduled, readiness, statusMeta, statusOrder, timeAgo } from "@/admin/rules"
import { Select } from "@/admin/Select"
import { Avatar, inputClass } from "@/admin/ui"
import type { Article, Member, Status, Tag } from "@/admin/types"
import { deskLabel, type Desk } from "@/content/stories"

/*
 * The board's article list. Built for thousands of articles: status tabs with
 * counts, filters and a paged table, and a kanban view that only shows each
 * column's latest few. Tab, filters, sort and page live in the URL, so going
 * back from the editor lands on the same page.
 */

/** Status dots: colour only where it carries meaning (needs work, approved), neutral otherwise. */
const statusColor: Record<Status, string> = {
  draft: "var(--chart-4)",
  in_review: "var(--brand)",
  changes_requested: "var(--down)",
  approved: "var(--up)",
  published: "var(--foreground)",
}

export type BoardTab = "turn" | "active" | Status | "scheduled" | "all"

const PAGE = 50
const KANBAN_LIMIT = 8

const sorts = {
  updated: { label: "Сүүлд өөрчилсөн", key: (a: Article) => a.updatedAt },
  created: { label: "Үүсгэсэн", key: (a: Article) => a.createdAt },
  published: { label: "Нийтэлсэн", key: (a: Article) => a.publishedAt ?? "" },
  title: { label: "Гарчиг (А–Я)", key: (a: Article) => a.title },
} as const
type SortKey = keyof typeof sorts

/** Which articles a tab holds. "Таны ээлж" is what waits on this person. */
function inTab(article: Article, tab: BoardTab, member: Member) {
  switch (tab) {
    case "turn":
      return isEditor(member)
        ? article.status === "in_review" || article.status === "approved"
        : article.authorId === member.id && article.status === "changes_requested"
    case "active":
      return article.status !== "published"
    case "scheduled":
      return isScheduled(article)
    case "published":
      return article.status === "published" && !isScheduled(article)
    case "all":
      return true
    default:
      return article.status === tab
  }
}

function tabLabel(tab: BoardTab) {
  if (tab === "turn") return "Таны ээлж"
  if (tab === "active") return "Явагдаж буй"
  if (tab === "scheduled") return "Товлосон"
  if (tab === "all") return "Бүгд"
  return statusMeta[tab].label
}

const tabs: BoardTab[] = ["turn", "active", "draft", "in_review", "changes_requested", "approved", "scheduled", "published", "all"]

/** A tiny ring showing how many required readiness checks pass. */
function ReadinessRing({ article }: { article: Article }) {
  const checks = readiness(article, article.origin).filter((check) => check.required)
  const done = checks.filter((check) => check.ok).length
  const ratio = done / checks.length
  const r = 9
  const c = 2 * Math.PI * r
  return (
    <span className="flex items-center gap-1.5" title={`Бэлэн байдал ${done}/${checks.length}`}>
      <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <circle cx="12" cy="12" r={r} fill="none" stroke={ratio === 1 ? "var(--up)" : "var(--brand)"} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * ratio} ${c}`} />
      </svg>
      <span className="text-muted-foreground font-mono text-[11px]">
        {done}/{checks.length}
      </span>
    </span>
  )
}

function StatusLabel({ article }: { article: Article }) {
  const scheduled = isScheduled(article)
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: scheduled ? "var(--brand)" : statusColor[article.status] }} aria-hidden />
      {scheduled ? "Товлосон" : statusMeta[article.status].label}
    </span>
  )
}

function TagChips({ article, tags, max = 3 }: { article: Article; tags: Map<string, string>; max?: number }) {
  if (!article.tags.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {article.tags.slice(0, max).map((slug) => (
        <span key={slug} className="bg-foreground/[0.06] rounded-md px-1.5 py-0.5 text-[11px]">
          #{tags.get(slug) ?? slug}
        </span>
      ))}
      {article.tags.length > max ? <span className="text-muted-foreground text-[11px]">+{article.tags.length - max}</span> : null}
    </span>
  )
}

/** The time that matters for the row: when it goes live if scheduled, else the last change. */
function When({ article }: { article: Article }) {
  if (isScheduled(article)) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium whitespace-nowrap">
        <CalendarClock className="size-3.5" />
        {formatWhen(article.publishedAt!)}
      </span>
    )
  }
  return (
    <time dateTime={article.updatedAt} title={formatWhen(article.updatedAt)} className="text-muted-foreground text-[12px] whitespace-nowrap">
      {timeAgo(article.updatedAt)}
    </time>
  )
}

function Row({ article, tags }: { article: Article; tags: Map<string, string> }) {
  return (
    <li>
      <Link
        to={`/edit/${article.id}`}
        className="hover:bg-foreground/[0.03] grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors md:grid-cols-[8.5rem_minmax(0,1fr)_10rem_5rem_4.5rem_9rem]"
      >
        <span className="order-2 md:order-none">
          <StatusLabel article={article} />
        </span>
        <span className="order-1 col-span-2 flex min-w-0 flex-col gap-1 md:order-none md:col-span-1">
          <span className="font-news line-clamp-2 text-[15px] leading-snug">
            {article.origin === "bot" ? <Bot className="text-muted-foreground mr-1.5 inline size-3.5 align-[-2px]" aria-label="Агентын мэдээ" /> : null}
            {article.title || <span className="text-muted-foreground">Гарчиггүй ноорог</span>}
          </span>
          {article.status === "changes_requested" && article.reviewNote ? (
            <span className="line-clamp-1 text-[12px] text-[var(--down)]">“{article.reviewNote}”</span>
          ) : (
            <TagChips article={article} tags={tags} />
          )}
        </span>
        <span className="order-3 hidden min-w-0 items-center gap-2 md:order-none md:flex">
          <Avatar name={article.authorName || "EZ"} size="sm" />
          <span className="truncate text-[13px]">{article.authorName || "—"}</span>
        </span>
        <span className="text-muted-foreground hidden text-[12px] md:block">{deskLabel[article.desk]}</span>
        <span className="hidden md:block">
          <ReadinessRing article={article} />
        </span>
        <span className="order-4 justify-self-end md:order-none md:justify-self-start">
          <When article={article} />
        </span>
      </Link>
    </li>
  )
}

function KanbanCard({ article, tags }: { article: Article; tags: Map<string, string> }) {
  return (
    <Link
      to={`/edit/${article.id}`}
      className="bg-card hover:border-foreground/25 group flex flex-col gap-2 rounded-lg border p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors"
    >
      <p className="font-news line-clamp-2 text-[14px] leading-snug group-hover:underline">
        {article.title || <span className="text-muted-foreground">Гарчиггүй ноорог</span>}
      </p>
      <TagChips article={article} tags={tags} max={2} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {article.origin === "bot" ? <Bot className="text-muted-foreground size-3.5 shrink-0" aria-label="Агентын мэдээ" /> : null}
          <Avatar name={article.authorName || "EZ"} size="sm" />
          <span className="min-w-0 truncate">
            <When article={article} />
          </span>
        </span>
        <ReadinessRing article={article} />
      </div>
    </Link>
  )
}

export function BoardList({ articles, tags, member }: { articles: Article[] | null; tags: Tag[]; member: Member }) {
  const [params, setParams] = useSearchParams()
  const tab = (tabs.includes(params.get("tab") as BoardTab) ? params.get("tab") : "active") as BoardTab
  const query = params.get("q") ?? ""
  const tagFilter = params.get("tag") ?? ""
  const desk = params.get("desk") ?? ""
  const author = params.get("author") ?? ""
  const mine = params.get("mine") === "1"
  const sort = (params.get("sort") ?? "updated") as SortKey
  const view = params.get("view") === "kanban" ? "kanban" : "list"
  const page = Math.max(1, Number(params.get("page")) || 1)

  /**
   * Changes URL params; any filter change goes back to page 1. Reads the live
   * URL, not the last render's params, so two quick clicks don't undo each other.
   */
  function set(patch: Record<string, string | null>, keepPage = false) {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key)
      else next.set(key, value)
    }
    if (!keepPage) next.delete("page")
    setParams(next, { replace: true })
  }

  const tagLabels = useMemo(() => new Map(tags.map((tag) => [tag.slug, tag.label])), [tags])
  const authors = useMemo(() => {
    const names = new Map<string, string>()
    for (const article of articles ?? []) if (article.authorId) names.set(article.authorId, article.authorName || "Гишүүн")
    return [...names].sort((a, b) => a[1].localeCompare(b[1]))
  }, [articles])

  // Filters apply first; tab counts are taken from the filtered set so they always add up.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (articles ?? []).filter(
      (article) =>
        (!q || article.title.toLowerCase().includes(q) || article.authorName.toLowerCase().includes(q) || article.slug.includes(q)) &&
        (!tagFilter || article.tags.includes(tagFilter)) &&
        (!desk || article.desk === desk) &&
        (!author || article.authorId === author) &&
        (!mine || article.authorId === member.id),
    )
  }, [articles, query, tagFilter, desk, author, mine, member.id])

  const counts = useMemo(() => Object.fromEntries(tabs.map((key) => [key, filtered.filter((article) => inTab(article, key, member)).length])) as Record<BoardTab, number>, [filtered, member])

  const sorted = useMemo(() => {
    const key = sorts[sort]?.key ?? sorts.updated.key
    const list = filtered.filter((article) => inTab(article, tab, member))
    return sort === "title" ? list.sort((a, b) => key(a).localeCompare(key(b))) : list.sort((a, b) => key(b).localeCompare(key(a)))
  }, [filtered, tab, sort, member])

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE))
  const current = Math.min(page, pages)
  const shown = sorted.slice((current - 1) * PAGE, current * PAGE)
  const filtering = Boolean(query || tagFilter || desk || author || mine)

  return (
    <section aria-label="Нийтлэлүүд" className="flex flex-col gap-4">
      <div role="tablist" aria-label="Төлөв" className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => set({ tab: key === "active" ? null : key })}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              tab === key ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tabLabel(key)}
            <span className={cn("rounded-full px-1.5 font-mono text-[11px]", key === "turn" && counts.turn > 0 ? "bg-foreground text-background" : "bg-foreground/[0.06]")}>
              {articles ? counts[key].toLocaleString("en-US") : "…"}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <span className="sr-only">Хайх</span>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
          <input
            id="board-search"
            type="search"
            value={query}
            onChange={(event) => set({ q: event.target.value })}
            placeholder="Гарчиг, зохиогчоор хайх…"
            className={cn(inputClass, "h-9 rounded-lg py-0 pl-9 text-[13px]")}
          />
        </label>
        <Select
          label="Шошгоор шүүх"
          value={tagFilter}
          onChange={(value) => set({ tag: value })}
          icon={<TagIcon className="size-3.5" />}
          className="w-44"
          options={[{ value: "", label: "Бүх шошго" }, ...tags.map((tag) => ({ value: tag.slug, label: `#${tag.label}` }))]}
        />
        <Select
          label="Бүсээр шүүх"
          value={desk}
          onChange={(value) => set({ desk: value })}
          icon={<Globe2 className="size-3.5" />}
          className="w-36"
          options={[{ value: "", label: "Бүх бүс" }, ...(Object.keys(deskLabel) as Desk[]).map((key) => ({ value: key, label: deskLabel[key] }))]}
        />
        <Select
          label="Зохиогчоор шүүх"
          value={author}
          onChange={(value) => set({ author: value })}
          icon={<Users className="size-3.5" />}
          className="w-44"
          options={[{ value: "", label: "Бүх зохиогч" }, ...authors.map(([id, name]) => ({ value: id, label: name }))]}
        />
        <button
          type="button"
          aria-pressed={mine}
          onClick={() => set({ mine: mine ? null : "1" })}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
            mine ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/25",
          )}
        >
          <UserRound className="size-3.5" />
          Миний
        </button>
        {filtering ? (
          <button
            type="button"
            onClick={() => set({ q: null, tag: null, desk: null, author: null, mine: null })}
            className="text-muted-foreground hover:text-foreground h-9 px-1 text-[13px] underline-offset-4 hover:underline"
          >
            Цэвэрлэх
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {view === "list" ? (
            <Select
              label="Эрэмбэ"
              value={sort}
              onChange={(value) => set({ sort: value === "updated" ? null : value })}
              className="w-44"
              options={(Object.keys(sorts) as SortKey[]).map((key) => ({ value: key, label: sorts[key].label }))}
            />
          ) : null}
          <div role="group" aria-label="Харагдац" className="bg-muted flex rounded-lg p-0.5">
            {(["list", "kanban"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => set({ view: key === "list" ? null : key }, true)}
                title={key === "list" ? "Жагсаалт" : "Самбар"}
                className={cn("grid h-8 w-9 place-items-center rounded-md transition-colors", view === key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {key === "list" ? <List className="size-4" /> : <Columns3 className="size-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div className="grid min-w-[68rem] grid-cols-5 gap-4">
            {statusOrder.map((status) => {
              const column = filtered.filter((article) => article.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              return (
                <section key={status} aria-label={statusMeta[status].label} className="bg-muted/50 flex flex-col gap-2 rounded-xl border p-2.5">
                  <header className="flex items-center justify-between px-1 pt-1">
                    <span className="flex items-center gap-2 text-[13px] font-semibold">
                      <span className="size-2 rounded-full" style={{ backgroundColor: statusColor[status] }} aria-hidden />
                      {statusMeta[status].label}
                    </span>
                    <span className="text-muted-foreground font-mono text-[12px]">{column.length.toLocaleString("en-US")}</span>
                  </header>
                  {column.slice(0, KANBAN_LIMIT).map((article) => (
                    <KanbanCard key={article.id} article={article} tags={tagLabels} />
                  ))}
                  {articles !== null && column.length === 0 ? (
                    <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-[12px]">Хоосон</p>
                  ) : null}
                  {column.length > KANBAN_LIMIT ? (
                    <button
                      type="button"
                      onClick={() => set({ view: null, tab: status })}
                      className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex items-center justify-center gap-1 rounded-lg py-2 text-[12px] font-medium transition-colors"
                    >
                      Бүгдийг харах ({column.length.toLocaleString("en-US")})
                      <ArrowRight className="size-3.5" />
                    </button>
                  ) : null}
                </section>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <div className="text-muted-foreground hidden grid-cols-[8.5rem_minmax(0,1fr)_10rem_5rem_4.5rem_9rem] gap-x-4 border-b px-4 py-2 font-mono text-[11px] uppercase md:grid">
            <span>Төлөв</span>
            <span>Гарчиг</span>
            <span>Зохиогч</span>
            <span>Бүс</span>
            <span>Бэлэн</span>
            <span>{tab === "scheduled" ? "Нийтлэгдэх" : "Өөрчилсөн"}</span>
          </div>
          {articles === null ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-[13px]">Ачаалж байна…</p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-[13px]">
              {filtering ? "Шүүлтүүрт тохирох нийтлэл алга." : tab === "turn" ? "Таны ээлжинд хүлээгдэж буй нийтлэл алга." : "Энд нийтлэл алга."}
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map((article) => (
                <Row key={article.id} article={article} tags={tagLabels} />
              ))}
            </ul>
          )}
          {sorted.length > PAGE ? (
            <nav aria-label="Хуудас" className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-[13px]">
              <span className="text-muted-foreground">
                {((current - 1) * PAGE + 1).toLocaleString("en-US")}–{Math.min(current * PAGE, sorted.length).toLocaleString("en-US")} / {sorted.length.toLocaleString("en-US")}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={current <= 1}
                  onClick={() => set({ page: current - 1 > 1 ? String(current - 1) : null }, true)}
                  aria-label="Өмнөх хуудас"
                  className="hover:bg-foreground/5 grid size-8 place-items-center rounded-md disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="font-mono text-[12px]">
                  {current} / {pages}
                </span>
                <button
                  type="button"
                  disabled={current >= pages}
                  onClick={() => set({ page: String(current + 1) }, true)}
                  aria-label="Дараагийн хуудас"
                  className="hover:bg-foreground/5 grid size-8 place-items-center rounded-md disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </span>
            </nav>
          ) : null}
        </div>
      )}
    </section>
  )
}
