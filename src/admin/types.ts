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
/** An e-mail left on the newsletter form, waiting to be imported into Substack. */
export interface Subscriber {
  email: string
  source: string
  createdAt: string
}

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
  /** Set when the model couldn't rank and the rules did. */
  ranking?: string
  /** Picks put in the draft queue; the agent writes them one by one after the run. */
  queued?: number
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

/** One story the agent read: the "Мэдээний урсгал" inbox (news_items), kept two weeks. */
export interface NewsItem {
  id: string
  link: string
  source: string
  title: string
  summary: string
  image: string
  publishedAt: string | null
  /** From a Mongolian source, or about Mongolia. */
  mongolia: boolean
  /** The rules score, 0–10, and what earned it. */
  priority: number
  why: string
  tags: string[]
  desk: "mongolia" | "world"
  /** "queued"/"drafting": picked by a run, the agent is writing it. "filed": an article card exists (articleId). */
  status: "new" | "queued" | "drafting" | "filed" | "dismissed"
  articleId: string | null
  seenAt: string
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
  /** The «Цаасан дээр бодвол» box (was "EZ-ийн дүгнэлт"): optional, text then an arithmetic line. */
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

/**
 * The code step after the password (Supabase: TOTP, authenticator app). With
 * `enroll`, the member has no app linked yet and first scans the QR code.
 */
export interface TwoStep {
  factorId: string
  enroll?: { qr: string; secret: string }
}

export interface Backend {
  mode: "demo" | "supabase"
  /** A member only once fully signed in (password and, in Supabase, the code). */
  currentMember(): Promise<Member | null>
  onAuthChange(callback: () => void): () => void
  /** Checks the password; resolves to the code step that must follow, or null when there is none. */
  signIn(email: string, password: string): Promise<TwoStep | null>
  /** The code step for the session in hand (after the password, or after /welcome sets one). */
  twoStep(): Promise<TwoStep | null>
  verifyTwoStep(factorId: string, code: string): Promise<void>
  /** "Нууц үгээ мартсан": e-mails a link to /welcome, where a new password is set. */
  sendPasswordReset(email: string): Promise<void>
  /** /welcome: the team member the invite or reset link signed in, before any code. Null when the link gave no session. */
  welcomeMember(): Promise<Member | null>
  setPassword(password: string): Promise<void>
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
  /**
   * Invites someone to the team. "invited"/"resent": an e-mail with a link to /welcome went out.
   * "joined": they already had an account (a reader) and are in at once. Demo: always "joined".
   */
  addMember(name: string, email: string, role: Role): Promise<"invited" | "resent" | "joined">

  /** Admin only: registered readers (name, e-mail, sign-up date), newest first. */
  listReaders(): Promise<ReaderRecord[]>
  /** Admin only: e-mails left on the Нийтлэл page's subscribe form, newest first. */
  listSubscribers(): Promise<Subscriber[]>

  /** Public, no login: published articles for the site. */
  listPublished(): Promise<Article[]>

  /** Takes an unclaimed agent briefing: you become its author and it returns to draft. */
  claimArticle(id: string): Promise<Article>
  /** Editors and admins: run the news agent now. Resolves with how many stories it queued for drafting. */
  runNewsAgent(): Promise<{ created: number; scanned: number; queued?: number; details?: RunDetails }>
  listNewsRuns(): Promise<NewsRun[]>
  /** Every story the agent read in the last two weeks, newest first. */
  listNewsItems(): Promise<NewsItem[]>
  /** Any team member: turns an inbox story into an unclaimed article card. Resolves with the article id. */
  fileNewsItem(id: string): Promise<string>
  setNewsItemDismissed(id: string, dismissed: boolean): Promise<void>
  /** Deletes the card an inbox story became; the story goes to «Хаасан» so the agent doesn't file it again. */
  deleteNewsCard(id: string): Promise<void>
  /** Admin only. */
  insights(): Promise<Insights>
}
