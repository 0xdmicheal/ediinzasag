import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowRight, Bot, ChevronDown, ExternalLink, FilePlus2, RefreshCw, Search, SlidersHorizontal, Trash2, Undo2, X } from "lucide-react"
import { cn } from "cn"

import { RunDetailsView } from "@/admin/AgentRunDetails"
import { useConfirm } from "@/admin/ConfirmDialog"
import { Folder } from "@/admin/Folder"
import { categoriesOf, NEWS_CATEGORIES } from "@/admin/news-categories"
import { isEditor, timeAgo } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import type { NewsItem, NewsRun } from "@/admin/types"
import { buttonClass, Notice } from "@/admin/ui"
import { WelcomeGuide } from "@/admin/WelcomeGuide"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/*
 * The newsroom's front page (the owner's sketch, 20 Oct): the news agent across the top,
 * then every story it read in the last two weeks sorted into folders (Asia, America,
 * Economy, Mongolia, …) with the open folder's list beside them. The agent cards the best
 * few itself three times a day; here anyone on the team cards another («Make card») or
 * closes it. Editors can delete a card again; the story then moves to Closed.
 */

type StatusFilter = "new" | "queued" | "filed" | "dismissed" | "all"

const statusOptions: { key: StatusFilter; label: string }[] = [
  { key: "new", label: "New" },
  { key: "queued", label: "Drafting" },
  { key: "filed", label: "Carded" },
  { key: "dismissed", label: "Closed" },
  { key: "all", label: "All" },
]

/** The folders: everything first, then the sketch's order. A story can sit in several. */
const FOLDERS: { key: string; label: string; holds: (item: NewsItem, topics: string[]) => boolean }[] = [
  { key: "all", label: "All news", holds: () => true },
  { key: "asia", label: "Asia", holds: (_, topics) => topics.includes("asia") || topics.includes("china") },
  { key: "america", label: "America", holds: (_, topics) => topics.includes("us") },
  { key: "economy", label: "Economy", holds: (_, topics) => topics.includes("economy") },
  { key: "mongolia", label: "Mongolia", holds: (item) => item.desk === "mongolia" || item.mongolia },
  { key: "markets", label: "Markets", holds: (_, topics) => topics.includes("markets") },
  { key: "mining", label: "Mining", holds: (_, topics) => topics.includes("mining") },
  { key: "energy", label: "Energy", holds: (_, topics) => topics.includes("energy") },
  { key: "geopolitics", label: "Geopolitics", holds: (_, topics) => topics.includes("geopolitics") },
  { key: "europe", label: "Europe", holds: (_, topics) => topics.includes("europe") },
  { key: "tech", label: "Tech & AI", holds: (_, topics) => topics.includes("tech") || topics.includes("ai") },
  { key: "crypto", label: "Crypto", holds: (_, topics) => topics.includes("crypto") },
]

const PAGE = 60

const categoryLabel = new Map(NEWS_CATEGORIES.map((category) => [category.key, category.label]))

function ago(iso: string | null) {
  if (!iso) return ""
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (minutes < 60) return `${minutes} min`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`
  return `${Math.round(minutes / 1440)} d`
}

/** The agent runs at 00:00, 06:00 and 12:00 UTC (08:00, 14:00, 20:00 in Ulaanbaatar). */
function nextRun(now = new Date()) {
  const next = new Date(now)
  next.setUTCMinutes(0, 0, 0)
  const hour = [0, 6, 12].find((value) => value > now.getUTCHours())
  if (hour === undefined) next.setUTCDate(next.getUTCDate() + 1)
  next.setUTCHours(hour ?? 0)
  return next.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

/** The score on a photo: a solid chip, so only the number carries the colour. */
const scoreText = (priority: number) =>
  priority >= 8 ? "text-[var(--state-approved)]" : priority >= 5 ? "text-[var(--state-review)]" : "text-muted-foreground"

const inStatus = (item: NewsItem, status: StatusFilter) =>
  status === "all" || item.status === status || (status === "queued" && item.status === "drafting")

export function InboxPage() {
  const { backend, member } = useTeam()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const [runs, setRuns] = useState<NewsRun[]>([])
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ text: string; problem: string } | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [error, setError] = useState("")
  const [status, setStatus] = useState<StatusFilter>("new")
  const [byScore, setByScore] = useState(true)
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const [guideOpen, setGuideOpen] = useState(() => WelcomeGuide.initiallyOpen(member))
  /** Ids with a request in flight. */
  const [busy, setBusy] = useState<Set<string>>(new Set())
  /** The last failure per story, shown under its own buttons rather than at the top of a long list. */
  const [failed, setFailed] = useState<Map<string, string>>(new Map())
  /** Stories acted on since the filters last changed: they stay in view, so «Open card» / «Restore» are right there. */
  const [touched, setTouched] = useState<Set<string>>(new Set())

  const folder = FOLDERS.find((entry) => entry.key === params.get("folder")) ?? FOLDERS[0]
  const showGuide = guideOpen || params.get("guide") === "1"

  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: 0 })
  }, [folder.key])

  useEffect(() => {
    backend
      .listNewsItems()
      .then(setItems)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Couldn't load the news"))
    backend.listNewsRuns().then(setRuns, () => setRuns([]))
  }, [backend])

  /** Topic categories per story, worked out once per load. */
  const categories = useMemo(() => new Map((items ?? []).map((item) => [item.id, categoriesOf(item)])), [items])

  /** Stories per folder under the current status, for the folders' counters. */
  const folderCounts = useMemo(() => {
    const result = new Map<string, number>()
    for (const item of items ?? []) {
      if (!inStatus(item, status)) continue
      const topics = categories.get(item.id) ?? []
      for (const entry of FOLDERS) if (entry.holds(item, topics)) result.set(entry.key, (result.get(entry.key) ?? 0) + 1)
    }
    return result
  }, [items, status, categories])

  const drafting = useMemo(() => (items ?? []).filter((item) => item.status === "queued" || item.status === "drafting").length, [items])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = (items ?? []).filter(
      (item) =>
        (inStatus(item, status) || touched.has(item.id)) &&
        folder.holds(item, categories.get(item.id) ?? []) &&
        (!needle || item.title.toLowerCase().includes(needle) || item.source.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle)),
    )
    const time = (item: NewsItem) => Date.parse(item.publishedAt ?? item.seenAt)
    return list.sort((a, b) => (byScore ? b.priority - a.priority : 0) || time(b) - time(a))
  }, [items, status, folder, categories, query, byScore, touched])

  async function runAgent() {
    setRunning(true)
    setRunResult(null)
    try {
      const result = await backend.runNewsAgent()
      const [list, nextRuns] = await Promise.all([backend.listNewsItems(), backend.listNewsRuns()])
      setItems(list)
      setRuns(nextRuns)
      setRunResult({
        text: result.queued
          ? `Picked ${result.queued} ${result.queued === 1 ? "story" : "stories"}. The agent drafts them one by one; cards appear within a few minutes.`
          : "No new stories picked.",
        problem: "",
      })
    } catch (failure) {
      setRunResult({ text: "The run failed. See details.", problem: failure instanceof Error ? failure.message : String(failure) })
      setDetailsOpen(true)
    } finally {
      setRunning(false)
    }
  }

  function patch(id: string, change: Partial<NewsItem>) {
    setItems((list) => list?.map((item) => (item.id === id ? { ...item, ...change } : item)) ?? null)
    setTouched((set) => new Set(set).add(id))
  }

  /** A new folder, filter or search starts a fresh view. */
  function refilter(change: () => void) {
    change()
    setLimit(PAGE)
    setTouched(new Set())
  }

  function openFolder(key: string) {
    refilter(() => {
      const next = new URLSearchParams(params)
      if (key === FOLDERS[0].key) next.delete("folder")
      else next.set("folder", key)
      setParams(next, { replace: true })
    })
  }

  function closeGuide() {
    setGuideOpen(false)
    if (params.get("guide")) {
      const next = new URLSearchParams(params)
      next.delete("guide")
      setParams(next, { replace: true })
    }
  }

  async function act(id: string, task: () => Promise<void>) {
    setBusy((set) => new Set(set).add(id))
    setFailed((map) => {
      const next = new Map(map)
      next.delete(id)
      return next
    })
    try {
      await task()
    } catch (failure) {
      setFailed((map) => new Map(map).set(id, failure instanceof Error ? failure.message : "Something went wrong"))
    } finally {
      setBusy((set) => {
        const next = new Set(set)
        next.delete(id)
        return next
      })
    }
  }

  const file = (item: NewsItem) =>
    act(item.id, async () => {
      const articleId = await backend.fileNewsItem(item.id)
      patch(item.id, { status: "filed", articleId })
    })

  const dismiss = (item: NewsItem, dismissed: boolean) =>
    act(item.id, async () => {
      await backend.setNewsItemDismissed(item.id, dismissed)
      patch(item.id, { status: dismissed ? "dismissed" : "new" })
    })

  const removeCard = async (item: NewsItem) => {
    const ok = await confirm({
      title: "Delete this card?",
      message: `“${item.title}” is removed from the board for good. The story moves to Closed and the agent won't card it again.`,
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!ok) return
    await act(item.id, async () => {
      await backend.deleteNewsCard(item.id)
      patch(item.id, { status: "dismissed", articleId: null })
    })
  }

  const last = runs[0]
  const statusLabel = statusOptions.find((option) => option.key === status)!.label

  return (
    <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-8 px-8 py-10 lg:px-12 xl:px-16">
      {showGuide ? <WelcomeGuide member={member} onClose={closeGuide} /> : null}

      {/* The agent: what it did last, when it runs next, and «Pull now». */}
      <section aria-label="News agent" className="bg-card rounded-2xl border px-7 py-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <span className="bg-foreground text-background grid size-12 shrink-0 place-items-center rounded-xl">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[15px] font-medium">
              News agent
              <span className={cn("size-2 rounded-full", running || drafting ? "animate-pulse bg-[var(--state-review)]" : "bg-[var(--state-approved)]")} aria-hidden />
              <span className="text-muted-foreground text-[13px] font-normal">
                {running ? "Reading the feeds…" : drafting ? `Drafting ${drafting} ${drafting === 1 ? "story" : "stories"}` : "Idle"}
              </span>
            </p>
            <p className="text-muted-foreground mt-1 truncate text-[13px]">
              {runResult?.text ??
                (last
                  ? `Last run ${timeAgo(last.startedAt)} (${last.trigger === "cron" ? "scheduled" : "manual"}) · ${last.details?.fresh ?? last.scanned} stories read · ${last.created} ${last.created === 1 ? "card" : "cards"}`
                  : "Hasn't run yet.")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-[12px]">Next run</p>
            <p className="text-[15px] font-medium tabular-nums">{nextRun()}</p>
          </div>
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            className={cn(buttonClass.ghost, "gap-1")}
          >
            Details
            <ChevronDown className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} />
          </button>
          {isEditor(member) ? (
            <button type="button" disabled={running} onClick={runAgent} className={buttonClass.primary}>
              <RefreshCw className={cn("size-4", running && "animate-spin")} />
              {running ? "Pulling…" : "Pull now"}
            </button>
          ) : null}
        </div>
        {detailsOpen ? (
          <div className="mt-6 border-t pt-6">
            <RunDetailsView run={last} problem={runResult?.problem ?? ""} />
          </div>
        ) : null}
      </section>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="-mb-2 flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 gap-1.5 px-3.5 shadow-xs">
              {status === "new" && byScore ? "Filter" : `${statusLabel} · ${byScore ? "Most important" : "Newest"}`}
              <SlidersHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={status} onValueChange={(value) => refilter(() => setStatus(value as StatusFilter))}>
              {statusOptions.map((option) => (
                <DropdownMenuRadioItem key={option.key} value={option.key}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={byScore ? "score" : "time"} onValueChange={(value) => setByScore(value === "score")}>
              <DropdownMenuRadioItem value="score">Most important</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="time">Newest</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-card flex min-h-[420px] flex-1 gap-4 overflow-hidden rounded-2xl border p-5">
        {/* Folders, with an arrow from the open one to its list. */}
        <div role="tablist" aria-label="Folders" aria-orientation="vertical" className="flex w-[148px] shrink-0 ez-scroll ez-scroll-left flex-col gap-2 pt-1 pr-4 pb-1 pl-1">
          {FOLDERS.map((entry) => (
            <div key={entry.key} className="relative">
              <Folder
                label={entry.label}
                count={items ? (folderCounts.get(entry.key) ?? 0) : undefined}
                open={entry.key === folder.key}
                onClick={() => openFolder(entry.key)}
              />
              {entry.key === folder.key ? (
                <ArrowRight className="text-muted-foreground absolute top-1/2 -right-4 size-4 -translate-y-1/2" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>

        <section aria-label={`${folder.label} news`} className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-6 py-5">
            <h1 className="ez-title text-[1.75rem] leading-none">{folder.label}</h1>
            <span className="text-muted-foreground text-[13px] tabular-nums">
              {items ? `${shown.length} ${shown.length === 1 ? "story" : "stories"} · ${statusLabel.toLowerCase()}` : "Loading…"}
            </span>
            <label className="bg-secondary ml-auto flex h-9 w-64 max-w-full items-center gap-2 rounded-lg px-3">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <span className="sr-only">Search this folder</span>
              <input
                type="search"
                value={query}
                onChange={(event) => refilter(() => setQuery(event.target.value))}
                placeholder={`Search ${folder.label}`}
                className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
            </label>
          </header>
          <div ref={list} className="ez-scroll min-h-0 flex-1">

          {!items ? (
            <p className="text-muted-foreground p-8 text-[14px]">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground p-8 text-[14px]">
              {items.length ? `Nothing in ${folder.label} for this filter.` : "No stories yet. They show up here after the agent runs (Pull now)."}
            </p>
          ) : (
            <ul className="grid gap-5 p-6 md:grid-cols-2 2xl:grid-cols-3">
              {shown.slice(0, limit).map((item) => {
                const working = busy.has(item.id)
                const topics = categories.get(item.id) ?? []
                return (
                  <li
                    key={item.id}
                    className={cn("bg-card hover:border-foreground/25 flex flex-col overflow-hidden rounded-xl border transition-colors", item.status === "dismissed" && "opacity-60")}
                  >
                    <div className="bg-muted relative aspect-[16/9] overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(event) => (event.currentTarget.style.visibility = "hidden")}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <span
                        className={cn("bg-background/90 absolute top-3 left-3 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums shadow-xs backdrop-blur", scoreText(item.priority))}
                        title={item.why}
                      >
                        {item.priority}/10
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-muted-foreground truncate text-[12px]">
                        <span className="text-foreground font-medium">{item.source}</span> · {ago(item.publishedAt ?? item.seenAt)}
                      </p>
                      <a href={item.link} target="_blank" rel="noreferrer" className="mt-2 line-clamp-3 block text-[15px] leading-snug font-medium hover:underline">
                        {item.title}
                        <ExternalLink className="text-muted-foreground ml-1 inline size-3.5 align-baseline" />
                      </a>
                      {item.summary ? <p className="text-muted-foreground mt-2 line-clamp-2 text-[13px] leading-relaxed">{item.summary}</p> : null}
                      {topics.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {topics.map((key) => (
                            <span key={key} className="bg-foreground/[0.05] text-muted-foreground rounded-md px-2 py-0.5 text-[11px]">
                              {categoryLabel.get(key)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                        {item.status === "filed" && item.articleId ? (
                          <>
                            <Link to={`/edit/${item.articleId}`} className={buttonClass.ghost}>
                              Open card
                              <ArrowRight className="size-4" />
                            </Link>
                            {isEditor(member) ? (
                              <button type="button" disabled={working} onClick={() => removeCard(item)} className={buttonClass.danger}>
                                <Trash2 className="size-4" />
                                {working ? "Deleting…" : "Delete"}
                              </button>
                            ) : null}
                          </>
                        ) : item.status === "queued" || item.status === "drafting" ? (
                          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[12px]">
                            <RefreshCw className={cn("size-3.5", item.status === "drafting" && "animate-spin")} />
                            {item.status === "drafting" ? "The agent is drafting this…" : "Queued, the agent drafts it shortly"}
                          </span>
                        ) : item.status === "dismissed" ? (
                          <button type="button" disabled={working} onClick={() => dismiss(item, false)} className={buttonClass.ghost}>
                            <Undo2 className="size-4" />
                            Restore
                          </button>
                        ) : (
                          <>
                            <button type="button" disabled={working} onClick={() => file(item)} className={buttonClass.primary}>
                              <FilePlus2 className="size-4" />
                              {working ? "Preparing…" : "Make card"}
                            </button>
                            <button type="button" disabled={working} onClick={() => dismiss(item, true)} className={buttonClass.ghost}>
                              <X className="size-4" />
                              Close
                            </button>
                          </>
                        )}
                      </div>
                      {working && item.status === "new" ? (
                        <p className="text-muted-foreground mt-2 text-[12px]">The agent is drafting; this can take up to 2 minutes.</p>
                      ) : null}
                      {failed.has(item.id) ? (
                        <div className="mt-3">
                          <Notice tone="error">{failed.get(item.id)}</Notice>
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {shown.length > limit ? (
            <button type="button" onClick={() => setLimit((value) => value + PAGE)} className={cn(buttonClass.ghost, "mb-6 self-center")}>
              Show more ({shown.length - limit})
            </button>
          ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
