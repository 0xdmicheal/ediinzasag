import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowUpRight, Bot, Download, CalendarDays, ChevronDown, Eye, FilePlus2, Hand, Lock, Megaphone, PenLine, RefreshCw, Sparkles } from "lucide-react"
import { cn } from "cn"

import { BoardList, type BoardTab } from "@/admin/BoardList"
import { importBuiltins, pendingBuiltins } from "@/admin/import-builtin"
import { canClaim, canManageTeam, isEditor, isScheduled, timeAgo } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { Avatar, buttonClass, Notice, StatusPill } from "@/admin/ui"
import type { Article, NewsRun, Tag } from "@/admin/types"

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
      <Link to={`/edit/${article.id}`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors">
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
                    <Link to={`/edit/${article.id}`} className="font-news line-clamp-2 text-[15px] leading-snug hover:underline">
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
  const [agentOpen, setAgentOpen] = useState(readAgentOpen)
  const isAdmin = canManageTeam(member)
  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000)
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null)
  const [importResult, setImportResult] = useState<{ tone: "success" | "error"; text: string } | null>(null)

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
      navigate(`/edit/${article.id}`)
    } catch (failure) {
      setAgentResult({ text: failure instanceof Error ? failure.message : "Авч чадсангүй", problem: "" })
      setArticles(await backend.listArticles())
    }
  }

  const builtins = useMemo(
    () => (articles === null ? [] : pendingBuiltins(new Set(articles.map((article) => article.slug)))),
    [articles],
  )

  async function importSiteArticles() {
    const list = builtins
    setImporting({ done: 0, total: list.length })
    setImportResult(null)
    try {
      const done = await importBuiltins(backend, list, (count) => setImporting({ done: count, total: list.length }))
      setImportResult({ tone: "success", text: `${done} нийтлэл "Хянагдаж буй" баганад орлоо. Нийтэлсний дараа сайтад гарна.` })
    } catch (failure) {
      setImportResult({ tone: "error", text: failure instanceof Error ? failure.message : "Оруулж чадсангүй" })
    } finally {
      setImporting(null)
      setArticles(await backend.listArticles().catch(() => articles))
    }
  }

  const inbox = useMemo(() => (articles ?? []).filter(canClaim).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [articles])
  const agentTracked = useMemo(
    () => (articles ?? []).filter((article) => article.origin === "bot" && !canClaim(article)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [articles],
  )

  // Unclaimed agent briefings live in the agent inbox, not on the board.
  const boardArticles = useMemo(() => (articles === null ? null : articles.filter((article) => !canClaim(article))), [articles])
  const [, setParams] = useSearchParams()
  const showTab = (tab: BoardTab, extra: Record<string, string> = {}) => {
    setParams({ tab, ...extra })
    requestAnimationFrame(() => document.getElementById("board-list")?.scrollIntoView({ block: "start", behavior: "smooth" }))
  }

  // "Your turn": what needs this person's action right now.
  const yourTurn = (boardArticles ?? []).filter((article) =>
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
          <Link to="/new" className={buttonClass.primary}>
            <FilePlus2 className="size-4" />
            Шинэ нийтлэл
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Sparkles className="size-5" />} label="Таны ээлж" value={yourTurn.length} emphasis onClick={() => showTab("turn")} />
          <StatTile icon={<Eye className="size-5" />} label="Хянагдаж буй" value={inReview} onClick={() => showTab("in_review")} />
          <StatTile icon={<Megaphone className="size-5" />} label="7 хоногт нийтэлсэн" value={publishedThisWeek} onClick={() => showTab("published", { sort: "published" })} />
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
            <StatTile icon={<PenLine className="size-5" />} label="Миний ноорог" value={myDrafts} onClick={() => showTab("draft", { mine: "1" })} />
          )}
        </div>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div id="board-list" className="scroll-mt-4">
        <BoardList articles={boardArticles} tags={tags} member={member} />
      </div>

      {isAdmin ? (
        <section aria-label="Зөвхөн админ" className="flex flex-col gap-3 border-t pt-6">
          <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] uppercase">
            <Lock className="size-3" />
            Зөвхөн админ
          </p>
          {builtins.length > 0 || importing || importResult ? (
            <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">Сайтад суулгасан нийтлэлүүд</p>
                <p className="text-muted-foreground mt-0.5 text-[13px]">
                  {importing
                    ? `Оруулж байна… ${importing.done}/${importing.total}`
                    : builtins.length > 0
                      ? `${builtins.length} нийтлэл кодоос сайтад харагдаж байгаа ч админд алга. Хяналтад оруулаад нийтэлбэл админаас засах боломжтой болно.`
                      : "Бүх нийтлэл админд орсон."}
                </p>
              </div>
              {builtins.length > 0 ? (
                <button type="button" onClick={importSiteArticles} disabled={importing !== null} className={buttonClass.primary}>
                  <Download className="size-4" />
                  {importing ? "Оруулж байна…" : `${builtins.length} нийтлэлийг хяналтад оруулах`}
                </button>
              ) : null}
              {importResult ? (
                <div className="basis-full">
                  <Notice tone={importResult.tone}>{importResult.text}</Notice>
                </div>
              ) : null}
            </div>
          ) : null}
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
