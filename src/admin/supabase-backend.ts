import { slugify } from "@/admin/rules"
import type { Activity, Article, ArticleDraft, Backend, Member, ReaderRecord, Role, Status, Tag } from "@/admin/types"
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
  sources: { label: string; href?: string }[]
  status: Status
  author_id: string
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
    sources: row.sources ?? [],
    status: row.status,
    authorId: row.author_id,
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
    sources: draft.sources,
  }
}

/** Turns Postgres errors into messages a newsroom member can act on. */
function fail(error: { message: string; code?: string } | null): never {
  if (error?.code === "23505") throw new Error("Энэ хаяг (slug) өөр нийтлэлд ашиглагдсан байна")
  throw new Error(error?.message ?? "Алдаа гарлаа")
}

export function createSupabaseBackend(): Backend {
  const client = supabaseClient()

  async function member(): Promise<Member | null> {
    const { data } = await client.auth.getUser()
    if (!data.user) return null
    const { data: profile } = await client.from("profiles").select("id, email, name, role").eq("id", data.user.id).single()
    return profile ? (profile as Member) : null
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
      if (!(await member())) {
        await client.auth.signOut()
        throw new Error("Энэ бүртгэл багийн гишүүн биш байна")
      }
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
    async setStatus(id, status, note = "") {
      const patch = status === "changes_requested" ? { status, review_note: note } : { status }
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

    async listReaders() {
      const { data, error } = await client
        .from("readers")
        .select("id, name, email, phone, avatar, birth_date, gender, created_at")
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
          joinedAt: row.created_at,
        }),
      )
    },

    async listPublished() {
      const { data, error } = await client
        .from("articles")
        .select(select)
        .eq("status", "published")
        .order("published_at", { ascending: false })
      if (error) fail(error)
      return (data as ArticleRow[]).map(toArticle)
    },
  }
}
