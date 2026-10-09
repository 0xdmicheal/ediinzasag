import { supabaseClient } from "@/lib/supabase"
import { accountUrl, siteUrl } from "@/reader/auth"
import type { LibraryEntry, Reader, ReaderAuth, StoryComment } from "@/reader/types"

/*
 * Reader accounts in Supabase Auth, with a public.readers row per account and
 * reader_reads / reader_saves for the library (supabase/schema.sql).
 */

const messages: Record<string, string> = {
  "Invalid login credentials": "И-мэйл эсвэл нууц үг буруу",
  "Email not confirmed": "И-мэйлээ баталгаажуулаагүй байна. Ирсэн холбоос дээр дарна уу",
  "User already registered": "Энэ и-мэйл бүртгэлтэй байна. Нэвтэрнэ үү",
  "Signups not allowed for this instance": "Одоогоор шинэ бүртгэл нээгдээгүй байна",
  "Signups not allowed for otp": "Одоогоор шинэ бүртгэл нээгдээгүй байна",
  "Token has expired or is invalid": "Код буруу эсвэл хугацаа нь дууссан байна",
  "Unsupported phone provider": "SMS илгээх үйлчилгээ тохируулаагүй байна. И-мэйлээр код авна уу",
  "Phone signups are disabled": "Утсаар бүртгүүлэх одоогоор хаалттай байна",
  "Invalid phone number format (E.164 required)": "Утасны дугаар буруу байна",
  "Unsupported provider: provider is not enabled": "Google нэвтрэлт одоогоор идэвхгүй байна",
  "New password should be different from the old password.": "Шинэ нууц үг хуучнаасаа өөр байх ёстой",
  "Password should be at least 6 characters.": "Нууц үг хэт богино байна",
  "A user with this email address has already been registered": "Энэ и-мэйл өөр бүртгэлд холбогдсон байна",
  "Email address already registered by another user": "Энэ и-мэйл өөр бүртгэлд холбогдсон байна",
}

interface CommentRow {
  id: string
  slug: string
  author_name: string
  author_avatar: string
  author_badge: string
  anonymous: boolean
  body: string
  created_at: string
  edited_at: string | null
  like_count: number
}

/* reader_id is deliberately not readable (see schema.sql), so anonymous comments stay anonymous. */
const commentColumns = "id, slug, author_name, author_avatar, author_badge, anonymous, body, created_at, edited_at, like_count"

function toComment(row: CommentRow, mine: boolean): StoryComment {
  return {
    id: row.id,
    slug: row.slug,
    mine,
    anonymous: row.anonymous,
    authorName: row.author_name,
    authorAvatar: row.author_avatar ?? "",
    authorBadge: row.author_badge ?? "",
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    likes: row.like_count,
  }
}

function fail(error: { message: string; status?: number }): never {
  if (error.status === 429) throw new Error("Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу")
  throw new Error(messages[error.message] ?? error.message)
}

export function createSupabaseReader(): ReaderAuth {
  const client = supabaseClient()

  async function list(table: "reader_reads" | "reader_saves", column: "read_at" | "saved_at"): Promise<LibraryEntry[]> {
    const { data, error } = await client.from(table).select(`slug, ${column}`).order(column, { ascending: false })
    if (error) fail(error)
    return (data as Record<string, string>[]).map((row) => ({ slug: row.slug, at: row[column] }))
  }

  return {
    mode: "supabase",

    async current() {
      const { data } = await client.auth.getUser()
      if (!data.user) return null
      const [{ data: row }, { data: staff }] = await Promise.all([
        client.from("readers").select("name, comment_anonymous, avatar, birth_date, gender, region, badge, member_no").eq("id", data.user.id).maybeSingle(),
        // Only team members can read profiles, so this is empty for everyone else.
        client.from("profiles").select("role").eq("id", data.user.id).maybeSingle(),
      ])
      const meta = data.user.user_metadata ?? {}
      const fallback = (meta.name as string | undefined) ?? (meta.full_name as string | undefined) ?? data.user.email?.split("@")[0] ?? ""
      return {
        id: data.user.id,
        email: data.user.email ?? "",
        phone: data.user.phone ? `+${data.user.phone.replace(/^\+/, "")}` : "",
        name: row?.name || fallback,
        moderator: staff?.role === "editor" || staff?.role === "admin",
        anonymous: Boolean(row?.comment_anonymous),
        avatar: row?.avatar ?? "",
        birthDate: row?.birth_date ?? "",
        gender: row?.gender ?? "",
        region: row?.region ?? "",
        badge: row?.badge ?? "",
        memberNo: row?.member_no ?? null,
      } satisfies Reader
    },
    onChange(callback) {
      const { data } = client.auth.onAuthStateChange(() => callback())
      return () => data.subscription.unsubscribe()
    },
    async signUp(name, email, password) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: accountUrl() },
      })
      if (error) fail(error)
      // With e-mail confirmation on, Supabase answers a repeat sign-up with a user that has no identities.
      if (data.user && data.user.identities?.length === 0) throw new Error(messages["User already registered"])
      return !data.session
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) fail(error)
    },
    async requestCode(channel, value) {
      const { error } =
        channel === "phone"
          ? await client.auth.signInWithOtp({ phone: value, options: { shouldCreateUser: true } })
          : await client.auth.signInWithOtp({ email: value, options: { shouldCreateUser: true, emailRedirectTo: accountUrl() } })
      if (error) fail(error)
      return null
    },
    async verifyCode(channel, value, code) {
      const { error } =
        channel === "phone"
          ? await client.auth.verifyOtp({ phone: value, token: code, type: "sms" })
          : await client.auth.verifyOtp({ email: value, token: code, type: "email" })
      if (error) fail(error)
    },
    async signInWithGoogle(returnTo) {
      // Leaves the site for Google; the session is picked up from the URL on return.
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: siteUrl(returnTo) } })
      if (error) fail(error)
    },
    async signOut() {
      await client.auth.signOut()
    },
    async sendPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${accountUrl()}?reset=1` })
      if (error) fail(error)
    },
    async updateName(name) {
      const { data } = await client.auth.getUser()
      if (!data.user) throw new Error("Нэвтэрнэ үү")
      const { error } = await client.from("readers").update({ name: name.trim() }).eq("id", data.user.id)
      if (error) fail(error)
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password })
      if (error) fail(error)
    },
    async updateProfile(patch) {
      const { data } = await client.auth.getUser()
      if (!data.user) throw new Error("Нэвтэрнэ үү")
      const row: Record<string, string | null> = {}
      if (patch.avatar !== undefined) row.avatar = patch.avatar
      if (patch.birthDate !== undefined) row.birth_date = patch.birthDate
      if (patch.gender !== undefined) row.gender = patch.gender
      if (patch.region !== undefined) row.region = patch.region || null
      const { error } = await client.from("readers").update(row).eq("id", data.user.id)
      if (error) fail(error.message.includes("birth_date") ? { message: "Төрсөн огноо буруу байна" } : error)
    },
    async updateEmail(email) {
      const { data, error } = await client.auth.updateUser({ email: email.trim() }, { emailRedirectTo: accountUrl() })
      if (error) fail(error)
      // Supabase keeps the old address until the new one is confirmed from its inbox.
      return data.user?.email?.toLowerCase() !== email.trim().toLowerCase()
    },
    async setAnonymous(anonymous) {
      const { data } = await client.auth.getUser()
      if (!data.user) throw new Error("Нэвтэрнэ үү")
      const { error } = await client.from("readers").update({ comment_anonymous: anonymous }).eq("id", data.user.id)
      if (error) fail(error)
    },

    listReads: () => list("reader_reads", "read_at"),
    async markRead(slug, tags) {
      const { error } = await client
        .from("reader_reads")
        .upsert({ slug, desk: tags?.desk ?? null, topic: tags?.topic ?? null }, { onConflict: "reader_id,slug", ignoreDuplicates: true })
      if (error) fail(error)
    },
    listSaved: () => list("reader_saves", "saved_at"),
    async setSaved(slug, saved) {
      const { error } = saved
        ? await client.from("reader_saves").upsert({ slug }, { onConflict: "reader_id,slug", ignoreDuplicates: true })
        : await client.from("reader_saves").delete().eq("slug", slug)
      if (error) fail(error)
    },

    async getFire(slug) {
      const { data: auth } = await client.auth.getUser()
      const [{ data: stats, error }, mine] = await Promise.all([
        client.from("article_stats").select("fire_count").eq("slug", slug).maybeSingle(),
        auth.user ? client.from("article_fires").select("slug").eq("slug", slug).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (error) fail(error)
      return { count: stats?.fire_count ?? 0, mine: Boolean(mine.data) }
    },
    async setFire(slug, on) {
      const { error } = on
        ? await client.from("article_fires").upsert({ slug }, { onConflict: "slug,reader_id", ignoreDuplicates: true })
        : await client.from("article_fires").delete().eq("slug", slug)
      if (error) fail(error)
    },

    async listBadges() {
      const { data, error } = await client.from("reader_badges").select("badge_id")
      if (error) fail(error)
      return (data as { badge_id: string }[]).map((row) => row.badge_id)
    },
    async buyBadge(id) {
      const { error } = await client.rpc("buy_badge", { bid: id })
      if (error) fail(error)
    },
    async wearBadge(id) {
      const { data } = await client.auth.getUser()
      if (!data.user) throw new Error("Нэвтэрнэ үү")
      const { error } = await client.from("readers").update({ badge: id }).eq("id", data.user.id)
      if (error) fail(error)
    },

    async listComments(slug) {
      const { data, error } = await client.from("article_comments").select(commentColumns).eq("slug", slug).order("created_at")
      if (error) fail(error)
      const { data: auth } = await client.auth.getUser()
      let mine = new Set<string>()
      if (auth.user) {
        const { data: ids } = await client.rpc("my_comment_ids", { target_slug: slug })
        mine = new Set((ids as string[] | null) ?? [])
      }
      return (data as CommentRow[]).map((row) => toComment(row, mine.has(row.id)))
    },
    async addComment(slug, body) {
      // The database decides name vs. "Зочин" from readers.comment_anonymous.
      const { data, error } = await client
        .from("article_comments")
        .insert({ slug, body: body.trim() })
        .select(commentColumns)
        .single()
      if (error) fail(error)
      return toComment(data as CommentRow, true)
    },
    async editComment(id, body) {
      const { data, error } = await client.from("article_comments").update({ body: body.trim() }).eq("id", id).select(commentColumns).single()
      if (error) fail(error)
      return toComment(data as CommentRow, true)
    },
    async deleteComment(id) {
      const { error, count } = await client.from("article_comments").delete({ count: "exact" }).eq("id", id)
      if (error) fail(error)
      if (count === 0) throw new Error("Энэ сэтгэгдлийг устгах эрхгүй")
    },
    async listMyLikes(slug) {
      const { data: auth } = await client.auth.getUser()
      if (!auth.user) return []
      const { data, error } = await client
        .from("comment_likes")
        .select("comment_id, comment:article_comments!inner(slug)")
        .eq("comment.slug", slug)
      if (error) fail(error)
      return (data as unknown as { comment_id: string }[]).map((row) => row.comment_id)
    },
    async like(commentId, liked) {
      const { error } = liked
        ? await client.from("comment_likes").upsert({ comment_id: commentId }, { onConflict: "comment_id,reader_id", ignoreDuplicates: true })
        : await client.from("comment_likes").delete().eq("comment_id", commentId)
      if (error) fail(error)
    },
  }
}
