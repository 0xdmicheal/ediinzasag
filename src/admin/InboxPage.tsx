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
import { buttonClass, inputClass, Notice } from "@/admin/ui"

/*
 * "Мэдээний урсгал": every story the news agent read in the last two weeks.
 * The agent files the best few as cards itself each morning; here anyone on
 * the team turns any other story into a card ("Карт болгох") or clears it.
 * Editors can delete a card again ("Устгах"); the story then moves to «Хаасан».
 */

type StatusFilter = NewsItem["status"] | "all"
type DeskFilter = NewsItem["desk"] | "all"

const statusTabs: { key: StatusFilter; label: string }[] = [
  { key: "new", label: "Шинэ" },
  { key: "filed", label: "Карт болсон" },
  { key: "dismissed", label: "Хаасан" },
  { key: "all", label: "Бүгд" },
]

const deskTabs: { key: DeskFilter; label: string }[] = [
  { key: "all", label: "Бүгд" },
  { key: "mongolia", label: "Монгол" },
  { key: "world", label: "Дэлхий" },
]

const PAGE = 60

const categoryLabel = new Map(NEWS_CATEGORIES.map((category) => [category.key, category.label]))

function ago(iso: string | null) {
  if (!iso) return ""
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (minutes < 60) return `${minutes} мин`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} цаг`
  return `${Math.round(minutes / 1440)} өдөр`
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
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Ачаалж чадсангүй"))
    backend.listNewsRuns().then(setRuns, () => setRuns([]))
  }, [backend])

  /** Topic categories per story, worked out once per load. */
  const categories = useMemo(() => new Map((items ?? []).map((item) => [item.id, categoriesOf(item)])), [items])

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { new: 0, filed: 0, dismissed: 0, all: 0 }
    for (const item of items ?? []) {
      if ((desk !== "all" && item.desk !== desk) || (category !== "all" && !categories.get(item.id)?.includes(category))) continue
      result[item.status] += 1
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
        (status === "all" || item.status === status || touched.has(item.id)) &&
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
      setRunResult({ text: result.created ? `${result.created} карт нэмэгдлээ.` : "Шинэ карт нэмэгдсэнгүй.", problem: "" })
    } catch (failure) {
      setRunResult({ text: "Мэдээ татаж чадсангүй. Дэлгэрэнгүйг харна уу.", problem: failure instanceof Error ? failure.message : String(failure) })
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
      setFailed((map) => new Map(map).set(id, failure instanceof Error ? failure.message : "Алдаа гарлаа"))
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
      title: "Энэ картыг устгах уу?",
      message: `“${item.title}” карт самбараас бүр мөсөн устна. Мэдээ нь «Хаасан» руу орж, агент дахин карт болгохгүй.`,
      confirmLabel: "Устгах",
      destructive: true,
    })
    if (!ok) return
    await act(item.id, async () => {
      await backend.deleteNewsCard(item.id)
      patch(item.id, { status: "dismissed", articleId: null })
    })
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
        <p className="text-muted-foreground font-mono text-[11px] uppercase">Мэдээний агент</p>
        <h1 className="font-news mt-1 text-3xl">Мэдээний урсгал</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-[13px]">
          Агентын уншсан бүх мэдээ (сүүлийн 14 хоног). Хамгийн чухлыг нь агент өглөө бүр карт болгодог. Бусдаас нь хүссэнээ
          <strong className="text-foreground"> Карт болгох</strong>-оор самбарт нэмж засна, хэрэггүйг нь хаана.
        </p>
        </div>
        {isEditor(member) ? (
          <button type="button" disabled={running} onClick={runAgent} className={buttonClass.primary}>
            <RefreshCw className={cn("size-4", running && "animate-spin")} />
            {running ? "Татаж байна…" : "Одоо татах"}
          </button>
        ) : null}
      </header>

      <div className="bg-card rounded-xl border px-4 py-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground">
            {runResult?.text ??
              (runs[0]
                ? `Сүүлд ажилласан: ${runs[0].trigger === "cron" ? "автомат" : "гараар"} · ${runs[0].details?.fresh ?? runs[0].scanned} мэдээ уншсан · ${runs[0].created} карт`
                : "Агент одоогоор ажиллаагүй байна. Өдөр бүр 08:00-д автоматаар ажиллана.")}
          </span>
          <button type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)} className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-[12px]">
            <ChevronDown className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")} />
            Дэлгэрэнгүй
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
        <Tabs label="Төлөв" value={status} onChange={(key) => refilter(() => setStatus(key))} options={statusTabs.map((tab) => ({ ...tab, count: items ? counts[tab.key] : undefined }))} />
        <Tabs label="Бүс" value={desk} onChange={(key) => refilter(() => setDesk(key))} options={deskTabs} />
        <Tabs
          label="Эрэмбэ"
          value={byScore ? "score" : "time"}
          onChange={(key) => setByScore(key === "score")}
          options={[
            { key: "score", label: "Чухал нь эхэнд" },
            { key: "time", label: "Шинэ нь эхэнд" },
          ]}
        />
      </div>

      {items ? (
        <div role="tablist" aria-label="Сэдэв" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[{ key: "all", label: "Бүх сэдэв", count: categoryCounts.all }, ...NEWS_CATEGORIES.map((entry) => ({ key: entry.key, label: entry.label, count: categoryCounts.byKey.get(entry.key) ?? 0 }))]
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
        <span className="sr-only">Хайх</span>
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(event) => refilter(() => setQuery(event.target.value))}
          placeholder="Гарчиг, эх сурвалжаар хайх"
          className={`${inputClass} pl-9`}
        />
      </label>

      {!items ? (
        <p className="text-muted-foreground text-[14px]">Ачаалж байна…</p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground text-[14px]">
          {items.length ? "Илэрц алга." : "Одоогоор мэдээ алга. Агент ажилласны дараа энд гарна (Самбар → Одоо татах)."}
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
                          Карт нээх
                          <ArrowRight className="size-4" />
                        </Link>
                        {isEditor(member) ? (
                          <button type="button" disabled={working} onClick={() => removeCard(item)} className={buttonClass.danger}>
                            <Trash2 className="size-4" />
                            {working ? "Устгаж байна…" : "Устгах"}
                          </button>
                        ) : null}
                      </>
                    ) : item.status === "dismissed" ? (
                      <button type="button" disabled={working} onClick={() => dismiss(item, false)} className={buttonClass.ghost}>
                        <Undo2 className="size-4" />
                        Буцаах
                      </button>
                    ) : (
                      <>
                        <button type="button" disabled={working} onClick={() => file(item)} className={buttonClass.primary}>
                          <FilePlus2 className="size-4" />
                          {working ? "Бэлдэж байна…" : "Карт болгох"}
                        </button>
                        {working ? <span className="text-muted-foreground text-[12px]">Агент ноорог бичиж байна, 2 минут хүртэл үргэлжилнэ.</span> : null}
                        <button type="button" disabled={working} onClick={() => dismiss(item, true)} className={buttonClass.ghost}>
                          <X className="size-4" />
                          Хаах
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
          Цааш харах ({shown.length - limit})
        </button>
      ) : null}
    </div>
  )
}
