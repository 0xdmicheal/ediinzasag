import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowRight, Bot, FilePlus2, Search, SlidersHorizontal, X } from "lucide-react"
import { cn } from "cn"

import { canEdit, formatWhen, isEditor, isScheduled, statusMeta, timeAgo } from "@/admin/rules"
import { Select } from "@/admin/Select"
import { buttonClass, inputClass } from "@/admin/ui"
import type { Article, Member, Tag } from "@/admin/types"
import { deskLabel, type Desk } from "@/content/stories"

/*
 * The board: four tiles (what to do, drafts, in review, published) are the only
 * navigation; each row says what to do with it in one button. Search covers
 * every article; the rarer filters hide behind "Шүүлтүүр". Tile, search and
 * filters live in the URL, so back from the editor lands on the same view.
 */

export type BoardTile = "todo" | "drafts" | "review" | "published"

const STEP = 30

const tiles: { key: BoardTile; label: string; hint: string }[] = [
  { key: "todo", label: "Хийх ажил", hint: "Таны хийх зүйл" },
  { key: "drafts", label: "Ноорог", hint: "Бичигдэж буй" },
  { key: "review", label: "Хяналтад", hint: "Хянах, нийтлэх, товлосон" },
  { key: "published", label: "Нийтэлсэн", hint: "Сайт дээр" },
]

function inTile(article: Article, tile: BoardTile, member: Member) {
  const mine = article.authorId === member.id
  switch (tile) {
    case "todo":
      return (
        (mine && (article.status === "draft" || article.status === "changes_requested")) ||
        (isEditor(member) && (article.status === "in_review" || article.status === "approved"))
      )
    case "drafts":
      return article.status === "draft" || article.status === "changes_requested"
    case "review":
      return article.status === "in_review" || article.status === "approved" || isScheduled(article)
    case "published":
      return article.status === "published" && !isScheduled(article)
  }
}

/** The one thing to do with an article, said as a button. */
function action(article: Article, member: Member) {
  if (isEditor(member) && article.status === "in_review") return "Хянах"
  if (isEditor(member) && article.status === "approved") return "Нийтлэх"
  if ((article.status === "draft" || article.status === "changes_requested") && canEdit(member, article)) return "Засах"
  return "Нээх"
}

/** Status in plain words, coloured only where it asks for something. */
function StatusText({ article }: { article: Article }) {
  if (isScheduled(article)) return <span className="text-brand-strong">Товлосон · {formatWhen(article.publishedAt!)}</span>
  const tone = {
    draft: "text-muted-foreground",
    in_review: "text-brand-strong",
    changes_requested: "text-[var(--down)]",
    approved: "text-[var(--up)]",
    published: "text-muted-foreground",
  }[article.status]
  return <span className={tone}>{statusMeta[article.status].label}</span>
}

function Row({ article, member, tags }: { article: Article; member: Member; tags: Map<string, string> }) {
  const label = action(article, member)
  const primary = label !== "Нээх"
  const firstTag = article.tags[0]
  return (
    <li>
      <Link to={`/edit/${article.id}`} className="hover:bg-foreground/[0.025] group flex items-center gap-4 px-5 py-4 transition-colors">
        <div className="min-w-0 flex-1">
          <p className="font-news line-clamp-2 text-[16px] leading-snug">
            {article.origin === "bot" ? <Bot className="text-muted-foreground mr-1.5 inline size-4 align-[-2px]" aria-label="Агентын мэдээ" /> : null}
            {article.title || <span className="text-muted-foreground">Гарчиггүй ноорог</span>}
          </p>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px]">
            <span>{article.authorName || "Агент"}</span>
            <span aria-hidden>·</span>
            <span title={formatWhen(article.updatedAt)}>{timeAgo(article.publishedAt && article.status === "published" ? article.publishedAt : article.updatedAt)}</span>
            {firstTag ? (
              <>
                <span aria-hidden>·</span>
                <span>#{tags.get(firstTag) ?? firstTag}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <StatusText article={article} />
          </p>
          {article.status === "changes_requested" && article.reviewNote ? (
            <p className="mt-1.5 line-clamp-1 text-[13px] text-[var(--down)]">Редактор: “{article.reviewNote}”</p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-4 text-[13px] font-medium transition-colors",
            primary ? "bg-foreground text-background group-hover:bg-foreground/85" : "text-muted-foreground group-hover:text-foreground border",
          )}
        >
          {label}
          <ArrowRight className="size-3.5" />
        </span>
      </Link>
    </li>
  )
}

export function BoardList({ articles, tags, member }: { articles: Article[] | null; tags: Tag[]; member: Member }) {
  const [params, setParams] = useSearchParams()
  const tile = (tiles.some((t) => t.key === params.get("t")) ? params.get("t") : "todo") as BoardTile
  const query = params.get("q") ?? ""
  const tagFilter = params.get("tag") ?? ""
  const desk = params.get("desk") ?? ""
  const author = params.get("author") ?? ""
  const mine = params.get("mine") === "1"
  const [shownCount, setShownCount] = useState(STEP)
  const filterCount = [tagFilter, desk, author, mine ? "1" : ""].filter(Boolean).length
  const [filtersOpen, setFiltersOpen] = useState(filterCount > 0)

  /** Reads the live URL, not the last render's params, so two quick clicks don't undo each other. */
  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
    setShownCount(STEP)
  }

  const tagLabels = useMemo(() => new Map(tags.map((tag) => [tag.slug, tag.label])), [tags])
  const authors = useMemo(() => {
    const names = new Map<string, string>()
    for (const article of articles ?? []) if (article.authorId) names.set(article.authorId, article.authorName || "Гишүүн")
    return [...names].sort((a, b) => a[1].localeCompare(b[1]))
  }, [articles])

  const filtered = useMemo(
    () =>
      (articles ?? []).filter(
        (article) =>
          (!tagFilter || article.tags.includes(tagFilter)) &&
          (!desk || article.desk === desk) &&
          (!author || article.authorId === author) &&
          (!mine || article.authorId === member.id),
      ),
    [articles, tagFilter, desk, author, mine, member.id],
  )

  const counts = useMemo(
    () => Object.fromEntries(tiles.map((t) => [t.key, filtered.filter((article) => inTile(article, t.key, member)).length])) as Record<BoardTile, number>,
    [filtered, member],
  )

  // A search looks through every article, whatever tile is open.
  const searching = query.trim().length > 0
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const result = searching
      ? filtered.filter((article) => article.title.toLowerCase().includes(q) || article.authorName.toLowerCase().includes(q))
      : filtered.filter((article) => inTile(article, tile, member))
    const when = (article: Article) => (tile === "published" && !searching ? article.publishedAt ?? "" : article.updatedAt)
    return result.sort((a, b) => when(b).localeCompare(when(a)))
  }, [filtered, tile, member, query, searching])

  const shown = list.slice(0, shownCount)
  const current = tiles.find((t) => t.key === tile)!

  return (
    <section aria-label="Нийтлэлүүд" className="flex flex-col gap-5">
      <div role="tablist" aria-label="Нийтлэлүүд" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const selected = !searching && tile === t.key
          const count = counts[t.key]
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => set({ t: t.key === "todo" ? null : t.key, q: null })}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                selected ? "bg-foreground text-background border-foreground" : "bg-card hover:border-foreground/30",
              )}
            >
              <span className="font-news text-[1.75rem] leading-none tabular-nums">{articles ? count.toLocaleString("en-US") : "…"}</span>
              <span className="text-[14px] font-medium">{t.label}</span>
              <span className={cn("text-[12px]", selected ? "text-background/70" : "text-muted-foreground")}>{t.hint}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <label className="relative flex-1">
            <span className="sr-only">Хайх</span>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2" />
            <input
              id="board-search"
              type="search"
              value={query}
              onChange={(event) => set({ q: event.target.value })}
              placeholder="Бүх нийтлэлээс гарчиг, зохиогчоор хайх…"
              className={cn(inputClass, "h-11 rounded-xl pl-10 text-[14px]")}
            />
          </label>
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-[14px] font-medium transition-colors",
              filtersOpen || filterCount ? "border-foreground/40 bg-card" : "bg-card hover:border-foreground/30",
            )}
          >
            <SlidersHorizontal className="size-4" />
            Шүүлтүүр
            {filterCount ? <span className="bg-foreground text-background grid size-5 place-items-center rounded-full text-[11px]">{filterCount}</span> : null}
          </button>
        </div>

        {filtersOpen ? (
          <div className="bg-card flex flex-wrap items-center gap-2.5 rounded-xl border p-3">
            <Select
              label="Шошго"
              value={tagFilter}
              onChange={(value) => set({ tag: value })}
              className="w-44"
              options={[{ value: "", label: "Бүх шошго" }, ...tags.map((tag) => ({ value: tag.slug, label: `#${tag.label}` }))]}
            />
            <Select
              label="Бүс"
              value={desk}
              onChange={(value) => set({ desk: value })}
              className="w-36"
              options={[{ value: "", label: "Бүх бүс" }, ...(Object.keys(deskLabel) as Desk[]).map((key) => ({ value: key, label: deskLabel[key] }))]}
            />
            <Select
              label="Зохиогч"
              value={author}
              onChange={(value) => set({ author: value })}
              className="w-44"
              options={[{ value: "", label: "Бүх зохиогч" }, ...authors.map(([id, name]) => ({ value: id, label: name }))]}
            />
            <label className="flex h-9 cursor-pointer items-center gap-2 px-1 text-[13px]">
              <input type="checkbox" checked={mine} onChange={() => set({ mine: mine ? null : "1" })} className="accent-[var(--brand)] size-4" />
              Зөвхөн миний
            </label>
            {filterCount ? (
              <button
                type="button"
                onClick={() => set({ tag: null, desk: null, author: null, mine: null })}
                className="text-muted-foreground hover:text-foreground ml-auto inline-flex h-9 items-center gap-1 px-2 text-[13px]"
              >
                <X className="size-3.5" />
                Арилгах
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <p className="text-muted-foreground mb-2 px-1 text-[13px]">
          {searching ? `“${query.trim()}” — ${list.length.toLocaleString("en-US")} илэрц` : `${current.label} · ${list.length.toLocaleString("en-US")}`}
        </p>
        <div className="bg-card overflow-hidden rounded-xl border">
          {articles === null ? (
            <p className="text-muted-foreground px-5 py-12 text-center text-[14px]">Ачаалж байна…</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <p className="text-muted-foreground text-[14px]">
                {searching
                  ? "Илэрц олдсонгүй."
                  : tile === "todo"
                    ? "Одоогоор таны хийх ажил алга."
                    : filterCount
                      ? "Шүүлтүүрт тохирох нийтлэл алга."
                      : "Энд нийтлэл алга."}
              </p>
              {tile === "todo" && !searching ? (
                <Link to="/new" className={buttonClass.primary}>
                  <FilePlus2 className="size-4" />
                  Шинэ нийтлэл эхлүүлэх
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y">
              {shown.map((article) => (
                <Row key={article.id} article={article} member={member} tags={tagLabels} />
              ))}
            </ul>
          )}
        </div>
        {list.length > shown.length ? (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={() => setShownCount((count) => count + STEP)} className={buttonClass.ghost}>
              Цааш харуулах ({(list.length - shown.length).toLocaleString("en-US")})
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
