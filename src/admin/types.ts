import type { LinkPreview } from "@/admin/link-preview"
export type Role = "writer" | "editor" | "admin"
export type Status = "draft" | "in_review" | "changes_requested" | "approved" | "published"
export type Desk = "mongolia" | "world"

export interface Member {
  id: string
  name: string
  email: string
  role: Role
}

/** A registered reader, for the admin's readers list. */
export interface ReaderRecord {
  id: string
  name: string
  /** Empty for phone-only readers. */
  email: string
  phone: string
  avatar: string
  /** YYYY-MM-DD or empty. */
  birthDate: string
  gender: "female" | "male" | "unspecified" | ""
  /** Region id from src/reader/regions.ts, or empty. */
  region: string
  joinedAt: string
}

/** What one agent run did, stage by stage (news_runs.details). */
export interface RunDetails {
  provider?: string
  feeds_ok?: number
  feeds_total?: number
  feeds_failed?: string[]
  /** Stories in the feeds from the last day or two. */
  fresh?: number
  /** Of those, not already on the board. */
  new?: number
  picked?: { title: string; source: string; priority: number }[]
  failures?: string[]
}

/** One run of the news agent. */
export interface NewsRun {
  id: string
  startedAt: string
  finishedAt: string | null
  trigger: "cron" | "manual"
  scanned: number
  created: number
  error: string
  details: RunDetails
}

export interface AuthorStats {
  id: string
  name: string
  role: Role
  drafts: number
  inProgress: number
  changesRequested: number
  published: number
  published30d: number
  /** Agent briefings this person claimed. */
  claimed: number
  /** Average hours from first draft to publication; null when nothing is published. */
  hoursToPublish: number | null
  reads: number
  fires: number
  /** Approvals, change requests and publications made as a reviewer. */
  reviews: number
  lastActive: string | null
}

/** Admin-only monitoring numbers (admin_insights() in schema.sql). Personal details arrive as counts only. */
export interface Insights {
  readers: {
    total: number
    new7: number
    new30: number
    active30: number
    ages: Record<string, number>
    genders: Record<string, number>
    regions: Record<string, number>
    weeks: { week: string; n: number }[]
  }
  reading: { day: string; reads: number; readers: number }[]
  authors: AuthorStats[]
  agent: { waiting: number; claimed: number; published: number; runs: NewsRun[] }
}

export interface Tag {
  slug: string
  label: string
}

export interface ArticleSource {
  label: string
  href?: string
}

/** Fields an author edits. */
export interface ArticleDraft {
  slug: string
  title: string
  dek: string
  /** Sanitised HTML from the rich-text editor (older drafts may be plain text). */
  body: string
  desk: Desk
  tags: string[]
  coverUrl: string
  coverAlt: string
  /** "Зураг: Reuters" style credit, shown under the cover. */
  coverCredit: string
  /** False until a person confirms we may use an agent-imported cover. */
  coverRightsOk: boolean
  sources: ArticleSource[]
  /** "EZ-ийн дүгнэлт": the newsroom's own analysis. Required (40+ words) before an agent briefing is published. */
  take: string
}

/** "human" articles are written in the newsroom; "bot" ones come from the news agent. */
export type Origin = "human" | "bot"

export interface Article extends ArticleDraft {
  id: string
  status: Status
  origin: Origin
  /** The original story an agent briefing was translated from. */
  sourceUrl: string
  /** What the agent wants a person to verify before publishing. */
  botNotes: string
  /** Empty for an agent briefing nobody has claimed yet. */
  authorId: string
  authorName: string
  reviewNote: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  articleId: string
  actorName: string
  /** "created" | "edited" | a Status */
  action: string
  note: string
  at: string
}

export interface Backend {
  mode: "demo" | "supabase"
  currentMember(): Promise<Member | null>
  onAuthChange(callback: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>

  listArticles(): Promise<Article[]>
  getArticle(id: string): Promise<Article | null>
  createArticle(draft: ArticleDraft): Promise<Article>
  updateArticle(id: string, draft: ArticleDraft): Promise<Article>
  /** publishAt (ISO, future) schedules a publication; omitted, it publishes now. */
  setStatus(id: string, status: Status, note?: string, publishAt?: string): Promise<Article>
  deleteArticle(id: string): Promise<void>
  listActivity(articleId: string): Promise<Activity[]>
  uploadCover(file: File): Promise<string>
  /** Title, description and picture of a web page, for link cards in the editor. */
  linkPreview(url: string): Promise<LinkPreview>

  listTags(): Promise<Tag[]>
  createTag(label: string): Promise<Tag>
  renameTag(slug: string, label: string): Promise<void>
  deleteTag(slug: string): Promise<void>

  listMembers(): Promise<Member[]>
  setRole(memberId: string, role: Role): Promise<void>
  /** Demo: adds the member. Supabase: lists the e-mail in team_invites; the Supabase invite still sends the e-mail. */
  addMember(name: string, email: string, role: Role): Promise<void>

  /** Admin only: registered readers (name, e-mail, sign-up date), newest first. */
  listReaders(): Promise<ReaderRecord[]>

  /** Public, no login: published articles for the site. */
  listPublished(): Promise<Article[]>

  /** Takes an unclaimed agent briefing: you become its author and it returns to draft. */
  claimArticle(id: string): Promise<Article>
  /** Editors and admins: run the news agent now. Resolves with how many briefings were added. */
  runNewsAgent(): Promise<{ created: number; scanned: number; details?: RunDetails }>
  listNewsRuns(): Promise<NewsRun[]>
  /** Admin only. */
  insights(): Promise<Insights>
}
