import { allowedTransitions, canDelete, canEdit, canManageTags, canManageTeam, slugify } from "@/admin/rules"
import type { Activity, Article, ArticleDraft, Backend, Member, ReaderRecord, Role, Status, Tag } from "@/admin/types"

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
  const base = { coverUrl: "", coverAlt: "", reviewNote: "", publishedAt: null, createdAt: now, updatedAt: now }
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
  return { members, tags, articles, activity: [] }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Store
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
  member.role !== "writer" || article.authorId === member.id || article.status === "published"

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
    },
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
        ...draft,
        slug: uniqueSlug(store, draft.slug || draft.title),
        id: `a-${Date.now()}`,
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
    async setStatus(id, status: Status, note = "") {
      const store = load()
      const member = requireMember(store)
      const article = store.articles.find((item) => item.id === id)
      if (!article) throw new Error("Нийтлэл олдсонгүй")
      if (!allowedTransitions(member, article).includes(status)) throw new Error("Энэ алхмыг хийх эрхгүй")
      article.status = status
      article.updatedAt = new Date().toISOString()
      if (status === "changes_requested") article.reviewNote = note
      article.publishedAt = status === "published" ? new Date().toISOString() : null
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

    async listReaders() {
      if (!canManageTeam(requireMember(load()))) throw new Error("Зөвхөн админ харна")
      // Demo reader accounts (src/reader/demo-reader.ts) live in this browser; ids carry the sign-up time.
      let accounts: { id: string; name: string; email: string; phone?: string; avatar?: string; birthDate?: string; gender?: ReaderRecord["gender"] }[] = []
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
            joinedAt: new Date(Number.isFinite(time) ? time : 0).toISOString() }
        })
        .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    },

    async listPublished() {
      return load().articles.filter((article) => article.status === "published")
    },
  }
}
