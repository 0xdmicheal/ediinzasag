import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CalendarDays, Download, FilePlus2, Lock } from "lucide-react"

import { BoardList } from "@/admin/BoardList"
import { importBuiltins, pendingBuiltins } from "@/admin/import-builtin"
import { canClaim, canManageTeam, isEditor } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { buttonClass, Notice } from "@/admin/ui"
import type { Article, Tag } from "@/admin/types"

const weekdays = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"]

function mongolianDate(date = new Date()) {
  return `${date.getFullYear()} оны ${date.getMonth() + 1}-р сарын ${date.getDate()}, ${weekdays[date.getDay()]}`
}

/** Самбар: the team's own articles. The news agent's stories live in Мэдээний урсгал (InboxPage). */
export function BoardPage() {
  const { backend, member } = useTeam()
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [error, setError] = useState("")
  const isAdmin = canManageTeam(member)
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null)
  const [importResult, setImportResult] = useState<{ tone: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    Promise.all([backend.listArticles(), backend.listTags()])
      .then(([list, tagList]) => {
        setArticles(list)
        setTags(tagList)
      })
      .catch((failure: Error) => setError(failure.message))
  }, [backend])

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
      setImportResult({ tone: "success", text: `${done} нийтлэл "Хяналтад" орлоо. Нийтэлсний дараа сайтад гарна.` })
    } catch (failure) {
      setImportResult({ tone: "error", text: failure instanceof Error ? failure.message : "Оруулж чадсангүй" })
    } finally {
      setImporting(null)
      setArticles(await backend.listArticles().catch(() => articles))
    }
  }

  // Unclaimed agent cards wait in Мэдээний урсгал until someone takes them ("Би засна").
  const boardArticles = useMemo(() => (articles === null ? null : articles.filter((article) => !canClaim(article))), [articles])

  // What waits on this person: the same set as the board's "Хийх ажил" tile.
  const todo = (boardArticles ?? []).filter(
    (article) =>
      (article.authorId === member.id && (article.status === "draft" || article.status === "changes_requested")) ||
      (isEditor(member) && (article.status === "in_review" || article.status === "approved")),
  ).length

  return (
    <div className="flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
            <CalendarDays className="size-3.5" />
            {mongolianDate()}
          </p>
          <h1 className="font-news mt-2 text-3xl sm:text-[2.25rem]">Сайн байна уу, {member.name.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1 text-[14px]">
            {articles === null ? "Ачаалж байна…" : todo > 0 ? `Танд ${todo} хийх ажил байна.` : "Таны хийх ажил дууссан байна."}
          </p>
        </div>
        <Link to="/new" className={buttonClass.primary}>
          <FilePlus2 className="size-4" />
          Шинэ нийтлэл
        </Link>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <BoardList articles={boardArticles} tags={tags} member={member} />

      {isAdmin && (builtins.length > 0 || importing || importResult) ? (
        <section aria-label="Зөвхөн админ" className="flex flex-col gap-3 border-t pt-6">
          <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] uppercase">
            <Lock className="size-3" />
            Зөвхөн админ
          </p>
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
        </section>
      ) : null}
    </div>
  )
}
