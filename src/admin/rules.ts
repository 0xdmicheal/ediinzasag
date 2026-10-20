import type { Article, ArticleDraft, Member, Origin, Role, Status } from "@/admin/types"
import { countWords } from "@/lib/article-html"

/*
 * Workflow rules for the admin UI. They mirror the database trigger in
 * supabase/schema.sql, which is what actually enforces them.
 */

export const roleLabel: Record<Role, string> = {
  writer: "Writer",
  editor: "Editor",
  admin: "Admin",
}

export const statusMeta: Record<Status, { label: string; tone: string; hint: string }> = {
  draft: { label: "Draft", tone: "bg-foreground/[0.07] text-muted-foreground", hint: "The writer is working on it" },
  in_review: {
    label: "In review",
    tone: "bg-[color-mix(in_oklch,var(--state-review,var(--brand))_12%,transparent)] text-[var(--state-review,var(--brand))]",
    hint: "An editor reviews it",
  },
  changes_requested: {
    label: "Changes requested",
    tone: "bg-[color-mix(in_oklch,var(--state-changes,var(--down))_12%,transparent)] text-[var(--state-changes,var(--down))]",
    hint: "The writer revises it",
  },
  approved: {
    label: "Approved",
    tone: "bg-[color-mix(in_oklch,var(--state-approved,var(--up))_12%,transparent)] text-[var(--state-approved,var(--up))]",
    hint: "Ready to publish",
  },
  published: { label: "Published", tone: "bg-foreground text-background", hint: "Live on the site" },
}

export const statusOrder: Status[] = ["draft", "in_review", "changes_requested", "approved", "published"]

/** Button text for moving an article to a status, from the actor's side. */
export function transitionLabel(from: Status, to: Status) {
  if (to === "in_review") return from === "changes_requested" ? "Resend for review" : "Send for review"
  if (to === "draft") return from === "published" ? "Unpublish" : "Back to draft"
  if (to === "approved") return "Approve"
  if (to === "changes_requested") return "Request changes"
  return from === "approved" ? "Publish" : "Approve and publish"
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

/** An agent card from the inbox: editors may delete it until it is published; admins always. */
export const canDeleteCard = (member: Member, article: Pick<Article, "status">) =>
  member.role === "admin" || (isEditor(member) && article.status !== "published")

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

export const wordCount = countWords

export function readMinutes(body: string) {
  return Math.max(1, Math.round(countWords(body) / 200))
}

export function readiness(draft: ArticleDraft, origin: Origin = "human"): Check[] {
  const words = wordCount(draft.body)
  const titleLength = draft.title.trim().length
  // Agent briefings need a cleared photo (guard_article enforces it). The editor's approval is the human gate.
  const agentChecks: Check[] =
    origin === "bot" ? [{ id: "rights", label: "Cover photo rights checked", ok: !draft.coverUrl || draft.coverRightsOk, required: true }] : []
  return [
    ...agentChecks,
    { id: "title", label: "Headline", ok: titleLength > 0, required: true },
    { id: "dek", label: "Summary (30+ characters)", ok: draft.dek.trim().length >= 30, required: true },
    // The shortest format (Мэдээ) is 200 to 350 words; Мэдээ ба тайлбар 500 to 900.
    { id: "body", label: `Body, 200+ words (${words})`, ok: words >= 200, required: true },
    {
      id: "sources",
      label: "Sources linked in the text",
      ok: /<a\s[^>]*href=/i.test(draft.body) || draft.sources.some((s) => s.label.trim()),
      required: false,
    },
    { id: "tags", label: `1–5 tags (${draft.tags.length})`, ok: draft.tags.length >= 1 && draft.tags.length <= 5, required: true },
    { id: "cover", label: "Cover photo", ok: Boolean(draft.coverUrl), required: true },
    { id: "cover-alt", label: "Cover caption and credit", ok: Boolean(draft.coverUrl && draft.coverAlt.trim()), required: false },
    // House style (EZ Writing System v2.1) is advice only: findings and fixes live in the editor's style panel.
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
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days} d ago` : iso.slice(0, 10).replace(/-/g, ".")
}
