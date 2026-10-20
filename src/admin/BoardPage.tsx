import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Download,
  Eye,
  FilePlus2,
  Globe,
  ListTodo,
  Lock,
  PenLine,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react"
import { cn } from "cn"

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/*
 * Dashboard, after Watermelon UI's Tallie: four metric cards that are also the views
 * (to do, drafts, in review, published) and one table of stories. View, desk and
 * "mine" live in the URL, so back from the editor lands on the same list.
 * Unclaimed agent cards stay in the Inbox until someone takes them.
 */

type View = "todo" | "drafts" | "review" | "published"
type Desk = "all" | "mongolia" | "world"

const PAGE = 40

function inView(article: Article, view: View, member: Member) {
  const mine = article.authorId === member.id
  switch (view) {
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

const views: { key: View; label: string; icon: typeof ListTodo; caption: (member: Member) => string; empty: string }[] = [
  {
    key: "todo",
    label: "To do",
    icon: ListTodo,
    caption: (member) => (isEditor(member) ? "Your drafts and stories waiting for review" : "Your drafts and stories sent back with notes"),
    empty: "Nothing waiting on you. Start a new story or pick one from News.",
  },
  { key: "drafts", label: "Drafts", icon: PenLine, caption: () => "Being written or revised", empty: "No drafts." },
  {
    key: "review",
    label: "In review",
    icon: Eye,
    caption: (member) => (isEditor(member) ? "Waiting for review, approved or scheduled" : "With an editor, approved or scheduled"),
    empty: "Nothing in review.",
  },
  { key: "published", label: "Published", icon: Globe, caption: () => "Live on ediinzasag.mn", empty: "Nothing published yet." },
]

/** Status as Tallie shows it: an icon and a word, coloured only where it asks for something. */
function StatusCell({ article }: { article: Article }) {
  const scheduled = isScheduled(article)
  const { label, className, Icon } = scheduled
    ? { label: "Scheduled", className: "text-[var(--state-scheduled)]", Icon: CalendarClock }
    : {
        draft: { label: statusMeta.draft.label, className: "text-muted-foreground", Icon: CircleDashed },
        in_review: { label: statusMeta.in_review.label, className: "text-[var(--state-review)]", Icon: Eye },
        changes_requested: { label: "Changes", className: "text-[var(--state-changes)]", Icon: TriangleAlert },
        approved: { label: statusMeta.approved.label, className: "text-[var(--state-approved)]", Icon: CheckCircle2 },
        published: { label: statusMeta.published.label, className: "text-muted-foreground", Icon: Globe },
      }[article.status]
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-[13px] font-medium whitespace-nowrap", className)}
      title={scheduled ? formatWhen(article.publishedAt!) : undefined}
    >
      <Icon className="size-4" />
      {label}
    </span>
  )
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

  const view = (["todo", "drafts", "review", "published"].includes(params.get("view") ?? "") ? params.get("view") : "todo") as View
  const desk = (["mongolia", "world"].includes(params.get("desk") ?? "") ? params.get("desk") : "all") as Desk
  const mineOnly = params.get("mine") === "1"

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
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
  const board = useMemo(() => (articles === null ? null : articles.filter((article) => !canClaim(article))), [articles])
  const counts = useMemo(() => {
    const result = { todo: 0, drafts: 0, review: 0, published: 0 } as Record<View, number>
    for (const article of board ?? []) for (const item of views) if (inView(article, item.key, member)) result[item.key] += 1
    return result
  }, [board, member])

  const rows = useMemo(() => {
    const time = (article: Article) => Date.parse(view === "published" ? (article.publishedAt ?? article.updatedAt) : article.updatedAt)
    return (board ?? [])
      .filter((article) => inView(article, view, member))
      .filter((article) => desk === "all" || article.desk === desk)
      .filter((article) => !mineOnly || article.authorId === member.id)
      .sort((a, b) => time(b) - time(a))
  }, [board, view, desk, mineOnly, member])

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

  const current = views.find((item) => item.key === view)!
  const filtered = desk !== "all" || mineOnly
  const filterLabel = [desk === "mongolia" ? "Mongolia" : desk === "world" ? "World" : null, mineOnly ? "Mine" : null].filter(Boolean).join(" · ")

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-10 px-8 py-10 lg:px-12 xl:px-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="ez-title text-[2.5rem] leading-tight">Stories</h1>
          <p className="text-muted-foreground text-[15px]">
            {today()} ·{" "}
            {articles === null
              ? "Loading…"
              : counts.todo > 0
                ? `${counts.todo} ${counts.todo === 1 ? "story needs" : "stories need"} you`
                : "You're all caught up"}
          </p>
        </div>
        <Button asChild className="h-10 gap-1.5 px-4">
          <Link to="/new">
            <FilePlus2 />
            New story
          </Link>
        </Button>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="flex flex-col gap-3" aria-label="Overview">
        <h2 className="text-[17px] font-medium">Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {views.map((item) => {
            const selected = item.key === view
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setParam("view", item.key === "todo" ? null : item.key)}
                className={cn(
                  "bg-card flex h-36 flex-col justify-between rounded-xl border p-4 text-left transition-colors",
                  selected ? "border-foreground/60 ring-foreground/10 ring-4" : "hover:border-foreground/25",
                )}
              >
                <span className="flex items-center gap-2 text-[14px] font-medium">
                  <item.icon className="size-[18px]" />
                  {item.label}
                </span>
                <span className="flex flex-col gap-2">
                  <span className="text-[2rem] leading-none font-medium tabular-nums">{articles === null ? "–" : counts[item.key]}</span>
                  <span className="text-muted-foreground text-[12px]">{item.caption(member)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="stories-title">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="stories-title" className="text-[17px] font-medium">
              {current.label}
              <span className="text-muted-foreground ml-2 font-normal tabular-nums">{articles === null ? "" : rows.length}</span>
            </h2>
            <p className="text-muted-foreground text-[13px]">{current.caption(member)}</p>
          </div>
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

        <div className="overflow-hidden rounded-xl border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead className="h-11 w-40 px-4 text-[13px]">Status</TableHead>
                <TableHead className="h-11 text-[13px]">Story</TableHead>
                <TableHead className="h-11 w-48 text-[13px]">Author</TableHead>
                <TableHead className="h-11 w-28 text-[13px]">Updated</TableHead>
                <TableHead className="h-11 w-24 pr-4 text-right text-[13px]">Words</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles === null ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="text-muted-foreground h-24 px-4 text-center">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="text-muted-foreground h-24 px-4 text-center">
                    {filtered ? "No stories match this filter." : current.empty}
                  </TableCell>
                </TableRow>
              ) : (
                rows.slice(0, limit).map((article) => {
                  const firstTag = article.tags[0] ? (tagLabel.get(article.tags[0]) ?? article.tags[0]) : ""
                  return (
                    <TableRow
                      key={article.id}
                      tabIndex={0}
                      onClick={() => navigate(`/edit/${article.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") navigate(`/edit/${article.id}`)
                      }}
                      className="hover:bg-muted/50 h-16 cursor-pointer"
                    >
                      <TableCell className="px-4">
                        <StatusCell article={article} />
                      </TableCell>
                      <TableCell>
                        <span className="block truncate text-[14px] font-medium">{article.title || "Untitled draft"}</span>
                        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[12px]">
                          {article.origin === "bot" ? <Bot className="size-3.5 shrink-0" aria-label="From the news agent" /> : null}
                          <span className="shrink-0">{article.desk === "mongolia" ? "Mongolia" : "World"}</span>
                          {firstTag ? <span className="shrink-0">· #{firstTag}</span> : null}
                          {article.status === "changes_requested" && article.reviewNote ? (
                            <span className="truncate text-[var(--state-changes)]">· “{article.reviewNote}”</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={article.authorName || "Agent"} size="sm" />
                          <span className="truncate text-[13px]">{article.authorName || "Agent"}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[13px] whitespace-nowrap">{timeAgo(article.updatedAt)}</TableCell>
                      <TableCell className="text-muted-foreground pr-4 text-right text-[13px] tabular-nums">
                        {wordCount(article.body).toLocaleString("en")}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        {rows.length > limit ? (
          <Button variant="outline" onClick={() => setLimit((value) => value + PAGE)} className="h-9 self-center px-4">
            Show more ({rows.length - limit})
          </Button>
        ) : null}
      </section>

      {isAdmin && (builtins.length > 0 || importing || importResult) ? (
        <section aria-label="Admin only" className="flex flex-col gap-3 border-t pt-6">
          <p className="text-muted-foreground flex items-center gap-1.5 text-[12px]">
            <Lock className="size-3" />
            Admin only
          </p>
          <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
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
