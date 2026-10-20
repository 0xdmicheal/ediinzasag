import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Download,
  Eye,
  FilePlus2,
  Globe,
  Lock,
  PenLine,
  Search,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react"
import { cn } from "cn"

import { Folder } from "@/admin/Folder"
import { importBuiltins, pendingBuiltins } from "@/admin/import-builtin"
import { canClaim, canManageTeam, formatWhen, isEditor, isScheduled, statusMeta, timeAgo, wordCount } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { Avatar, Notice } from "@/admin/ui"
import type { Article, Member, Tag } from "@/admin/types"
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
import { publicUrl } from "@/lib/public-url"

/*
 * Stories: the team's own work, in the same shape as News (a bar on top, Filter, folders
 * beside a grid of cards), but the folders are the workflow, not topics, and each takes its
 * status colour. Folder, desk, author and search live in the URL, so back from the editor
 * lands on the same view. Unclaimed agent cards stay on News until someone takes them.
 */

type FolderKey = "todo" | "drafts" | "review" | "scheduled" | "published" | "all"
type Desk = "all" | "mongolia" | "world"

const PAGE = 36

const FOLDERS: { key: FolderKey; label: string; tone?: string; holds: (article: Article, member: Member) => boolean; empty: string }[] = [
  {
    key: "todo",
    label: "To do",
    tone: "var(--foreground)",
    holds: (article, member) =>
      (article.authorId === member.id && (article.status === "draft" || article.status === "changes_requested")) ||
      (isEditor(member) && (article.status === "in_review" || article.status === "approved")),
    empty: "Nothing waiting on you. Start a new story or pick one from News.",
  },
  { key: "drafts", label: "Drafts", holds: (article) => article.status === "draft" || article.status === "changes_requested", empty: "No drafts." },
  {
    key: "review",
    label: "In review",
    tone: "var(--state-review)",
    holds: (article) => article.status === "in_review" || article.status === "approved",
    empty: "Nothing in review.",
  },
  { key: "scheduled", label: "Scheduled", tone: "var(--state-scheduled)", holds: (article) => isScheduled(article), empty: "Nothing scheduled." },
  {
    key: "published",
    label: "Published",
    tone: "var(--state-approved)",
    holds: (article) => article.status === "published" && !isScheduled(article),
    empty: "Nothing published yet.",
  },
  { key: "all", label: "All stories", holds: () => true, empty: "No stories yet." },
]

/** Status as an icon and a word, coloured only where it asks for something. */
function StatusText({ article }: { article: Article }) {
  const scheduled = isScheduled(article)
  const { label, className, Icon } = scheduled
    ? { label: `Scheduled · ${formatWhen(article.publishedAt!)}`, className: "text-[var(--state-scheduled)]", Icon: CalendarClock }
    : {
        draft: { label: statusMeta.draft.label, className: "text-muted-foreground", Icon: CircleDashed },
        in_review: { label: statusMeta.in_review.label, className: "text-[var(--state-review)]", Icon: Eye },
        changes_requested: { label: "Changes requested", className: "text-[var(--state-changes)]", Icon: TriangleAlert },
        approved: { label: statusMeta.approved.label, className: "text-[var(--state-approved)]", Icon: CheckCircle2 },
        published: { label: statusMeta.published.label, className: "text-muted-foreground", Icon: Globe },
      }[article.status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap", className)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  )
}

/** No cover yet: a dark EZ panel with the logo, so the card still looks finished. */
function DefaultCover() {
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[#16181c]">
      <div className="absolute -right-12 -bottom-16 size-32 rounded-full border-4 border-white/10" aria-hidden />
      <img src={publicUrl("brand/logo-white.png")} alt="" className="relative h-6 w-auto opacity-80" />
    </div>
  )
}

/** What a card says to do, in one word. */
function action(article: Article, member: Member) {
  if (isEditor(member) && article.status === "in_review") return "Review"
  if (isEditor(member) && article.status === "approved") return "Publish"
  if ((article.status === "draft" || article.status === "changes_requested") && (isEditor(member) || article.authorId === member.id)) return "Edit"
  return "Open"
}

const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

export function BoardPage() {
  const { backend, member } = useTeam()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [error, setError] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const isAdmin = canManageTeam(member)
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null)
  const [importResult, setImportResult] = useState<{ tone: "success" | "error"; text: string } | null>(null)

  const folder = FOLDERS.find((entry) => entry.key === params.get("folder")) ?? FOLDERS[0]
  const desk = (["mongolia", "world"].includes(params.get("desk") ?? "") ? params.get("desk") : "all") as Desk
  const mineOnly = params.get("mine") === "1"
  const query = params.get("q") ?? ""

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value === null || value === "") next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
    setLimit(PAGE)
  }

  useEffect(() => {
    Promise.all([backend.listArticles(), backend.listTags()])
      .then(([list, tagList]) => {
        setArticles(list)
        setTags(tagList)
      })
      .catch((failure: Error) => setError(failure.message))
  }, [backend])

  const tagLabel = useMemo(() => new Map(tags.map((tag) => [tag.slug, tag.label])), [tags])
  /** Stories under the desk and author filters: what the folders count. */
  const pool = useMemo(
    () =>
      (articles ?? [])
        .filter((article) => !canClaim(article))
        .filter((article) => desk === "all" || article.desk === desk)
        .filter((article) => !mineOnly || article.authorId === member.id),
    [articles, desk, mineOnly, member],
  )
  const counts = useMemo(() => new Map(FOLDERS.map((entry) => [entry.key, pool.filter((article) => entry.holds(article, member)).length])), [pool, member])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const time = (article: Article) => Date.parse(folder.key === "published" ? (article.publishedAt ?? article.updatedAt) : article.updatedAt)
    return pool
      .filter((article) => folder.holds(article, member))
      .filter((article) => !needle || article.title.toLowerCase().includes(needle) || article.authorName.toLowerCase().includes(needle))
      .sort((a, b) => time(b) - time(a))
  }, [pool, folder, member, query])

  const builtins = useMemo(() => (articles === null ? [] : pendingBuiltins(new Set(articles.map((article) => article.slug)))), [articles])

  async function importSiteArticles() {
    const list = builtins
    setImporting({ done: 0, total: list.length })
    setImportResult(null)
    try {
      const done = await importBuiltins(backend, list, (count) => setImporting({ done: count, total: list.length }))
      setImportResult({ tone: "success", text: `${done} stories moved to In review. They show on the site once published.` })
    } catch (failure) {
      setImportResult({ tone: "error", text: failure instanceof Error ? failure.message : "Import failed" })
    } finally {
      setImporting(null)
      setArticles(await backend.listArticles().catch(() => articles))
    }
  }

  const todo = counts.get("todo") ?? 0
  const filtered = desk !== "all" || mineOnly
  const filterLabel = [desk === "mongolia" ? "Mongolia" : desk === "world" ? "World" : null, mineOnly ? "Mine" : null].filter(Boolean).join(" · ")
  const tally = [
    { label: "To do", value: todo },
    { label: "In review", value: counts.get("review") ?? 0 },
    { label: "Scheduled", value: counts.get("scheduled") ?? 0 },
    { label: "Published", value: counts.get("published") ?? 0 },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 px-8 py-10 lg:px-12 xl:px-16">
      {/* Where the work stands, and «New story». News has the agent here. */}
      <section aria-label="Your work" className="bg-card rounded-2xl border px-7 py-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <span className="bg-foreground text-background grid size-12 shrink-0 place-items-center rounded-xl">
            <PenLine className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">Stories</p>
            <p className="text-muted-foreground mt-1 text-[13px]">
              {today()} · {articles === null ? "Loading…" : todo > 0 ? `${todo} ${todo === 1 ? "story needs" : "stories need"} you` : "You're all caught up"}
            </p>
          </div>
          <dl className="flex gap-8">
            {tally.map((item) => (
              <div key={item.label} className="text-right">
                <dt className="text-muted-foreground text-[12px]">{item.label}</dt>
                <dd className="text-[15px] font-medium tabular-nums">{articles === null ? "–" : item.value}</dd>
              </div>
            ))}
          </dl>
          <Button asChild className="h-9 gap-1.5 px-4">
            <Link to="/new">
              <FilePlus2 />
              New story
            </Link>
          </Button>
        </div>
      </section>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="-mb-2 flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 gap-1.5 px-3.5 shadow-xs">
              {filtered ? filterLabel : "Filter"}
              <SlidersHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Desk</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={desk} onValueChange={(value) => setParam("desk", value === "all" ? null : value)}>
              <DropdownMenuRadioItem value="all">All desks</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="mongolia">Mongolia</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="world">World</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Author</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={mineOnly ? "mine" : "all"} onValueChange={(value) => setParam("mine", value === "mine" ? "1" : null)}>
              <DropdownMenuRadioItem value="all">Everyone</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="mine">Only mine</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-card flex min-h-[calc(100svh-17rem)] gap-6 rounded-2xl border p-5">
        <div role="tablist" aria-label="Folders" aria-orientation="vertical" className="flex w-[124px] shrink-0 flex-col gap-2 pt-1">
          {FOLDERS.map((entry) => (
            <div key={entry.key} className="relative">
              <Folder
                label={entry.label}
                tone={entry.tone}
                count={articles ? counts.get(entry.key) : undefined}
                open={entry.key === folder.key}
                onClick={() => setParam("folder", entry.key === FOLDERS[0].key ? null : entry.key)}
              />
              {entry.key === folder.key ? (
                <ArrowRight className="text-muted-foreground absolute top-1/2 -right-5 size-4 -translate-y-1/2" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>

        <section aria-label={folder.label} className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-6 py-5">
            <h1 className="ez-title text-[1.75rem] leading-none">{folder.label}</h1>
            <span className="text-muted-foreground text-[13px] tabular-nums">
              {articles ? `${shown.length} ${shown.length === 1 ? "story" : "stories"}` : "Loading…"}
            </span>
            <label className="bg-secondary ml-auto flex h-9 w-64 max-w-full items-center gap-2 rounded-lg px-3">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <span className="sr-only">Search this folder</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setParam("q", event.target.value)}
                placeholder="Search by headline or author"
                className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
            </label>
          </header>

          {articles === null ? (
            <p className="text-muted-foreground p-8 text-[14px]">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground p-8 text-[14px]">{filtered || query ? "No stories match." : folder.empty}</p>
          ) : (
            <ul className="grid gap-5 p-6 md:grid-cols-2 2xl:grid-cols-3">
              {shown.slice(0, limit).map((article) => {
                const firstTag = article.tags[0] ? (tagLabel.get(article.tags[0]) ?? article.tags[0]) : ""
                const words = wordCount(article.body)
                const verb = action(article, member)
                return (
                  <li key={article.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/edit/${article.id}`)}
                      className="bg-card hover:border-foreground/25 group flex h-full w-full flex-col overflow-hidden rounded-xl border text-left transition-colors"
                    >
                      <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
                        {article.coverUrl ? (
                          <img
                            src={article.coverUrl}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => (event.currentTarget.style.display = "none")}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <DefaultCover />
                        )}
                        <span className="bg-background/90 absolute top-3 left-3 rounded-md px-2 py-1 shadow-xs backdrop-blur">
                          <StatusText article={article} />
                        </span>
                      </div>
                      <div className="flex w-full flex-1 flex-col p-5">
                        <p className="text-muted-foreground flex items-center gap-1.5 truncate text-[12px]">
                          {article.origin === "bot" ? <Bot className="size-3.5 shrink-0" aria-label="From the news agent" /> : null}
                          {article.desk === "mongolia" ? "Mongolia" : "World"}
                          {firstTag ? <> · #{firstTag}</> : null}
                          <> · {words.toLocaleString("en")} {words === 1 ? "word" : "words"}</>
                        </p>
                        <p className="mt-2 line-clamp-3 text-[15px] leading-snug font-medium">{article.title || "Untitled draft"}</p>
                        {article.status === "changes_requested" && article.reviewNote ? (
                          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[var(--state-changes)]">“{article.reviewNote}”</p>
                        ) : article.dek ? (
                          <p className="text-muted-foreground mt-2 line-clamp-2 text-[13px] leading-relaxed">{article.dek}</p>
                        ) : null}
                        <div className="mt-auto flex items-center gap-2 pt-5">
                          <Avatar name={article.authorName || "Agent"} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-[12px]">
                            {article.authorName || "Agent"}
                            <span className="text-muted-foreground">
                              {" "}
                              · {timeAgo(article.updatedAt)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-[12px] font-medium",
                              verb === "Open" ? "border" : "bg-primary text-primary-foreground",
                            )}
                          >
                            {verb}
                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {shown.length > limit ? (
            <Button variant="outline" onClick={() => setLimit((value) => value + PAGE)} className="mb-6 h-9 self-center px-4">
              Show more ({shown.length - limit})
            </Button>
          ) : null}
        </section>
      </div>

      {isAdmin && (builtins.length > 0 || importing || importResult) ? (
        <section aria-label="Admin only" className="flex flex-col gap-3 border-t pt-6">
          <p className="text-muted-foreground flex items-center gap-1.5 text-[12px]">
            <Lock className="size-3" />
            Admin only
          </p>
          <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
            <div className="min-w-0">
              <p className="text-[14px] font-medium">Stories built into the site</p>
              <p className="text-muted-foreground mt-0.5 text-[13px]">
                {importing
                  ? `Importing… ${importing.done}/${importing.total}`
                  : builtins.length > 0
                    ? `${builtins.length} stories are on the site from code but not in the admin. Import them to edit them here.`
                    : "Every story is in the admin."}
              </p>
            </div>
            {builtins.length > 0 ? (
              <Button onClick={importSiteArticles} disabled={importing !== null} className="h-9 gap-1.5 px-4">
                <Download />
                {importing ? "Importing…" : `Import ${builtins.length} stories`}
              </Button>
            ) : null}
            {importResult ? (
              <div className="basis-full">
                <Notice tone={importResult.tone}>{importResult.text}</Notice>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
