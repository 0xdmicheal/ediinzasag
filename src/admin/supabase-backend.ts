import { slugify } from "@/admin/rules"
import type { Activity, Article, ArticleDraft, AuthorStats, Backend, Insights, Member, NewsItem, NewsRun, ReaderRecord, Role, RunDetails, Status, Subscriber, Tag } from "@/admin/types"
import { devLinkPreview, plainPreview, type LinkPreview } from "@/admin/link-preview"
import { supabaseClient } from "@/lib/supabase"

/* Supabase backend. Permissions are enforced by the database (supabase/schema.sql). */

interface ArticleRow {
  id: string
  slug: string
  title: string
  dek: string
  body: string
  desk: "mongolia" | "world"
  tags: string[]
  cover_url: string
  cover_alt: string
  cover_credit: string
  cover_rights_ok: boolean
  sources: { label: string; href?: string }[]
  take: string
  status: Status
  origin: "human" | "bot"
  source_url: string | null
  bot_notes: string
  author_id: string | null
  review_note: string
  published_at: string | null
  created_at: string
  updated_at: string
  author?: { name: string } | null
}

const select = "*, author:profiles!articles_author_id_fkey(name)"

function toArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dek: row.dek,
    body: row.body,
    desk: row.desk,
    tags: row.tags ?? [],
    coverUrl: row.cover_url,
    coverAlt: row.cover_alt,
    coverCredit: row.cover_credit ?? "",
    coverRightsOk: row.cover_rights_ok ?? true,
    sources: row.sources ?? [],
    take: row.take ?? "",
    status: row.status,
    origin: row.origin ?? "human",
    sourceUrl: row.source_url ?? "",
    botNotes: row.bot_notes ?? "",
    authorId: row.author_id ?? "",
    authorName: row.author?.name ?? "",
    reviewNote: row.review_note,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRow(draft: ArticleDraft) {
  return {
    slug: slugify(draft.slug || draft.title) || `niitlel-${Date.now()}`,
    title: draft.title,
    dek: draft.dek,
    body: draft.body,
    desk: draft.desk,
    tags: draft.tags,
    cover_url: draft.coverUrl,
    cover_alt: draft.coverAlt,
    cover_credit: draft.coverCredit,
    cover_rights_ok: draft.coverRightsOk,
    sources: draft.sources,
    take: draft.take,
  }
}

/** Turns Postgres errors into messages a newsroom member can act on. */
function fail(error: { message: string; code?: string } | null): never {
  if (error?.code === "23505") throw new Error("Энэ хаяг (slug) өөр нийтлэлд ашиглагдсан байна")
  throw new Error(error?.message ?? "Алдаа гарлаа")
}

export function createSupabaseBackend(): Backend {
  const client = supabaseClient()

  /** The signed-in user's own profile; it is readable before the code step, team data is not. */
  async function profileOf(): Promise<Member | null> {
    const { data } = await client.auth.getUser()
    if (!data.user) return null
    const { data: profile } = await client.from("profiles").select("id, email, name, role").eq("id", data.user.id).single()
    return profile ? (profile as Member) : null
  }

  /** Team members count as signed in only after the code step (aal2, see current_team_role in schema.sql). */
  async function member(): Promise<Member | null> {
    const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    return data?.currentLevel === "aal2" ? profileOf() : null
  }

  return {
    mode: "supabase",

    currentMember: member,
    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange(() => callback())
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === "Invalid login credentials" ? "И-мэйл эсвэл нууц үг буруу" : error.message)
      if (!(await profileOf())) {
        await client.auth.signOut()
        throw new Error("Энэ бүртгэл багийн гишүүн биш байна")
      }
      const { data: factors, error: listError } = await client.auth.mfa.listFactors()
      if (listError) throw new Error(listError.message)
      const linked = factors.totp.find((factor) => factor.status === "verified")
      if (linked) return { factorId: linked.id }
      // First sign-in since two-step became required: drop half-finished setups, then link an app.
      for (const factor of factors.all.filter((item) => item.status === "unverified")) {
        await client.auth.mfa.unenroll({ factorId: factor.id })
      }
      const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "EZ Редакц" })
      if (enrollError) throw new Error(enrollError.message)
      return { factorId: enrolled.id, enroll: { qr: enrolled.totp.qr_code, secret: enrolled.totp.secret } }
    },
    async verifyTwoStep(factorId, code) {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") })
      if (error) throw new Error(/invalid|expired/i.test(error.message) ? "Код буруу эсвэл хугацаа нь дууссан байна" : error.message)
    },
    async signOut() {
      await client.auth.signOut()
    },

    async listArticles() {
      const { data, error } = await client.from("articles").select(select).order("updated_at", { ascending: false })
      if (error) fail(error)
      return (data as ArticleRow[]).map(toArticle)
    },
    async getArticle(id) {
      const { data, error } = await client.from("articles").select(select).eq("id", id).maybeSingle()
      if (error) fail(error)
      return data ? toArticle(data as ArticleRow) : null
    },
    async createArticle(draft) {
      const { data, error } = await client.from("articles").insert(toRow(draft)).select(select).single()
      if (error) fail(error)
      return toArticle(data as ArticleRow)
    },
    async updateArticle(id, draft) {
      const { data, error } = await client.from("articles").update(toRow(draft)).eq("id", id).select(select).single()
      if (error) fail(error)
      return toArticle(data as ArticleRow)
    },
    async setStatus(id, status, note = "", publishAt) {
      // published_at in the future schedules it (guard_article); null publishes now.
      const patch =
        status === "changes_requested"
          ? { status, review_note: note }
          : status === "published"
            ? { status, published_at: publishAt ?? null }
            : { status }
      const { data, error } = await client.from("articles").update(patch).eq("id", id).select(select).single()
      if (error) fail(error)
      return toArticle(data as ArticleRow)
    },
    async deleteArticle(id) {
      const { error } = await client.from("articles").delete().eq("id", id)
      if (error) fail(error)
    },
    async listActivity(articleId) {
      const { data, error } = await client
        .from("article_activity")
        .select("id, article_id, action, note, created_at, actor:profiles(name)")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false })
      if (error) fail(error)
      return (data as unknown as { id: number; article_id: string; action: string; note: string; created_at: string; actor: { name: string } | null }[]).map(
        (row): Activity => ({
          id: String(row.id),
          articleId: row.article_id,
          actorName: row.actor?.name ?? "",
          action: row.action,
          note: row.note,
          at: row.created_at,
        }),
      )
    },
    async linkPreview(url) {
      const { data, error } = await client.functions.invoke("link-preview", { body: { url } })
      if (!error) return data as LinkPreview
      // Function not deployed yet: the dev server can still read the page; otherwise show the bare address.
      return devLinkPreview(url).catch(() => plainPreview(url))
    },
    async uploadCover(file) {
      const { data: auth } = await client.auth.getUser()
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `${auth.user?.id ?? "anon"}/${Date.now()}.${extension}`
      const { error } = await client.storage.from("covers").upload(path, file, { contentType: file.type, upsert: false })
      if (error) fail(error)
      return client.storage.from("covers").getPublicUrl(path).data.publicUrl
    },

    async listTags() {
      const { data, error } = await client.from("tags").select("slug, label").order("label")
      if (error) fail(error)
      return data as Tag[]
    },
    async createTag(label) {
      const tag = { slug: slugify(label), label: label.trim() }
      if (!tag.slug) throw new Error("Шошгоны нэр хоосон байна")
      const { error } = await client.from("tags").upsert(tag, { onConflict: "slug", ignoreDuplicates: true })
      if (error) fail(error)
      return tag
    },
    async renameTag(slug, label) {
      const { error } = await client.from("tags").update({ label: label.trim() }).eq("slug", slug)
      if (error) fail(error)
    },
    async deleteTag(slug) {
      const { error } = await client.from("tags").delete().eq("slug", slug)
      if (error) fail(error)
    },

    async listMembers() {
      const { data, error } = await client.from("profiles").select("id, email, name, role").order("created_at")
      if (error) fail(error)
      return data as Member[]
    },
    async setRole(memberId, role: Role) {
      const { error } = await client.from("profiles").update({ role }).eq("id", memberId)
      if (error) fail(error)
    },
    async addMember(name, email, role) {
      const { error } = await client.from("team_invites").upsert({ email: email.trim().toLowerCase(), name: name.trim(), role })
      if (error) fail(error)
    },

    async listSubscribers() {
      const { data, error } = await client.from("newsletter_signups").select("email, source, created_at").order("created_at", { ascending: false })
      if (error) fail(error)
      return (data as { email: string; source: string; created_at: string }[]).map((row): Subscriber => ({ email: row.email, source: row.source, createdAt: row.created_at }))
    },

    async listReaders() {
      const { data, error } = await client
        .from("readers")
        .select("id, name, email, phone, avatar, birth_date, gender, region, created_at")
        .order("created_at", { ascending: false })
      if (error) fail(error)
      type Row = {
        id: string
        name: string
        email: string | null
        phone: string | null
        avatar: string | null
        birth_date: string | null
        gender: ReaderRecord["gender"] | null
        region: string | null
        created_at: string
      }
      return (data as Row[]).map(
        (row): ReaderRecord => ({
          id: row.id,
          name: row.name,
          email: row.email ?? "",
          phone: row.phone ?? "",
          avatar: row.avatar ?? "",
          birthDate: row.birth_date ?? "",
          gender: row.gender ?? "",
          region: row.region ?? "",
          joinedAt: row.created_at,
        }),
      )
    },

    async listPublished() {
      const { data, error } = await client
        .from("articles")
        .select(select)
        .eq("status", "published")
        // Editors can read scheduled articles too; the site only shows ones whose time has come.
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
      if (error) fail(error)
      return (data as ArticleRow[]).map(toArticle)
    },

    async claimArticle(id) {
      const { error } = await client.rpc("claim_article", { aid: id })
      if (error) fail(error)
      const { data, error: readError } = await client.from("articles").select(select).eq("id", id).single()
      if (readError) fail(readError)
      return toArticle(data as ArticleRow)
    },
    async runNewsAgent() {
      const { data, error } = await client.functions.invoke("news-agent", { body: { trigger: "manual" } })
      if (error) {
        // The function answers errors as { error: "..." }; show that rather than the generic HTTP text.
        const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detail?.error ?? "Мэдээ татаж чадсангүй. Edge Function суулгасан эсэхийг шалгана уу (ADMIN.md).")
      }
      return data as { created: number; scanned: number; queued?: number; details?: RunDetails }
    },
    async listNewsItems() {
      const { data, error } = await client
        .from("news_items")
        .select("*")
        .order("seen_at", { ascending: false })
        .order("priority", { ascending: false })
        .limit(1000)
      if (error) fail(error)
      return (data as NewsItemRow[]).map(toNewsItem)
    },
    async fileNewsItem(id) {
      const { data, error } = await client.functions.invoke("news-agent", { body: { action: "file", id: Number(id) } })
      if (error) {
        const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detail?.error ?? "Карт үүсгэж чадсангүй")
      }
      return (data as { article_id: string }).article_id
    },
    async deleteNewsCard(id) {
      const { error } = await client.functions.invoke("news-agent", { body: { action: "delete", id: Number(id) } })
      if (error) {
        const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detail?.error ?? "Карт устгаж чадсангүй")
      }
    },
    async setNewsItemDismissed(id, dismissed) {
      const { error } = await client.from("news_items").update({ status: dismissed ? "dismissed" : "new" }).eq("id", Number(id))
      if (error) fail(error)
    },
    async listNewsRuns() {
      const { data, error } = await client.from("news_runs").select("*").order("started_at", { ascending: false }).limit(10)
      if (error) fail(error)
      return (data as RunRow[]).map(toRun)
    },
    async insights() {
      const { data, error } = await client.rpc("admin_insights")
      if (error) fail(error)
      const raw = data as Omit<Insights, "authors" | "agent"> & {
        authors: AuthorRow[]
        agent: Omit<Insights["agent"], "runs"> & { runs: RunRow[] }
      }
      return {
        ...raw,
        authors: raw.authors.map(toAuthor),
        agent: { ...raw.agent, runs: raw.agent.runs.map(toRun) },
      }
    },
  }
}

interface NewsItemRow {
  id: number
  link: string
  source: string
  title: string
  summary: string
  image: string
  published_at: string | null
  mongolia: boolean
  priority: number
  why: string
  tags: string[]
  desk: NewsItem["desk"]
  status: NewsItem["status"]
  article_id: string | null
  seen_at: string
}

const toNewsItem = (row: NewsItemRow): NewsItem => ({
  id: String(row.id),
  link: row.link,
  source: row.source,
  title: row.title,
  summary: row.summary,
  image: row.image,
  publishedAt: row.published_at,
  mongolia: row.mongolia,
  priority: row.priority,
  why: row.why,
  tags: row.tags ?? [],
  desk: row.desk,
  status: row.status,
  articleId: row.article_id,
  seenAt: row.seen_at,
})

interface RunRow {
  id: number
  started_at: string
  finished_at: string | null
  trigger: NewsRun["trigger"]
  scanned: number
  created: number
  error: string
  details?: RunDetails | null
}

const toRun = (row: RunRow): NewsRun => ({
  id: String(row.id),
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  trigger: row.trigger,
  scanned: row.scanned,
  created: row.created,
  error: row.error,
  details: row.details ?? {},
})

interface AuthorRow {
  id: string
  name: string
  role: Role
  drafts: number
  in_progress: number
  changes_requested: number
  published: number
  published_30d: number
  claimed: number
  hours_to_publish: number | null
  reads: number
  fires: number
  reviews: number
  last_active: string | null
}

const toAuthor = (row: AuthorRow): AuthorStats => ({
  id: row.id,
  name: row.name,
  role: row.role,
  drafts: row.drafts,
  inProgress: row.in_progress,
  changesRequested: row.changes_requested,
  published: row.published,
  published30d: row.published_30d,
  claimed: row.claimed,
  hoursToPublish: row.hours_to_publish,
  reads: Number(row.reads),
  fires: Number(row.fires),
  reviews: row.reviews,
  lastActive: row.last_active,
})
