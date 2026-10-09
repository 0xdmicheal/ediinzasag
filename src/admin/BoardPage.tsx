import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowUpRight, Bot, CalendarClock, CalendarDays, ChevronDown, Eye, FilePlus2, Hand, Lock, Megaphone, PenLine, RefreshCw, Search, Sparkles, Tag as TagIcon, UserRound } from "lucide-react"
import { cn } from "cn"

import { canClaim, canManageTeam, formatWhen, isEditor, isScheduled, readiness, statusMeta, statusOrder, timeAgo } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { Select } from "@/admin/Select"
import { Avatar, buttonClass, inputClass, Notice, StatusPill } from "@/admin/ui"
import type { Article, NewsRun, Status, Tag } from "@/admin/types"

/** Status dots: colour only where it carries meaning (needs work, approved), neutral otherwise. */
const statusColor: Record<Status, string> = {
  draft: "var(--chart-4)",
  in_review: "var(--brand)",
  changes_requested: "var(--down)",
  approved: "var(--up)",
  published: "var(--foreground)",
}

const weekdays = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"]

function mongolianDate(date = new Date()) {
  return `${date.getFullYear()} оны ${date.getMonth() + 1}-р сарын ${date.getDate()}, ${weekdays[date.getDay()]}`
}

function StatTile({ icon, label, value, emphasis, onClick }: { icon: ReactNode; label: string; value: number; emphasis?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-lg border">{icon}</span>
      <span className="min-w-0 text-left">
        <span className="font-news block text-2xl leading-none tabular-nums">{value}</span>
        <span className="text-muted-foreground mt-1 block truncate text-[12px]">{label}</span>
      </span>
    </>
  )
  const className = cn("bg-card flex items-center gap-3 rounded-xl border p-3", emphasis && value > 0 && "border-foreground/60")
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, "hover:border-foreground/30 transition-colors")}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}

const AGENT_OPEN_KEY = "ez-admin-agent-open"

function readAgentOpen() {
  try {
    return localStorage.getItem(AGENT_OPEN_KEY) === "1"
  } catch {
    return false
  }
}

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
      className="bg-card hover:border-foreground/25 group flex flex-col gap-2.5 rounded-lg border p-3.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors"
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
      {isScheduled(article) ? (
        <p className="bg-foreground/[0.06] inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium">
          <CalendarClock className="size-3.5" />
          Товлосон · {formatWhen(article.publishedAt!)}
        </p>
      ) : null}
      {article.status === "changes_requested" && article.reviewNote ? (
        <p className="line-clamp-2 rounded-md bg-[color-mix(in_oklch,var(--down)_10%,transparent)] px-2 py-1.5 text-[12px]">
          “{article.reviewNote}”
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {article.origin === "bot" ? (
            <span title="Агентын мэдээ" className="bg-foreground/[0.07] grid size-6 shrink-0 place-items-center rounded-full">
              <Bot className="size-3.5" />
            </span>
          ) : null}
          <Avatar name={article.authorName || "EZ"} size="sm" />
          <span className="text-muted-foreground truncate text-[12px]">{timeAgo(article.updatedAt)}</span>
        </span>
        <ReadinessRing article={article} />
      </div>
    </Link>
  )
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www[.]/, "")
  } catch {
    return ""
  }
}

/** Why a run added nothing, in plain words (shown only under "Дэлгэрэнгүй"). */
function runReason(run: NewsRun) {
  const d = run.details ?? {}
  if (run.created) return ""
  if (run.error) return "Ажиллагаа дутуу дууссан."
  if (d.feeds_total !== undefined && d.feeds_ok === 0) return "Эх сурвалжуудыг уншиж чадсангүй."
  if (d.fresh === 0) return "Сүүлийн 1–3 хоногт шинэ мэдээ гараагүй."
  if (d.new === 0) return "Шинэ мэдээ бүгд самбарт аль хэдийн байна."
  return "Энэ удаад тохирох мэдээ олдсонгүй."
}

/** The last run in detail, for whoever wants to look: numbers, picks, and any problems. */
function RunDetailsView({ run, problem }: { run: NewsRun | undefined; problem: string }) {
  if (!run && !problem) return <p className="text-muted-foreground text-[12px]">Агент одоогоор ажиллаагүй байна.</p>
  const d = run?.details ?? {}
  const problems = [problem, run?.error ?? "", ...(d.failures ?? []), ...(d.feeds_failed?.length ? [`Уншигдаагүй: ${d.feeds_failed.join(", ")}`] : [])].filter(
    (line, index, all) => line && all.indexOf(line) === index,
  )
  const stats = [
    ["Эх сурвалж", d.feeds_total !== undefined ? `${d.feeds_ok}/${d.feeds_total}` : "–"],
    ["Уншсан мэдээ", d.fresh ?? run?.scanned ?? 0],
    ["Сонгосон", d.picked?.length ?? 0],
    ["Нэмсэн", run?.created ?? 0],
  ] as const
  return (
    <div className="space-y-3 text-[12px]">
      {run ? (
        <p className="text-muted-foreground">
          Сүүлд {timeAgo(run.startedAt)} · {run.trigger === "cron" ? "автомат" : "гараар"}
          {d.provider ? ` · ${d.provider}` : ""}
          {runReason(run) ? ` · ${runReason(run)}` : ""}
        </p>
      ) : null}
      <dl className="grid grid-cols-4 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-muted/60 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-news mt-0.5 text-[15px] tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {d.picked?.length ? (
        <div>
          <p className="font-medium">Сонгосон мэдээ</p>
          <ul className="text-muted-foreground mt-1 space-y-0.5">
            {d.picked.map((pick) => (
              <li key={pick.title}>
                {pick.title} <span className="opacity-70">· {pick.source}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {problems.length ? (
        <div>
          <p className="font-medium">Асуудал</p>
          <ul className="text-muted-foreground mt-1 space-y-0.5">
            {problems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Admin-only: agent briefings waiting for someone to take them. Collapsed to
 * one line by default (remembered per browser); opened, it shows just the
 * stories. Run numbers and problems stay behind "Дэлгэрэнгүй".
 */
type AgentTab = "new" | "working" | "published"

const agentTabs: { id: AgentTab; label: string; empty: string }[] = [
  { id: "new", label: "Шинэ", empty: "Одоогоор шинэ мэдээ алга." },
  { id: "working", label: "Засварлаж буй", empty: "Засварлаж буй мэдээ алга." },
  { id: "published", label: "Нийтлэгдсэн", empty: "Агентын мэдээнээс нийтлэгдсэн зүйл алга." },
]

/** One agent story that someone has taken: who has it and where it stands. */
function TrackedRow({ article }: { article: Article }) {
  return (
    <li>
      <Link to={`/admin/edit/${article.id}`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors">
        <span className="min-w-0 flex-1">
          <span className="font-news line-clamp-1 text-[14px]">{article.title || "Гарчиггүй"}</span>
          <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[12px]">
            <Avatar name={article.authorName || "EZ"} size="sm" />
            {article.authorName || "Гишүүн"} · {timeAgo(article.updatedAt)}
            {article.sourceUrl ? ` · ${hostOf(article.sourceUrl)}` : ""}
          </span>
        </span>
        <StatusPill status={article.status} />
      </Link>
    </li>
  )
}

function AgentInbox({
  items,
  tracked,
  runs,
  running,
  open,
  result,
  onToggle,
  onRun,
  onClaim,
}: {
  items: Article[]
  /** Agent stories someone has claimed, in progress or published. */
  tracked: Article[]
  runs: NewsRun[]
  running: boolean
  open: boolean
  result: { text: string; problem: string } | null
  onToggle: () => void
  onRun: () => void
  onClaim: (article: Article) => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [tab, setTab] = useState<AgentTab>("new")
  const working = tracked.filter((article) => article.status !== "published")
  const published = tracked.filter((article) => article.status === "published")
  const counts: Record<AgentTab, number> = { new: items.length, working: working.length, published: published.length }
  const rows = tab === "working" ? working : published
  return (
    <section id="agent-inbox" aria-labelledby="agent-inbox-title" className="bg-card scroll-mt-6 rounded-xl border">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="agent-inbox-body"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="bg-foreground text-background grid size-8 shrink-0 place-items-center rounded-lg">
            <Bot className="size-4" />
          </span>
          <span id="agent-inbox-title" className="text-[14px] font-semibold">
            Агентын мэдээ
          </span>
          {items.length > 0 ? (
            <span className="bg-foreground/[0.07] rounded-full px-2 py-0.5 text-[12px] font-medium">{items.length} шинэ</span>
          ) : null}
          <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        <button type="button" disabled={running} onClick={onRun} className={cn(buttonClass.ghost, "h-8 px-3 text-[12px]")}>
          <RefreshCw className={cn("size-3.5", running && "animate-spin")} />
          {running ? "Татаж байна…" : "Одоо татах"}
        </button>
      </header>

      {open ? (
        <div id="agent-inbox-body" className="border-t px-4 py-4">
          {result ? <p className="text-muted-foreground mb-3 text-[13px]">{result.text}</p> : null}

          <div
            role="tablist"
            aria-label="Агентын мэдээ"
            className="bg-muted mb-4 inline-flex rounded-full p-1"
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
              const order = agentTabs.map((item) => item.id)
              const step = event.key === "ArrowRight" ? 1 : -1
              const next = order[(order.indexOf(tab) + step + order.length) % order.length]
              setTab(next)
              event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus()
            }}
          >
            {agentTabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                data-tab={id}
                aria-selected={tab === id}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                className={cn(
                  "h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                  tab === id ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label} <span className="text-muted-foreground font-mono text-[11px]">{counts[id]}</span>
              </button>
            ))}
          </div>

          {tab !== "new" ? (
            rows.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-[13px]">{agentTabs.find((item) => item.id === tab)!.empty}</p>
            ) : (
              <ul className="-mx-2 divide-y">
                {rows.map((article) => (
                  <TrackedRow key={article.id} article={article} />
                ))}
              </ul>
            )
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-[13px]">Одоогоор шинэ мэдээ алга.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((article) => (
                <li key={article.id} className="flex flex-col overflow-hidden rounded-lg border">
                  {article.coverUrl ? <img src={article.coverUrl} alt="" className="aspect-[16/7] w-full object-cover" /> : null}
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    <Link to={`/admin/edit/${article.id}`} className="font-news line-clamp-2 text-[15px] leading-snug hover:underline">
                      {article.title || "Гарчиггүй"}
                    </Link>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      {article.sourceUrl ? (
                        <a
                          href={article.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-0.5 truncate text-[12px]"
                        >
                          {hostOf(article.sourceUrl)}
                          <ArrowUpRight className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <span />
                      )}
                      <button type="button" onClick={() => onClaim(article)} className={cn(buttonClass.primary, "h-8 px-3 text-[12px]")}>
                        <Hand className="size-3.5" />
                        Би засна
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t pt-3">
            <button
              type="button"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((value) => !value)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[12px]"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")} />
              Дэлгэрэнгүй
            </button>
            {detailsOpen ? (
              <div className="mt-3">
                <RunDetailsView run={runs[0]} problem={result?.problem ?? ""} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function BoardPage() {
  const { backend, member } = useTeam()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [runs, setRuns] = useState<NewsRun[]>([])
  const [running, setRunning] = useState(false)
  const [agentResult, setAgentResult] = useState<{ text: string; problem: string } | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [tagFilter, setTagFilter] = useState("")
  const [mine, setMine] = useState(false)
  const [agentOpen, setAgentOpen] = useState(readAgentOpen)
  const isAdmin = canManageTeam(member)
  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000)

  useEffect(() => {
    Promise.all([backend.listArticles(), backend.listTags()])
      .then(([list, tagList]) => {
        setArticles(list)
        setTags(tagList)
      })
      .catch((failure: Error) => setError(failure.message))
    // Databases set up before the news agent have no news_runs table; the board works without it.
    backend.listNewsRuns().then(setRuns, () => setRuns([]))
  }, [backend])

  function toggleAgent(next = !agentOpen) {
    setAgentOpen(next)
    try {
      localStorage.setItem(AGENT_OPEN_KEY, next ? "1" : "0")
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  }

  async function runAgent() {
    toggleAgent(true)
    setRunning(true)
    setAgentResult(null)
    try {
      const result = await backend.runNewsAgent()
      const [list, nextRuns] = await Promise.all([backend.listArticles(), backend.listNewsRuns()])
      setArticles(list)
      setRuns(nextRuns)
      setAgentResult({ text: result.created ? `${result.created} шинэ мэдээ нэмэгдлээ.` : "Шинэ мэдээ олдсонгүй.", problem: "" })
    } catch (failure) {
      setAgentResult({
        text: "Мэдээ татаж чадсангүй. Дэлгэрэнгүйг доороос харна уу.",
        problem: failure instanceof Error ? failure.message : String(failure),
      })
    } finally {
      setRunning(false)
    }
  }

  async function claim(article: Article) {
    try {
      await backend.claimArticle(article.id)
      navigate(`/admin/edit/${article.id}`)
    } catch (failure) {
      setAgentResult({ text: failure instanceof Error ? failure.message : "Авч чадсангүй", problem: "" })
      setArticles(await backend.listArticles())
    }
  }

  const inbox = useMemo(() => (articles ?? []).filter(canClaim).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [articles])
  const agentTracked = useMemo(
    () => (articles ?? []).filter((article) => article.origin === "bot" && !canClaim(article)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [articles],
  )

  const tagLabels = useMemo(() => new Map(tags.map((tag) => [tag.slug, tag.label])), [tags])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (articles ?? []).filter(
      (article) =>
        !canClaim(article) &&
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

  const publishedThisWeek = (articles ?? []).filter(
    (article) => article.status === "published" && article.publishedAt && Date.parse(article.publishedAt) > weekAgo && !isScheduled(article),
  ).length
  const inReview = (articles ?? []).filter((article) => article.status === "in_review" && !canClaim(article)).length
  const myDrafts = (articles ?? []).filter((article) => article.authorId === member.id && article.status === "draft").length

  return (
    <div className="flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
              <CalendarDays className="size-3.5" />
              {mongolianDate()}
            </p>
            <h1 className="font-news mt-2 text-3xl sm:text-[2.25rem]">Сайн байна уу, {member.name.split(" ")[0]}</h1>
            <p className="text-muted-foreground mt-1 text-[14px]">
              {articles === null
                ? "Ачаалж байна…"
                : yourTurn.length > 0
                  ? isEditor(member)
                    ? `${yourTurn.length} нийтлэл таны шийдвэрийг хүлээж байна.`
                    : `${yourTurn.length} нийтлэлд засвар хүссэн байна.`
                  : "Таны ээлжинд хүлээгдэж буй зүйл алга. Шинэ нийтлэл эхлүүлэх үү?"}
            </p>
          </div>
          <Link to="/admin/new" className={buttonClass.primary}>
            <FilePlus2 className="size-4" />
            Шинэ нийтлэл
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Sparkles className="size-5" />} label="Таны ээлж" value={yourTurn.length} emphasis />
          <StatTile icon={<Eye className="size-5" />} label="Хянагдаж буй" value={inReview} />
          <StatTile icon={<Megaphone className="size-5" />} label="7 хоногт нийтэлсэн" value={publishedThisWeek} />
          {isAdmin ? (
            <StatTile
              icon={<Bot className="size-5" />}
              label="Агентын мэдээ"
              value={inbox.length}
              onClick={() => {
                toggleAgent(true)
                requestAnimationFrame(() => document.getElementById("agent-inbox")?.scrollIntoView({ block: "start" }))
              }}
            />
          ) : (
            <StatTile icon={<PenLine className="size-5" />} label="Миний ноорог" value={myDrafts} />
          )}
        </div>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section aria-label="Нийтлэлүүд" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
            <span className="sr-only">Хайх</span>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
            <input
              id="board-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Гарчиг, зохиогчоор хайх…"
              className={cn(inputClass, "h-9 rounded-lg py-0 pl-9 text-[13px]")}
            />
          </label>
          <Select
            label="Шошгоор шүүх"
            value={tagFilter}
            onChange={setTagFilter}
            icon={<TagIcon className="size-3.5" />}
            className="w-48"
            options={[{ value: "", label: "Бүх шошго" }, ...tags.map((tag) => ({ value: tag.slug, label: `#${tag.label}` }))]}
          />
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => setMine((value) => !value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
              mine ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/25",
            )}
          >
            <UserRound className="size-3.5" />
            Миний нийтлэл
          </button>
          {query || tagFilter || mine ? (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setTagFilter("")
                setMine(false)
              }}
              className="text-muted-foreground hover:text-foreground h-9 px-1 text-[13px] underline-offset-4 hover:underline"
            >
              Цэвэрлэх
            </button>
          ) : null}
        </div>

        {/* Columns scroll sideways on narrow screens. */}
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="grid min-w-[68rem] grid-cols-5 gap-4">
            {statusOrder.map((status) => {
              const column = byStatus(status)
              return (
                <section key={status} aria-label={statusMeta[status].label} className="bg-muted/50 flex flex-col gap-2 rounded-xl border p-2.5">
                  <header className="flex items-center justify-between px-1 pt-1">
                    <span className="flex items-center gap-2 text-[13px] font-semibold">
                      <span className="size-2 rounded-full" style={{ backgroundColor: statusColor[status] }} aria-hidden />
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
      </section>

      {isAdmin ? (
        <section aria-label="Зөвхөн админ" className="flex flex-col gap-3 border-t pt-6">
          <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] uppercase">
            <Lock className="size-3" />
            Зөвхөн админ
          </p>
          <AgentInbox
            items={inbox}
            tracked={agentTracked}
            runs={runs}
            running={running}
            open={agentOpen}
            result={agentResult}
            onToggle={() => toggleAgent()}
            onRun={runAgent}
            onClaim={claim}
          />
        </section>
      ) : null}
    </div>
  )
}
