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
  joinedAt: string
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
  sources: ArticleSource[]
}

export interface Article extends ArticleDraft {
  id: string
  status: Status
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
  setStatus(id: string, status: Status, note?: string): Promise<Article>
  deleteArticle(id: string): Promise<void>
  listActivity(articleId: string): Promise<Activity[]>
  uploadCover(file: File): Promise<string>

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
}
