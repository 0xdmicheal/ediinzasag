import type { Article, ArticleDraft, Member, Origin, Role, Status } from "@/admin/types"
import { countHeadings, countWords } from "@/lib/article-html"

/*
 * Workflow rules for the admin UI. They mirror the database trigger in
 * supabase/schema.sql, which is what actually enforces them.
 */

export const roleLabel: Record<Role, string> = {
  writer: "Сэтгүүлч",
  editor: "Редактор",
  admin: "Админ",
}

export const statusMeta: Record<Status, { label: string; tone: string; hint: string }> = {
  draft: { label: "Ноорог", tone: "bg-foreground/[0.07] text-muted-foreground", hint: "Зохиогч бичиж байна" },
  in_review: { label: "Хянагдаж буй", tone: "bg-brand-soft text-brand-strong", hint: "Редактор хянана" },
  changes_requested: {
    label: "Засвар хүссэн",
    tone: "bg-[color-mix(in_oklch,var(--down)_12%,transparent)] text-[var(--down)]",
    hint: "Зохиогч засна",
  },
  approved: {
    label: "Батлагдсан",
    tone: "bg-[color-mix(in_oklch,var(--up)_12%,transparent)] text-[var(--up)]",
    hint: "Нийтлэхэд бэлэн",
  },
  published: { label: "Нийтлэгдсэн", tone: "bg-foreground text-background", hint: "Сайт дээр байна" },
}

export const statusOrder: Status[] = ["draft", "in_review", "changes_requested", "approved", "published"]

/** Button text for moving an article to a status, from the actor's side. */
export function transitionLabel(from: Status, to: Status) {
  if (to === "in_review") return from === "changes_requested" ? "Засаад дахин илгээх" : "Хянуулахаар илгээх"
  if (to === "draft") return from === "published" ? "Нийтлэлээс буулгах" : "Ноорог руу буцаах"
  if (to === "approved") return "Батлах"
  if (to === "changes_requested") return "Засвар хүсэх"
  return from === "approved" ? "Нийтлэх" : "Батлаад нийтлэх"
}

export const isEditor = (member: Member) => member.role === "editor" || member.role === "admin"

/** Published with a time still ahead: readers will see it then. */
export const isScheduled = (article: Pick<Article, "status" | "publishedAt">) =>
  article.status === "published" && Boolean(article.publishedAt) && Date.parse(article.publishedAt!) > Date.now()

/** "2026.10.09 08:00" in the reader's local time. */
export function formatWhen(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** An agent briefing nobody has claimed yet (writers must claim it before editing). */
export const isUnclaimed = (article: Pick<Article, "origin" | "authorId">) => article.origin === "bot" && !article.authorId

export const canClaim = (article: Pick<Article, "origin" | "authorId" | "status">) => isUnclaimed(article) && article.status !== "published"

/** Minimum words in the EZ take before an agent briefing can go out. */
export const TAKE_MIN_WORDS = 40

export function canEdit(member: Member, article: Pick<Article, "authorId" | "status">) {
  if (isEditor(member)) return true
  return article.authorId === member.id && (article.status === "draft" || article.status === "changes_requested")
}

export function allowedTransitions(member: Member, article: Pick<Article, "authorId" | "status">): Status[] {
  if (!isEditor(member)) {
    if (article.authorId !== member.id) return []
    if (article.status === "draft") return ["in_review"]
    if (article.status === "changes_requested") return ["in_review", "draft"]
    if (article.status === "in_review") return ["draft"]
    return []
  }
  switch (article.status) {
    case "draft":
      return ["in_review", "published"]
    case "in_review":
      return ["approved", "changes_requested", "published"]
    case "changes_requested":
      return ["in_review", "draft"]
    case "approved":
      return ["published", "changes_requested"]
    case "published":
      return ["draft"]
  }
}

export const canDelete = (member: Member, article: Pick<Article, "authorId" | "status">) =>
  member.role === "admin" || (article.authorId === member.id && article.status === "draft")

export const canManageTags = isEditor
export const canManageTeam = (member: Member) => member.role === "admin"

/* ------------------------------------------------------------------ */
/* Readiness: the brand book's rules turned into a checklist           */
/* ------------------------------------------------------------------ */

export interface Check {
  id: string
  label: string
  ok: boolean
  /** Required checks must pass before an article can go to review. */
  required: boolean
}

const shouty = /(!{2,}|ШОК|ЯАРАЛТАЙ|ОДОО Л)/

export const wordCount = countWords

export function readMinutes(body: string) {
  return Math.max(1, Math.round(countWords(body) / 200))
}

export function readiness(draft: ArticleDraft, origin: Origin = "human"): Check[] {
  const words = wordCount(draft.body)
  const titleLength = draft.title.trim().length
  const takeWords = wordCount(draft.take)
  // Agent briefings also need a person's own analysis and a cleared photo (guard_article enforces both).
  const agentChecks: Check[] =
    origin === "bot"
      ? [
          { id: "take", label: `EZ-ийн дүгнэлт ${TAKE_MIN_WORDS}+ үг (${takeWords})`, ok: takeWords >= TAKE_MIN_WORDS, required: true },
          { id: "rights", label: "Нүүр зургийн эрхийг шалгасан", ok: !draft.coverUrl || draft.coverRightsOk, required: true },
        ]
      : []
  return [
    ...agentChecks,
    { id: "title", label: `Гарчиг 10–70 тэмдэгт (${titleLength})`, ok: titleLength >= 10 && titleLength <= 70, required: true },
    { id: "dek", label: "Товч тайлбар бичсэн", ok: draft.dek.trim().length >= 30, required: true },
    { id: "body", label: `Үндсэн текст 120+ үг (${words})`, ok: words >= 120, required: true },
    { id: "sources", label: "Тоо бүр эх сурвалжтай: 1+ эх сурвалж", ok: draft.sources.some((s) => s.label.trim()), required: true },
    { id: "tags", label: `1–5 шошго (${draft.tags.length})`, ok: draft.tags.length >= 1 && draft.tags.length <= 5, required: true },
    { id: "cover", label: "Нүүр зураг", ok: Boolean(draft.coverUrl), required: true },
    { id: "cover-alt", label: "Нүүр зургийн тайлбар", ok: Boolean(draft.coverUrl && draft.coverAlt.trim()), required: false },
    {
      id: "calm",
      label: "Айдас биш, ойлголт: ШОК, !!! байхгүй",
      ok: !shouty.test(`${draft.title} ${draft.dek}`),
      required: true,
    },
    { id: "headings", label: "2+ дэд гарчиг", ok: countHeadings(draft.body) >= 2, required: false },
  ]
}

/* ------------------------------------------------------------------ */
/* Slugs                                                               */
/* ------------------------------------------------------------------ */

const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "ye", ё: "yo", ж: "j", з: "z", и: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", ө: "u", п: "p", р: "r", с: "s", т: "t", у: "u",
  ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "i",
  э: "e", ю: "yu", я: "ya",
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .split("")
    .map((char) => translit[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** "Нэр | https://…" per line ⇄ sources. */
export function parseSources(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|").map((part) => part.trim())
      return href ? { label, href } : { label }
    })
}

export function formatSources(sources: { label: string; href?: string }[]) {
  return sources.map((source) => (source.href ? `${source.label} | ${source.href}` : source.label)).join("\n")
}

export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return "дөнгөж сая"
  if (minutes < 60) return `${minutes} минутын өмнө`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} цагийн өмнө`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days} өдрийн өмнө` : iso.slice(0, 10).replace(/-/g, ".")
}
