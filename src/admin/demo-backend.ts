import { demoBriefings, demoInsights, demoNewsItems } from "@/admin/demo-samples"
import { devLinkPreview, plainPreview } from "@/admin/link-preview"
import { allowedTransitions, canClaim, canDelete, canDeleteCard, canEdit, canManageTags, canManageTeam, isEditor, slugify } from "@/admin/rules"
import type { Activity, Article, ArticleDraft, Backend, Member, NewsItem, NewsRun, ReaderRecord, Role, Status, Subscriber, Tag } from "@/admin/types"

/*
 * Demo backend: everything lives in this browser's localStorage, so you can
 * try the whole workflow before connecting Supabase. It applies the same
 * rules as the database, but it is NOT secure and NOT shared between people.
 */

const KEY = "ez-admin-demo-v1"
const SESSION = "ez-admin-demo-session"

interface Store {
  members: Member[]
  tags: Tag[]
  articles: Article[]
  activity: Activity[]
  runs?: NewsRun[]
  inbox?: NewsItem[]
}

/** Fields added after the first demo release, so older browser data keeps working. */
const articleDefaults = {
  coverCredit: "",
  coverRightsOk: true,
  take: "",
  origin: "human" as const,
  sourceUrl: "",
  botNotes: "",
}

function seed(): Store {
  const now = new Date().toISOString()
  const members: Member[] = [
    { id: "demo-writer", name: "Жишээ сэтгүүлч", email: "writer@demo.ez", role: "writer" },
    { id: "demo-editor", name: "Жишээ редактор", email: "editor@demo.ez", role: "editor" },
    { id: "demo-admin", name: "Жишээ админ", email: "admin@demo.ez", role: "admin" },
  ]
  const tags: Tag[] = [
    { slug: "policy", label: "Мөнгөний бодлого" },
    { slug: "mining", label: "Уул уурхай" },
    { slug: "fuel", label: "Шатахуун" },
    { slug: "markets", label: "Зах зээл" },
    { slug: "energy", label: "Эрчим хүч" },
    { slug: "us", label: "АНУ" },
    { slug: "china", label: "Хятад" },
    { slug: "europe", label: "Европ" },
  ]
  const base = { ...articleDefaults, coverUrl: "", coverAlt: "", reviewNote: "", publishedAt: null, createdAt: now, updatedAt: now }
  const articles: Article[] = [
    {
      ...base,
      id: "demo-1",
      slug: "jishee-noorog",
      title: "Жишээ ноорог: энд гарчгаа бичнэ",
      dek: "Энэ бол демо горимын жишээ ноорог. Засаад, хянуулахаар илгээж үзээрэй.",
      body: "## Эхний хэсэг\n\nЭнд үндсэн текст бичнэ.\n\n## Хоёр дахь хэсэг\n\nДэд гарчиг, тод, холбоос, зургийг дээрх хэрэгслийн самбараас нэмнэ.",
      desk: "mongolia",
      tags: ["markets"],
      sources: [],
      status: "draft",
      authorId: "demo-writer",
      authorName: "Жишээ сэтгүүлч",
    },
    {
      ...base,
      id: "demo-2",
      slug: "jishee-khyanagdaj-bui",
      title: "Жишээ: редакторын хяналтад илгээсэн нийтлэл",
      dek: "Редактороор нэвтэрч батлах, засвар хүсэх, нийтлэх үйлдлийг туршаарай.",
      body: "## Жишээ\n\nДемо горимын нийтлэл.",
      desk: "world",
      tags: ["us", "markets"],
      sources: [{ label: "Жишээ эх сурвалж" }],
      status: "in_review",
      authorId: "demo-writer",
      authorName: "Жишээ сэтгүүлч",
    },
  ]
  return { members, tags, articles: [...articles, ...demoBriefings(1)], activity: [], runs: [] }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const store = JSON.parse(raw) as Store
      store.articles = store.articles.map((article) => ({ ...articleDefaults, ...article }))
      return store
    }
  } catch {
    // Storage blocked or corrupted: start over.
  }
  const fresh = seed()
  save(fresh)
  return fresh
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Storage full or blocked: changes last for this visit only.
  }
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

function sessionId() {
  try {
    return localStorage.getItem(SESSION)
  } catch {
    return null
  }
}

function requireMember(store: Store) {
  const member = store.members.find((item) => item.id === sessionId())
  if (!member) throw new Error("Нэвтэрнэ үү")
  return member
}

function uniqueSlug(store: Store, wanted: string, ownId?: string) {
  const base = slugify(wanted) || "niitlel"
  let slug = base
  let n = 2
  while (store.articles.some((article) => article.slug === slug && article.id !== ownId)) slug = `${base}-${n++}`
  return slug
}

function log(store: Store, articleId: string, actor: Member, action: string, note = "") {
  store.activity.push({
    id: `${Date.now()}-${Math.random()}`,
    articleId,
    actorName: actor.name,
    action,
    note,
    at: new Date().toISOString(),
  })
}

const visibleTo = (member: Member, article: Article) =>
  member.role !== "writer" || article.authorId === member.id || article.status === "published" || canClaim(article)

export function createDemoBackend(): Backend {
  return {
    mode: "demo",

    async currentMember() {
      const store = load()
      return store.members.find((item) => item.id === sessionId()) ?? null
    },
    onAuthChange(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    async signIn(email) {
      const store = load()
      const member = store.members.find((item) => item.email.toLowerCase() === email.trim().toLowerCase())
      if (!member) throw new Error("Ийм гишүүн алга. Демо дээр доорх товчнуудаас сонгоно уу.")
      localStorage.setItem(SESSION, member.id)
      notify()
      return null
    },
    async verifyTwoStep() {},
    async signOut() {
      localStorage.removeItem(SESSION)
      notify()
    },

    async listArticles() {
      const store = load()
      const member = requireMember(store)
      return store.articles.filter((article) => visibleTo(member, article))
    },
    async getArticle(id) {
      const store = load()
      const member = requireMember(store)
      const article = store.articles.find((item) => item.id === id)
      return article && visibleTo(member, article) ? article : null
    },
    async createArticle(draft) {
      const store = load()
      const member = requireMember(store)
      const now = new Date().toISOString()
      const article: Article = {
        ...articleDefaults,
        ...draft,
        coverRightsOk: true,
        slug: uniqueSlug(store, draft.slug || draft.title),
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, // unique even when several are made in one millisecond
        status: "draft",
        authorId: member.id,
        authorName: member.name,
        reviewNote: "",
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      store.articles.push(article)
      log(store, article.id, member, "created")
      save(store)
      return article
    },
    async updateArticle(id, draft: ArticleDraft) {
      const store = load()
      const member = requireMember(store)
      const article = store.articles.find((item) => item.id === id)
      if (!article) throw new Error("Нийтлэл олдсонгүй")
      if (!canEdit(member, article)) throw new Error("Энэ нийтлэлийг засах эрхгүй")
      Object.assign(article, draft, { slug: uniqueSlug(store, draft.slug || draft.title, id), updatedAt: new Date().toISOString() })
      log(store, id, member, "edited")
      save(store)
      return article
    },
    async setStatus(id, status: Status, note = "", publishAt) {
      const store = load()
      const member = requireMember(store)
      const article = store.articles.find((item) => item.id === id)
      if (!article) throw new Error("Нийтлэл олдсонгүй")
      if (!allowedTransitions(member, article).includes(status)) throw new Error("Энэ алхмыг хийх эрхгүй")
      if (article.origin === "bot" && status === "published") {
        if (article.coverUrl && !article.coverRightsOk) throw new Error("Нүүр зургийн эрхийг шалгаж баталгаажуулна уу")
      }
      article.status = status
      article.updatedAt = new Date().toISOString()
      if (status === "changes_requested") article.reviewNote = note
      const now = new Date().toISOString()
      article.publishedAt = status === "published" ? (publishAt && publishAt > now ? publishAt : now) : null
      log(store, id, member, status, status === "changes_requested" ? note : "")
      save(store)
      return article
    },
    async deleteArticle(id) {
      const store = load()
      const member = requireMember(store)
      const article = store.articles.find((item) => item.id === id)
      if (!article || !canDelete(member, article)) throw new Error("Устгах эрхгүй")
      store.articles = store.articles.filter((item) => item.id !== id)
      save(store)
    },
    async listActivity(articleId) {
      return load()
        .activity.filter((item) => item.articleId === articleId)
        .sort((a, b) => b.at.localeCompare(a.at))
    },
    async linkPreview(url) {
      return devLinkPreview(url).catch(() => plainPreview(url))
    },
    async uploadCover(file) {
      if (file.size > 1_500_000) throw new Error("Демо горимд 1.5MB-аас бага зураг оруулна уу")
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error("Зураг уншиж чадсангүй"))
        reader.readAsDataURL(file)
      })
    },

    async listTags() {
      return load().tags
    },
    async createTag(label) {
      const store = load()
      if (!canManageTags(requireMember(store))) throw new Error("Шошго нэмэх эрхгүй")
      const slug = slugify(label)
      if (!slug) throw new Error("Шошгоны нэр хоосон байна")
      const existing = store.tags.find((tag) => tag.slug === slug)
      if (existing) return existing
      const tag = { slug, label: label.trim() }
      store.tags.push(tag)
      save(store)
      return tag
    },
    async renameTag(slug, label) {
      const store = load()
      if (!canManageTags(requireMember(store))) throw new Error("Эрхгүй")
      const tag = store.tags.find((item) => item.slug === slug)
      if (tag) tag.label = label.trim()
      save(store)
    },
    async deleteTag(slug) {
      const store = load()
      if (!canManageTags(requireMember(store))) throw new Error("Эрхгүй")
      store.tags = store.tags.filter((tag) => tag.slug !== slug)
      store.articles.forEach((article) => (article.tags = article.tags.filter((item) => item !== slug)))
      save(store)
    },

    async listMembers() {
      return load().members
    },
    async setRole(memberId, role: Role) {
      const store = load()
      if (!canManageTeam(requireMember(store))) throw new Error("Зөвхөн админ эрх өөрчилнө")
      const member = store.members.find((item) => item.id === memberId)
      if (member) member.role = role
      save(store)
      notify()
    },
    async addMember(name, email, role) {
      const store = load()
      if (!canManageTeam(requireMember(store))) throw new Error("Зөвхөн админ гишүүн нэмнэ")
      if (store.members.some((item) => item.email === email)) throw new Error("Энэ и-мэйл бүртгэлтэй")
      store.members.push({ id: `m-${Date.now()}`, name, email, role })
      save(store)
    },

    async listSubscribers() {
      if (!canManageTeam(requireMember(load()))) throw new Error("Зөвхөн админ харна")
      // Demo sign-ups (src/content/newsletter.ts) live in this browser.
      try {
        const rows = JSON.parse(localStorage.getItem("ez-newsletter-demo-v1") ?? "[]") as Subscriber[]
        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      } catch {
        return []
      }
    },

    async listReaders() {
      if (!canManageTeam(requireMember(load()))) throw new Error("Зөвхөн админ харна")
      // Demo reader accounts (src/reader/demo-reader.ts) live in this browser; ids carry the sign-up time.
      let accounts: { id: string; name: string; email: string; phone?: string; avatar?: string; birthDate?: string; gender?: ReaderRecord["gender"]; region?: string }[] = []
      try {
        accounts = JSON.parse(localStorage.getItem("ez-reader-demo-v1") ?? "[]")
      } catch {
        // Storage blocked or corrupted: no readers to show.
      }
      return accounts
        .map((account): ReaderRecord => {
          const time = Number(account.id.split("-")[1])
          return {
            id: account.id,
            name: account.name,
            email: account.email,
            phone: account.phone ?? "",
            avatar: account.avatar ?? "",
            birthDate: account.birthDate ?? "",
            gender: account.gender ?? "",
            region: account.region ?? "",
            joinedAt: new Date(Number.isFinite(time) ? time : 0).toISOString() }
        })
        .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    },

    async listPublished() {
      const now = new Date().toISOString()
      return load().articles.filter((article) => article.status === "published" && (article.publishedAt ?? "") <= now)
    },

    async claimArticle(id) {
      const store = load()
      const member = requireMember(store)
      const article = store.articles.find((item) => item.id === id)
      if (!article || !canClaim(article)) throw new Error("Энэ мэдээг өөр хүн авсан байна")
      Object.assign(article, { authorId: member.id, authorName: member.name, status: "draft", updatedAt: new Date().toISOString() })
      log(store, id, member, "claimed")
      save(store)
      return article
    },
    async runNewsAgent() {
      const store = load()
      if (!isEditor(requireMember(store))) throw new Error("Редактор, админ л ажиллуулна")
      // The real agent runs in a Supabase Edge Function; the demo adds ready-made sample briefings.
      const known = new Set(store.articles.map((article) => article.sourceUrl).filter(Boolean))
      const fresh = demoBriefings(3, known)
      store.articles.push(...fresh)
      const now = new Date().toISOString()
      // Like the real run: every story read lands in the inbox, the auto-filed ones already "filed".
      store.inbox ??= demoNewsItems()
      const stamp = Date.now()
      store.inbox.unshift(
        ...fresh.map((article, index) => ({
          ...demoNewsItems()[index],
          id: `news-${stamp}-f${index}`,
          link: article.sourceUrl,
          title: article.title,
          image: article.coverUrl,
          status: "filed" as const,
          articleId: article.id,
          seenAt: now,
        })),
        ...demoNewsItems()
          .slice(3, 7)
          .map((item, index) => ({ ...item, id: `news-${stamp}-n${index}`, link: `${item.link}-${stamp}`, seenAt: now })),
      )
      const run: NewsRun = {
        id: `run-${Date.now()}`,
        startedAt: now,
        finishedAt: now,
        trigger: "manual",
        scanned: 42,
        created: fresh.length,
        error: "",
        details: {
          provider: "демо",
          feeds_ok: 25,
          feeds_total: 25,
          feeds_failed: [],
          fresh: 42,
          new: 42 - known.size,
          picked: fresh.map((article) => ({ title: article.title, source: "Жишээ эх сурвалж", priority: 7 })),
          failures: [],
        },
      }
      store.runs = [run, ...(store.runs ?? [])].slice(0, 10)
      save(store)
      return { created: fresh.length, scanned: run.scanned, details: run.details }
    },
    async listNewsItems() {
      const store = load()
      requireMember(store)
      store.inbox ??= demoNewsItems()
      save(store)
      return store.inbox
    },
    async fileNewsItem(id) {
      const store = load()
      const member = requireMember(store)
      const item = (store.inbox ??= demoNewsItems()).find((entry) => entry.id === id)
      if (!item) throw new Error("Мэдээ олдсонгүй")
      if (item.articleId) return item.articleId
      // The real function drafts it (Gemini) or files a source card; the demo files a ready-made sample card.
      const [card] = demoBriefings(1)
      const article: Article = {
        ...card,
        title: item.title,
        dek: item.summary,
        desk: item.desk,
        tags: item.tags,
        coverUrl: item.image,
        coverCredit: `Зураг: ${item.source}`,
        sources: [{ label: `${item.source}: ${item.title}`, href: item.link }],
        sourceUrl: item.link,
      }
      store.articles.push(article)
      log(store, article.id, member, "filed")
      Object.assign(item, { status: "filed", articleId: article.id })
      save(store)
      return article.id
    },
    async deleteNewsCard(id) {
      const store = load()
      const member = requireMember(store)
      const item = (store.inbox ??= demoNewsItems()).find((entry) => entry.id === id)
      if (!item) throw new Error("Мэдээ олдсонгүй")
      const article = store.articles.find((entry) => entry.id === item.articleId)
      if (article && !canDeleteCard(member, article)) throw new Error("Устгах эрхгүй")
      store.articles = store.articles.filter((entry) => entry.id !== item.articleId)
      Object.assign(item, { status: "dismissed", articleId: null })
      save(store)
    },
    async setNewsItemDismissed(id, dismissed) {
      const store = load()
      requireMember(store)
      const item = store.inbox?.find((entry) => entry.id === id)
      if (item && item.status !== "filed") item.status = dismissed ? "dismissed" : "new"
      save(store)
    },
    async listNewsRuns() {
      return load().runs ?? []
    },
    async insights() {
      const store = load()
      if (!canManageTeam(requireMember(store))) throw new Error("Зөвхөн админ харна")
      return demoInsights(store.members, store.articles, store.runs ?? [])
    },
  }
}
