import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, ChevronDown, ExternalLink, FilePlus2, RefreshCw, Search, Trash2, Undo2, X } from "lucide-react"
import { cn } from "cn"

import { RunDetailsView } from "@/admin/AgentRunDetails"
import { useConfirm } from "@/admin/ConfirmDialog"
import { categoriesOf, NEWS_CATEGORIES } from "@/admin/news-categories"
import { isEditor } from "@/admin/rules"

import { useTeam } from "@/admin/session"
import type { NewsItem, NewsRun } from "@/admin/types"
import { buttonClass, inputClass, Notice, PageHeader, pageClass } from "@/admin/ui"

/*
 * "Мэдээний урсгал": every story the news agent read in the last two weeks.
 * The agent files the best few as cards itself each morning; here anyone on
 * the team turns any other story into a card ("Карт болгох") or clears it.
 * Editors can delete a card again ("Устгах"); the story then moves to «Хаасан».
 */

type StatusFilter = NewsItem["status"] | "all"
type DeskFilter = NewsItem["desk"] | "all"

const statusTabs: { key: StatusFilter; label: string }[] = [
  { key: "new", label: "New" },
  { key: "queued", label: "Drafting" },
  { key: "filed", label: "Carded" },
  { key: "dismissed", label: "Closed" },
  { key: "all", label: "All" },
]

const deskTabs: { key: DeskFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mongolia", label: "Mongolia" },
  { key: "world", label: "World" },
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

/** 8–10 strong, 5–7 worth a look, below that filler. */
function scoreClass(priority: number) {
  if (priority >= 8) return "bg-[color-mix(in_oklch,var(--up)_16%,transparent)] text-[var(--up)]"
  if (priority >= 5) return "bg-brand-soft text-brand-strong"
  return "bg-foreground/[0.06] text-muted-foreground"
}

function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: { key: T; label: string; count?: number }[]; onChange: (key: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="bg-muted inline-flex gap-1 rounded-full p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
          className={`h-8 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors ${value === option.key ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {option.label}
          {option.count !== undefined ? <span className="ml-1.5 font-mono text-[11px] opacity-70">{option.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function InboxPage() {
  const { backend, member } = useTeam()
  const confirm = useConfirm()
  const [runs, setRuns] = useState<NewsRun[]>([])
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ text: string; problem: string } | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [error, setError] = useState("")
  const [status, setStatus] = useState<StatusFilter>("new")
  const [desk, setDesk] = useState<DeskFilter>("all")
  const [category, setCategory] = useState("all")
  const [byScore, setByScore] = useState(true)
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE)
  /** Ids with a request in flight. */
  const [busy, setBusy] = useState<Set<string>>(new Set())
  /** The last failure per story, shown under its own buttons rather than at the top of a long list. */
  const [failed, setFailed] = useState<Map<string, string>>(new Map())
  /** Stories acted on since the filters last changed: they stay in view, so "Карт нээх" / "Буцаах" are right there. */
  const [touched, setTouched] = useState<Set<string>>(new Set())

  useEffect(() => {
    backend
      .listNewsItems()
      .then(setItems)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Couldn't load the inbox"))
    backend.listNewsRuns().then(setRuns, () => setRuns([]))
  }, [backend])

  /** Topic categories per story, worked out once per load. */
  const categories = useMemo(() => new Map((items ?? []).map((item) => [item.id, categoriesOf(item)])), [items])

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { new: 0, queued: 0, drafting: 0, filed: 0, dismissed: 0, all: 0 }
    for (const item of items ?? []) {
      if ((desk !== "all" && item.desk !== desk) || (category !== "all" && !categories.get(item.id)?.includes(category))) continue
      // "Бичиж байна" covers both waiting and being written.
      result[item.status === "drafting" ? "queued" : item.status] += 1
      result.all += 1
    }
    return result
  }, [items, desk, category, categories])

  /** Stories per category under the current status and region, for the topic chips. */
  const categoryCounts = useMemo(() => {
    const result = new Map<string, number>()
    let all = 0
    for (const item of items ?? []) {
      if ((status !== "all" && item.status !== status) || (desk !== "all" && item.desk !== desk)) continue
      all += 1
      for (const key of categories.get(item.id) ?? []) result.set(key, (result.get(key) ?? 0) + 1)
    }
    return { all, byKey: result }
  }, [items, status, desk, categories])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = (items ?? []).filter(
      (item) =>
        (status === "all" || item.status === status || (status === "queued" && item.status === "drafting") || touched.has(item.id)) &&
        (desk === "all" || item.desk === desk) &&
        (category === "all" || Boolean(categories.get(item.id)?.includes(category))) &&
        (!needle || item.title.toLowerCase().includes(needle) || item.source.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle)),
    )
    const time = (item: NewsItem) => Date.parse(item.publishedAt ?? item.seenAt)
    return list.sort((a, b) => (byScore ? b.priority - a.priority : 0) || time(b) - time(a))
  }, [items, status, desk, category, categories, query, byScore, touched])

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
          ? `Picked ${result.queued} ${result.queued === 1 ? "story" : "stories"}. The agent drafts them one by one; cards appear within a few minutes (see Drafting).`
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

  /** A new filter or search starts a fresh view. */
  function refilter(change: () => void) {
    change()
    setLimit(PAGE)
    setTouched(new Set())
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

  return (
    <div className={pageClass}>
      <PageHeader
        title="Inbox"
        description={
          <>
            Every story the agent read in the last 14 days. It cards the best ones at 08:00, 14:00 and 20:00. Use{" "}
            <strong className="text-foreground font-medium">Make card</strong> to add another to the board, or close what you don't need.
          </>
        }
        actions={
          isEditor(member) ? (
            <button type="button" disabled={running} onClick={runAgent} className={buttonClass.primary}>
              <RefreshCw className={cn("size-4", running && "animate-spin")} />
              {running ? "Pulling…" : "Pull now"}
            </button>
          ) : null
        }
      />

      <div className="bg-card rounded-xl border px-4 py-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground">
            {runResult?.text ??
              (runs[0]
                ? `Last run: ${runs[0].trigger === "cron" ? "scheduled" : "manual"} · ${runs[0].details?.fresh ?? runs[0].scanned} stories read · ${runs[0].created} ${runs[0].created === 1 ? "card" : "cards"}`
                : "The agent hasn't run yet. It runs at 08:00, 14:00 and 20:00.")}
          </span>
          <button type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)} className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-[12px]">
            <ChevronDown className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")} />
            Details
          </button>
        </div>
        {detailsOpen ? (
          <div className="mt-3 border-t pt-3">
            <RunDetailsView run={runs[0]} problem={runResult?.problem ?? ""} />
          </div>
        ) : null}
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Tabs label="Status" value={status} onChange={(key) => refilter(() => setStatus(key))} options={statusTabs.map((tab) => ({ ...tab, count: items ? counts[tab.key] : undefined }))} />
        <Tabs label="Desk" value={desk} onChange={(key) => refilter(() => setDesk(key))} options={deskTabs} />
        <Tabs
          label="Sort"
          value={byScore ? "score" : "time"}
          onChange={(key) => setByScore(key === "score")}
          options={[
            { key: "score", label: "Most important" },
            { key: "time", label: "Newest" },
          ]}
        />
      </div>

      {items ? (
        <div role="tablist" aria-label="Topic" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[{ key: "all", label: "All topics", count: categoryCounts.all }, ...NEWS_CATEGORIES.map((entry) => ({ key: entry.key, label: entry.label, count: categoryCounts.byKey.get(entry.key) ?? 0 }))]
            .filter((entry) => entry.key === "all" || entry.count > 0 || entry.key === category)
            .map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={category === entry.key}
                onClick={() => refilter(() => setCategory(entry.key))}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                  category === entry.key ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground bg-card",
                )}
              >
                {entry.label}
                <span className="ml-1.5 font-mono text-[11px] opacity-70">{entry.count}</span>
              </button>
            ))}
        </div>
      ) : null}

      <label className="relative block">
        <span className="sr-only">Search</span>
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(event) => refilter(() => setQuery(event.target.value))}
          placeholder="Search by headline or source"
          className={`${inputClass} pl-9`}
        />
      </label>

      {!items ? (
        <p className="text-muted-foreground text-[14px]">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground text-[14px]">
          {items.length ? "No matches." : "No stories yet. They show up here after the agent runs (Pull now)."}
        </p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {shown.slice(0, limit).map((item) => {
            const working = busy.has(item.id)
            return (
              <li key={item.id} className={`flex gap-4 px-4 py-4 ${item.status === "dismissed" ? "opacity-60" : ""}`}>
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => (event.currentTarget.style.visibility = "hidden")}
                    className="bg-muted hidden h-20 w-32 shrink-0 rounded-lg object-cover sm:block"
                  />
                ) : (
                  <div className="bg-muted hidden h-20 w-32 shrink-0 rounded-lg sm:block" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${scoreClass(item.priority)}`} title={item.why}>
                      {item.priority}/10
                    </span>
                    <span className="text-foreground font-medium">{item.source}</span>
                    <span>· {ago(item.publishedAt ?? item.seenAt)}</span>
                    {item.why ? <span className="truncate">· {item.why}</span> : null}
                  </div>
                  <a href={item.link} target="_blank" rel="noreferrer" className="font-news mt-1 line-clamp-2 block text-[16px] leading-snug hover:underline">
                    {item.title}
                    <ExternalLink className="text-muted-foreground ml-1 inline size-3.5 align-baseline" />
                  </a>
                  {item.summary ? <p className="text-muted-foreground mt-1 line-clamp-2 text-[13px]">{item.summary}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
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
                        {working ? <span className="text-muted-foreground text-[12px]">The agent is drafting; this can take up to 2 minutes.</span> : null}
                        <button type="button" disabled={working} onClick={() => dismiss(item, true)} className={buttonClass.ghost}>
                          <X className="size-4" />
                          Close
                        </button>
                      </>
                    )}
                    {(categories.get(item.id) ?? []).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => refilter(() => setCategory(key))}
                        className="bg-foreground/[0.05] text-muted-foreground hover:text-foreground rounded-full px-2 py-0.5 text-[11px]"
                      >
                        {categoryLabel.get(key)}
                      </button>
                    ))}
                  </div>
                  {failed.has(item.id) ? (
                    <div className="mt-2">
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
        <button type="button" onClick={() => setLimit((value) => value + PAGE)} className={`${buttonClass.ghost} self-center`}>
          Show more ({shown.length - limit})
        </button>
      ) : null}
    </div>
  )
}
