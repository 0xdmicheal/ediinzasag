import { COMMENT_MAX, type LibraryEntry, type Reader, type ReaderAuth, type StoryComment } from "@/reader/types"

/*
 * Demo reader accounts: kept in this browser's localStorage so sign-up,
 * sign-in, codes and the library can be tried before Supabase is connected.
 * NOT secure, NOT shared.
 */

const KEY = "ez-reader-demo-v1"
const SESSION = "ez-reader-demo-session"
const LIBRARY = "ez-reader-demo-library"
const COMMENTS = "ez-reader-demo-comments"
/** ["<slug>:<readerId>", ...] */
const FIRES = "ez-reader-demo-fires"
/** ["<commentId>:<readerId>", ...] */
const LIKES = "ez-reader-demo-likes"

interface Account extends Omit<Reader, "moderator" | "anonymous" | "phone" | "avatar" | "birthDate" | "gender" | "region" | "badge" | "memberNo"> {
  badge?: string
  /** Bought badge ids. */
  badges?: string[]
  anonymous?: boolean
  phone?: string
  avatar?: string
  birthDate?: string
  gender?: Reader["gender"]
  region?: string
  passwordHash: string
}

type Library = Record<string, { reads: LibraryEntry[]; saved: LibraryEntry[] }>

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked: the account lasts for this visit only.
  }
}

async function hash(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ez-demo:${password}`))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

const accounts = () => read<Account[]>(KEY, [])
const signedIn = () => accounts().find((account) => account.id === read<string | null>(SESSION, null)) ?? null

/** Stored with the author; the browser-facing StoryComment only says whether it is yours. */
interface DemoComment extends Omit<StoryComment, "mine" | "likes"> {
  readerId: string
}

const countLikes = (likes: string[], commentId: string) => likes.filter((key) => key.startsWith(`${commentId}:`)).length

function cleanBody(body: string) {
  const text = body.trim()
  if (!text) throw new Error("Сэтгэгдэл хоосон байна")
  if (text.length > COMMENT_MAX) throw new Error(`Сэтгэгдэл ${COMMENT_MAX} тэмдэгтээс ихгүй байна`)
  return text
}

function requireAccount() {
  const account = signedIn()
  if (!account) throw new Error("Нэвтэрнэ үү")
  return account
}

/** Codes live in memory only: a reload forgets them, like an expired code. */
const codes = new Map<string, { code: string; expires: number }>()

function shelf(kind: "reads" | "saved") {
  const library = read<Library>(LIBRARY, {})
  return library[requireAccount().id]?.[kind] ?? []
}

function setShelf(kind: "reads" | "saved", entries: LibraryEntry[]) {
  const id = requireAccount().id
  const library = read<Library>(LIBRARY, {})
  library[id] = { ...(library[id] ?? { reads: [], saved: [] }), [kind]: entries }
  write(LIBRARY, library)
}

export function createDemoReader(): ReaderAuth {
  return {
    mode: "demo",

    async current() {
      const account = signedIn()
      return account
        ? {
            id: account.id,
            email: account.email,
            phone: account.phone ?? "",
            name: account.name,
            moderator: false,
            anonymous: Boolean(account.anonymous),
            avatar: account.avatar ?? "",
            birthDate: account.birthDate ?? "",
            gender: account.gender ?? "",
            region: account.region ?? "",
            badge: account.badge ?? "",
            // Demo: sign-up order in this browser.
            memberNo: accounts().findIndex((item) => item.id === account.id) + 1,
          }
        : null
    },
    onChange(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    async signUp(name, email, password) {
      const list = accounts()
      const address = email.trim().toLowerCase()
      if (list.some((account) => account.email === address)) throw new Error("Энэ и-мэйл бүртгэлтэй байна. Нэвтэрнэ үү")
      const account = { id: `reader-${Date.now()}`, email: address, name: name.trim(), passwordHash: await hash(password) }
      write(KEY, [...list, account])
      write(SESSION, account.id)
      notify()
      return false
    },
    async signIn(email, password) {
      const address = email.trim().toLowerCase()
      const account = accounts().find((item) => item.email === address)
      if (!account || account.passwordHash !== (await hash(password))) throw new Error("И-мэйл эсвэл нууц үг буруу")
      write(SESSION, account.id)
      notify()
    },
    async requestCode(channel, value) {
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0")
      codes.set(`${channel}:${value.trim().toLowerCase()}`, { code, expires: Date.now() + 10 * 60_000 })
      return code
    },
    async verifyCode(channel, value, code) {
      const address = value.trim().toLowerCase()
      const pending = codes.get(`${channel}:${address}`)
      if (!pending || pending.expires < Date.now() || pending.code !== code.trim()) throw new Error("Код буруу эсвэл хугацаа нь дууссан байна")
      codes.delete(`${channel}:${address}`)
      let account = accounts().find((item) => (channel === "phone" ? item.phone === address : item.email === address))
      if (!account) {
        account =
          channel === "phone"
            ? { id: `reader-${Date.now()}`, email: "", phone: address, name: `Уншигч ${address.slice(-4)}`, passwordHash: "" }
            : { id: `reader-${Date.now()}`, email: address, name: address.split("@")[0], passwordHash: "" }
        write(KEY, [...accounts(), account])
      }
      write(SESSION, account.id)
      notify()
    },
    async signInWithGoogle() {
      // No Google in demo mode: sign in as a stand-in Google account instead.
      const email = "demo.google@gmail.com"
      let account = accounts().find((item) => item.email === email)
      if (!account) {
        account = { id: `reader-${Date.now()}`, email, name: "Google хэрэглэгч", passwordHash: "" }
        write(KEY, [...accounts(), account])
      }
      write(SESSION, account.id)
      notify()
    },
    async signOut() {
      write(SESSION, null)
      notify()
    },
    async sendPasswordReset() {
      throw new Error("Демо горимд и-мэйл илгээгдэхгүй. “Кодоор” нэвтрээд нууц үгээ солино уу")
    },
    async updateName(name) {
      const account = requireAccount()
      write(KEY, accounts().map((item) => (item.id === account.id ? { ...item, name: name.trim() } : item)))
      write(
        COMMENTS,
        read<DemoComment[]>(COMMENTS, []).map((item) => (item.readerId === account.id && !item.anonymous ? { ...item, authorName: name.trim() } : item)),
      )
      notify()
    },
    async updatePassword(password) {
      const account = requireAccount()
      const passwordHash = await hash(password)
      write(KEY, accounts().map((item) => (item.id === account.id ? { ...item, passwordHash } : item)))
    },
    async updateProfile(patch) {
      const account = requireAccount()
      const next = { ...account, ...patch }
      write(KEY, accounts().map((item) => (item.id === account.id ? next : item)))
      if (patch.avatar !== undefined) {
        write(
          COMMENTS,
          read<DemoComment[]>(COMMENTS, []).map((item) =>
            item.readerId === account.id && !item.anonymous ? { ...item, authorAvatar: patch.avatar! } : item,
          ),
        )
      }
      notify()
    },
    async updateEmail(email) {
      const account = requireAccount()
      const address = email.trim().toLowerCase()
      if (accounts().some((item) => item.email === address && item.id !== account.id)) throw new Error("Энэ и-мэйл өөр бүртгэлд холбогдсон байна")
      write(KEY, accounts().map((item) => (item.id === account.id ? { ...item, email: address } : item)))
      notify()
      return false
    },
    async setAnonymous(anonymous) {
      const account = requireAccount()
      write(KEY, accounts().map((item) => (item.id === account.id ? { ...item, anonymous } : item)))
      notify()
    },

    async listReads() {
      return shelf("reads")
    },
    async markRead(slug) {
      const reads = shelf("reads")
      if (!reads.some((entry) => entry.slug === slug)) setShelf("reads", [{ slug, at: new Date().toISOString() }, ...reads])
    },
    async listSaved() {
      return shelf("saved")
    },
    async setSaved(slug, saved) {
      const rest = shelf("saved").filter((entry) => entry.slug !== slug)
      setShelf("saved", saved ? [{ slug, at: new Date().toISOString() }, ...rest] : rest)
    },

    async getFire(slug) {
      const fires = read<string[]>(FIRES, []).filter((key) => key.startsWith(`${slug}:`))
      const me = signedIn()?.id
      return { count: fires.length, mine: Boolean(me && fires.includes(`${slug}:${me}`)) }
    },
    async setFire(slug, on) {
      const key = `${slug}:${requireAccount().id}`
      const rest = read<string[]>(FIRES, []).filter((item) => item !== key)
      write(FIRES, on ? [...rest, key] : rest)
    },

    async listBadges() {
      return requireAccount().badges ?? []
    },
    async buyBadge(id) {
      // Demo trusts the profile page's balance check; Supabase checks it in the database.
      const account = requireAccount()
      if ((account.badges ?? []).includes(id)) throw new Error("Энэ тэмдэг танд аль хэдийн бий")
      write(KEY, accounts().map((item) => (item.id === account.id ? { ...item, badges: [...(item.badges ?? []), id] } : item)))
    },
    async wearBadge(id) {
      const account = requireAccount()
      write(KEY, accounts().map((item) => (item.id === account.id ? { ...item, badge: id } : item)))
      write(
        COMMENTS,
        read<DemoComment[]>(COMMENTS, []).map((item) => (item.readerId === account.id && !item.anonymous ? { ...item, authorBadge: id } : item)),
      )
      notify()
    },

    async listComments(slug) {
      const likes = read<string[]>(LIKES, [])
      const me = signedIn()?.id
      return read<DemoComment[]>(COMMENTS, [])
        .filter((item) => item.slug === slug)
        .map(({ readerId, ...item }) => ({
          ...item,
          authorAvatar: item.authorAvatar ?? "",
          authorBadge: item.authorBadge ?? "",
          mine: readerId === me,
          likes: countLikes(likes, item.id),
        }))
    },
    async addComment(slug, body) {
      const account = requireAccount()
      const anonymous = Boolean(account.anonymous)
      const comment: DemoComment = {
        id: `comment-${Date.now()}`,
        slug,
        readerId: account.id,
        anonymous,
        authorName: anonymous ? "" : account.name,
        authorAvatar: anonymous ? "" : (account.avatar ?? ""),
        authorBadge: anonymous ? "" : (account.badge ?? ""),
        body: cleanBody(body),
        createdAt: new Date().toISOString(),
        editedAt: null,
      }
      write(COMMENTS, [...read<DemoComment[]>(COMMENTS, []), comment])
      const { readerId: _, ...shown } = comment
      return { ...shown, mine: true, likes: 0 }
    },
    async editComment(id, body) {
      const account = requireAccount()
      const all = read<DemoComment[]>(COMMENTS, [])
      const target = all.find((item) => item.id === id)
      if (!target || target.readerId !== account.id) throw new Error("Зөвхөн өөрийн сэтгэгдлээ засна")
      const next = { ...target, body: cleanBody(body), editedAt: new Date().toISOString() }
      write(COMMENTS, all.map((item) => (item.id === id ? next : item)))
      const { readerId: _, ...shown } = next
      return { ...shown, mine: true, likes: countLikes(read<string[]>(LIKES, []), id) }
    },
    async deleteComment(id) {
      const account = requireAccount()
      const all = read<DemoComment[]>(COMMENTS, [])
      if (all.find((item) => item.id === id)?.readerId !== account.id) throw new Error("Энэ сэтгэгдлийг устгах эрхгүй")
      write(COMMENTS, all.filter((item) => item.id !== id))
    },
    async listMyLikes(slug) {
      const account = signedIn()
      if (!account) return []
      const ids = new Set(read<DemoComment[]>(COMMENTS, []).filter((item) => item.slug === slug).map((item) => item.id))
      return read<string[]>(LIKES, [])
        .filter((key) => key.endsWith(`:${account.id}`))
        .map((key) => key.split(":")[0])
        .filter((id) => ids.has(id))
    },
    async like(commentId, liked) {
      const account = requireAccount()
      if (read<DemoComment[]>(COMMENTS, []).find((item) => item.id === commentId)?.readerId === account.id) {
        throw new Error("Өөрийн сэтгэгдлийг тэмдэглэх боломжгүй")
      }
      const key = `${commentId}:${account.id}`
      const rest = read<string[]>(LIKES, []).filter((item) => item !== key)
      write(LIKES, liked ? [...rest, key] : rest)
    },
  }
}
