import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  Circle,
  Columns2,
  Eye,
  Hand,
  ImagePlus,
  Monitor,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "cn"

import { useConfirm } from "@/admin/ConfirmDialog"
import { ArticlePreview } from "@/admin/ArticlePreview"
import { RichEditor } from "@/admin/RichEditor"
import { scheduleDayValue, ScheduleDate } from "@/admin/ScheduleDate"
import {
  allowedTransitions,
  canClaim,
  canDelete,
  canEdit,
  canManageTags,
  formatSources,
  parseSources,
  readiness,
  slugify,
  statusMeta,
  TAKE_MIN_WORDS,
  timeAgo,
  transitionLabel,
  isScheduled,
  formatWhen,
  wordCount,
} from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { TagInput } from "@/admin/TagInput"
import { Avatar, buttonClass, Field, inputClass, Notice, StatusPill } from "@/admin/ui"
import type { Activity, Article, ArticleDraft, Status, Tag } from "@/admin/types"
import { bodyToHtml } from "@/lib/article-html"
import { publicUrl } from "@/lib/public-url"

const emptyDraft: ArticleDraft = {
  slug: "",
  title: "",
  dek: "",
  body: "",
  desk: "mongolia",
  tags: [],
  coverUrl: "",
  coverAlt: "",
  coverCredit: "",
  coverRightsOk: true,
  sources: [],
  take: "",
}

const actionText: Record<string, string> = {
  created: "үүсгэв",
  edited: "засварлав",
  claimed: "мэдээг авч засварлаж эхлэв",
  draft: "ноорог руу буцаав",
  in_review: "хянуулахаар илгээв",
  changes_requested: "засвар хүсэв",
  approved: "батлав",
  published: "нийтлэв",
}

const AGENT_NAME = "EZ агент"

const AUTOSAVE_MS = 1500
const SPLIT_KEY = "ez-editor-split"

function readSplit() {
  try {
    return localStorage.getItem(SPLIT_KEY) === "1"
  } catch {
    return false
  }
}

function toDraft(article: Article): ArticleDraft {
  return {
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    body: bodyToHtml(article.body),
    desk: article.desk,
    tags: article.tags,
    coverUrl: article.coverUrl,
    coverAlt: article.coverAlt,
    coverCredit: article.coverCredit,
    coverRightsOk: article.coverRightsOk,
    sources: article.sources,
    take: article.take,
  }
}

/**
 * Writing view modelled on Substack: a quiet page with title, subtitle and
 * body; settings, tags and the approval steps live in a side panel opened
 * with "Үргэлжлүүлэх". Saves on its own as you type. Agent briefings get a
 * review card on top (source, what to verify, claim) and an EZ take below.
 */
export function EditorPage() {
  const confirm = useConfirm()
  const { id } = useParams()
  const navigate = useNavigate()
  const { backend, member } = useTeam()

  const [article, setArticle] = useState<Article | null>(null)
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft)
  const [editorKey, setEditorKey] = useState("new")
  const [sourcesText, setSourcesText] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [words, setWords] = useState(0)
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [split, setSplit] = useState(readSplit)
  const [device, setDevice] = useState<"desktop" | "phone">("desktop")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [takeOpen, setTakeOpen] = useState(false)
  const [note, setNote] = useState("")
  const [scheduleOn, setScheduleOn] = useState(false)
  // Publish day plus time, local. Defaults to tomorrow 09:00.
  const [scheduleDay, setScheduleDay] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return scheduleDayValue(tomorrow)
  })
  const [scheduleHour, setScheduleHour] = useState("09")
  const [scheduleMinute, setScheduleMinute] = useState("00")
  const scheduleAt = `${scheduleDay}T${scheduleHour}:${scheduleMinute}`
  const [loading, setLoading] = useState(Boolean(id))
  const [openedAt] = useState(() => new Date().toISOString())
  const coverInput = useRef<HTMLInputElement>(null)
  const titleField = useRef<HTMLTextAreaElement>(null)

  // Grow the title to fit every line, also when the column narrows (split view, window resize).
  useEffect(() => {
    const field = titleField.current
    if (!field) return
    const fit = () => {
      field.style.height = "auto"
      field.style.height = `${field.scrollHeight}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(field.parentElement ?? field)
    return () => observer.disconnect()
  }, [draft.title, split, loading])
  const savingRef = useRef(false)

  useEffect(() => {
    backend.listTags().then(setTags)
  }, [backend])

  const load = useCallback(
    (found: Article) => {
      setArticle(found)
      setDraft(toDraft(found))
      setEditorKey(`${found.id}:${found.authorId}`)
      setSourcesText(formatSources(found.sources))
      setSlugTouched(true)
      setTakeOpen(Boolean(found.take))
      setDirty(false)
    },
    [],
  )

  useEffect(() => {
    if (!id || article?.id === id) return
    let cancelled = false
    setLoading(true)
    Promise.all([backend.getArticle(id), backend.listActivity(id)])
      .then(([found, log]) => {
        if (cancelled) return
        setLoading(false)
        if (!found) {
          setMessage({ tone: "error", text: "Нийтлэл олдсонгүй эсвэл үзэх эрхгүй" })
          return
        }
        load(found)
        setActivity(log)
      })
      .catch((failure: Error) => !cancelled && setMessage({ tone: "error", text: failure.message }))
    return () => {
      cancelled = true
    }
  }, [backend, id, load])

  const isAgent = article?.origin === "bot"
  const unclaimed = article ? canClaim(article) : false
  const editable = article ? canEdit(member, article) : true
  const checks = useMemo(() => readiness(draft, article?.origin), [draft, article?.origin])
  const required = checks.filter((check) => check.required)
  const requiredOk = required.every((check) => check.ok)
  const transitions = article ? allowedTransitions(member, article) : []
  const takeWords = wordCount(draft.take)

  function update<K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value }
      if (key === "title" && !slugTouched) next.slug = slugify(String(value))
      // A new picture needs its own rights check.
      if (key === "coverUrl" && isAgent) next.coverRightsOk = false
      return next
    })
    setDirty(true)
  }

  const save = useCallback(async () => {
    if (!editable || savingRef.current) return article
    savingRef.current = true
    setSaving(true)
    try {
      const saved = article ? await backend.updateArticle(article.id, draft) : await backend.createArticle(draft)
      setArticle(saved)
      setDraft((current) => ({ ...current, slug: saved.slug }))
      setDirty(false)
      if (!article) navigate(`/admin/edit/${saved.id}`, { replace: true })
      return saved
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Хадгалж чадсангүй" })
      return null
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [article, backend, draft, editable, navigate])

  // Autosave shortly after typing stops (a new article saves once it has a title or text).
  useEffect(() => {
    if (!dirty || !editable) return
    if (!article && !draft.title.trim() && words === 0) return
    const timer = window.setTimeout(save, AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [dirty, editable, article, draft, words, save])

  // Ctrl/⌘ + S saves now.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        if (dirty) save()
      }
      if (event.key === "Escape") {
        setPanelOpen(false)
        setPreviewOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dirty, save])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  function toggleSplit() {
    setSplit((value) => {
      try {
        localStorage.setItem(SPLIT_KEY, value ? "0" : "1")
      } catch {
        // Storage blocked: the choice lasts for this visit.
      }
      return !value
    })
  }

  async function move(status: Status) {
    if (status === "changes_requested" && !noteOpen) {
      setNoteOpen(true)
      return
    }
    if (status === "changes_requested" && !note.trim()) {
      setMessage({ tone: "error", text: "Юуг засахыг тайлбарлана уу" })
      return
    }
    if ((status === "in_review" || status === "published") && !requiredOk) {
      setMessage({ tone: "error", text: "Улаан тэмдэгтэй шалгуурыг эхлээд биелүүлнэ үү" })
      return
    }
    let publishAt: string | undefined
    if (status === "published" && scheduleOn) {
      const when = scheduleAt ? new Date(scheduleAt) : null
      if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now() + 60_000) {
        setMessage({ tone: "error", text: "Ирээдүйн огноо, цаг сонгоно уу" })
        return
      }
      publishAt = when.toISOString()
    }
    let current = article
    if (dirty || !current) current = await save()
    if (!current) return
    setBusy(true)
    try {
      const next = await backend.setStatus(current.id, status, note.trim(), publishAt)
      setArticle(next)
      setActivity(await backend.listActivity(next.id))
      setNoteOpen(false)
      setNote("")
      setScheduleOn(false)
      setMessage({
        tone: "success",
        text: isScheduled(next) ? `${formatWhen(next.publishedAt!)}-д нийтлэгдэхээр товлогдлоо` : `${statusMeta[status].label} боллоо`,
      })
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Алдаа гарлаа" })
    } finally {
      setBusy(false)
    }
  }

  async function claim() {
    if (!article) return
    setBusy(true)
    try {
      const next = await backend.claimArticle(article.id)
      load(next)
      setActivity(await backend.listActivity(next.id))
      setMessage({ tone: "success", text: "Мэдээ таных боллоо. Засаж, дүгнэлтээ нэмээд хянуулахаар илгээнэ үү." })
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Авч чадсангүй" })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!article) return
    const ok = await confirm({
      title: "Энэ нийтлэлийг устгах уу?",
      message: `“${article.title || "Гарчиггүй"}” бүр мөсөн устна. Буцаах боломжгүй.`,
      confirmLabel: "Устгах",
      destructive: true,
    })
    if (!ok) return
    try {
      await backend.deleteArticle(article.id)
      navigate("/admin")
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Устгаж чадсангүй" })
    }
  }

  async function onCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      update("coverUrl", await backend.uploadCover(file))
      // Our own upload: rights are ours unless someone says otherwise.
      update("coverRightsOk", true)
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Зураг оруулж чадсангүй" })
    } finally {
      setBusy(false)
      event.target.value = ""
    }
  }

  async function openPanel() {
    setPanelOpen(true)
    if (article) setActivity(await backend.listActivity(article.id))
  }

  if (loading) {
    return <p className="text-muted-foreground grid min-h-svh place-items-center text-sm">Ачаалж байна…</p>
  }

  const saveText = saving ? "Хадгалж байна…" : dirty ? "Хадгалаагүй" : article ? "Хадгалсан" : "Ноорог"
  const author = article ? article.authorName || (isAgent ? AGENT_NAME : member.name) : member.name
  const doneCount = required.filter((check) => check.ok).length
  const date = (article?.publishedAt ?? article?.updatedAt ?? openedAt).slice(0, 10)
  const botNotes = (article?.botNotes ?? "")
    .split(/\n+|(?<=\.)\s+(?=[А-ЯӨҮЁA-Z])/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
  const deviceToggle = (
    <div role="group" aria-label="Дэлгэцийн хэмжээ" className="flex items-center gap-1">
      {(
        [
          ["desktop", Monitor, "Компьютер"],
          ["phone", Smartphone, "Утас"],
        ] as const
      ).map(([key, Icon, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={device === key}
          aria-label={label}
          title={label}
          onClick={() => setDevice(key)}
          className={cn("grid size-9 place-items-center rounded-md", device === key ? "bg-foreground text-background" : "hover:bg-foreground/5")}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
  // Real screen widths, so the site's own phone and desktop layouts apply.
  const deviceWidth = device === "phone" ? 390 : 1280
  const preview = (width?: number) => <ArticlePreview draft={draft} tags={tags} authorName={author} date={date} width={width} />

  return (
    <div className="bg-background text-foreground min-h-svh">
      {/* Top bar */}
      <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className={cn("mx-auto flex h-14 items-center gap-3 px-4 sm:px-6", split ? "max-w-none" : "max-w-[1200px]")}>
          <Link to="/admin" aria-label="Самбар руу буцах" className="hover:bg-foreground/5 grid size-9 place-items-center rounded-md">
            <ArrowLeft className="size-4" />
          </Link>
          <img src={publicUrl("brand/logo-black.png")} alt="" className="hidden h-5 w-auto sm:block dark:hidden" />
          <img src={publicUrl("brand/logo-white.png")} alt="" className="hidden h-5 w-auto dark:sm:block" />
          {article && isScheduled(article) ? (
            <span className="bg-foreground/[0.07] hidden h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium sm:inline-flex">
              <CalendarClock className="size-3.5" />
              Товлосон · {formatWhen(article.publishedAt!)}
            </span>
          ) : article ? (
            <StatusPill status={article.status} className="hidden sm:inline-flex" />
          ) : null}
          {isAgent ? (
            <span className="bg-foreground/[0.07] hidden h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium md:inline-flex">
              <Bot className="size-3.5" />
              Агент
            </span>
          ) : null}
          <span className="text-muted-foreground text-[13px]" aria-live="polite">
            {saveText}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={openPanel}
              title="Бэлэн байдал"
              className={cn(
                "hidden h-9 items-center gap-1.5 rounded-full px-3 font-mono text-[12px] sm:inline-flex",
                requiredOk ? "bg-[color-mix(in_oklch,var(--up)_12%,transparent)] text-[var(--up)]" : "bg-muted text-muted-foreground",
              )}
            >
              {requiredOk ? <Check className="size-3.5" /> : <Circle className="size-3.5" />}
              {doneCount}/{required.length}
            </button>
            <button
              type="button"
              onClick={toggleSplit}
              aria-pressed={split}
              title="Засвар ба урьдчилсан харагдацыг зэрэгцүүлэх"
              className={cn(buttonClass.ghost, "hidden lg:inline-flex", split && "bg-foreground text-background hover:bg-foreground/90")}
            >
              <Columns2 className="size-4" />
              Зэрэгцүүлэх
            </button>
            <button type="button" onClick={() => setPreviewOpen(true)} className={buttonClass.ghost}>
              <Eye className="size-4" />
              <span className="hidden sm:inline">Урьдчилан харах</span>
            </button>
            {unclaimed ? (
              <button type="button" disabled={busy} onClick={claim} className={buttonClass.brand}>
                <Hand className="size-4" />
                Би засна
              </button>
            ) : (
              <button type="button" onClick={openPanel} className={buttonClass.brand}>
                Үргэлжлүүлэх
              </button>
            )}
          </div>
        </div>
      </header>

      <div className={cn(split && "lg:grid lg:grid-cols-2")}>
        {/* Page */}
        <main className={cn("mx-auto w-full max-w-[728px] px-4 pt-10 pb-32 sm:pt-14", split && "lg:max-w-none lg:px-10 xl:px-16")}>
          <div className="mb-6 flex flex-col gap-3 empty:hidden">
            {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
            {article && isScheduled(article) ? (
              <Notice>{formatWhen(article.publishedAt!)}-д сайт дээр автоматаар нийтлэгдэнэ. Цуцлах бол “Үргэлжлүүлэх” → “Товлолт цуцлах”.</Notice>
            ) : null}
            {article?.status === "changes_requested" && article.reviewNote ? (
              <Notice tone="error">Редакторын тэмдэглэл: “{article.reviewNote}”</Notice>
            ) : null}
            {!editable && !unclaimed ? (
              <Notice>
                {article?.status === "in_review"
                  ? "Редактор хянаж байна. Засах бол “Үргэлжлүүлэх” → “Ноорог руу буцаах”."
                  : "Энэ нийтлэлийг засах эрх танд алга. Зөвхөн уншина."}
              </Notice>
            ) : null}
          </div>

          {isAgent && article ? (
            <section aria-label="Агентын мэдээ" className="bg-muted/50 mb-10 rounded-xl border p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="bg-foreground text-background grid size-9 shrink-0 place-items-center rounded-full">
                    <Bot className="size-4" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold">Агентын орчуулсан мэдээ</p>
                    <p className="text-muted-foreground mt-0.5 text-[13px] leading-relaxed">
                      {unclaimed
                        ? "Түүхий орчуулга. Хэн нэг нь авч, баримтыг шалгаж, өөрийн дүгнэлтийг нэмсний дараа нийтлэгдэнэ."
                        : `${article.authorName || "Гишүүн"} засварлаж байна. Нийтлэхээс өмнө EZ-ийн дүгнэлт, зургийн эрх шаардлагатай.`}
                    </p>
                  </div>
                </div>
                {article.sourceUrl ? (
                  <a href={article.sourceUrl} target="_blank" rel="noreferrer" className={cn(buttonClass.ghost, "h-8 px-3 text-[12px]")}>
                    Эх мэдээ
                    <ArrowUpRight className="size-3.5" />
                  </a>
                ) : null}
              </div>
              {botNotes.length > 0 ? (
                <div className="mt-4 border-t pt-4">
                  <p className="text-muted-foreground font-mono text-[11px] uppercase">Шалгах зүйлс</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {botNotes.map((line, index) => (
                      <li key={index} className="flex items-start gap-2 text-[13px] leading-relaxed">
                        <Circle className="text-muted-foreground mt-1 size-3 shrink-0" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {unclaimed ? (
                <button type="button" disabled={busy} onClick={claim} className={cn(buttonClass.primary, "mt-4")}>
                  <Hand className="size-4" />
                  Би энэ мэдээг засна
                </button>
              ) : null}
            </section>
          ) : null}

          <label htmlFor="article-title" className="sr-only">
            Гарчиг
          </label>
          <textarea
            ref={titleField}
            id="article-title"
            rows={1}
            disabled={!editable}
            value={draft.title}
            onChange={(event) => update("title", event.target.value.replace(/\n/g, " "))}
            placeholder="Гарчиг"
            className="font-news field-sizing-content w-full resize-none bg-transparent text-[2.25rem] leading-[1.12] outline-none placeholder:text-muted-foreground/70 sm:text-[2.75rem]"
          />
          <label htmlFor="article-dek" className="sr-only">
            Дэд гарчиг
          </label>
          <textarea
            id="article-dek"
            rows={1}
            disabled={!editable}
            value={draft.dek}
            onChange={(event) => update("dek", event.target.value.replace(/\n/g, " "))}
            placeholder="Дэд гарчиг нэмэх…"
            className="text-muted-foreground field-sizing-content mt-3 w-full resize-none bg-transparent text-xl leading-relaxed outline-none placeholder:text-muted-foreground/80"
          />

          <div className="mt-6 mb-8 flex items-center gap-3 border-b pb-6">
            <Avatar name={author} />
            <div className="text-[13px]">
              <p className="font-medium">{author}</p>
              <p className="text-muted-foreground">
                {date.replace(/-/g, ".")} · {words} үг · {Math.max(1, Math.round(words / 200))} мин унших
              </p>
            </div>
          </div>

          <RichEditor
            key={editorKey}
            content={draft.body}
            editable={editable}
            onChange={(html) => update("body", html)}
            onWordCount={setWords}
            onUploadImage={(file) => backend.uploadCover(file)}
            onLinkPreview={(url) => backend.linkPreview(url)}
          />

          {/* EZ take: required on agent briefings, optional elsewhere. */}
          {isAgent || takeOpen || draft.take ? (
            <section aria-labelledby="take-label" className="border-brand/30 bg-brand-soft/40 mt-12 rounded-xl border p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label id="take-label" htmlFor="article-take" className="text-brand-strong font-mono text-[11px] font-semibold uppercase">
                  EZ-ийн дүгнэлт{isAgent ? "" : " · заавал биш"}
                </label>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    isAgent && takeWords < TAKE_MIN_WORDS ? "text-[var(--down)]" : "text-muted-foreground",
                  )}
                >
                  {takeWords}
                  {isAgent ? ` / ${TAKE_MIN_WORDS}+` : ""} үг
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
                Энэ мэдээ Монголд юу гэсэн үг вэ? Редакцын өөрийн тайлбар, тоо баримтын харьцуулалт, уншигч юуг анхаарах ёстой. Нийтлэлийн төгсгөлд тусад нь
                харагдана. Хоосон мөрөөр догол мөр тусгаарлана.
              </p>
              <textarea
                id="article-take"
                disabled={!editable}
                value={draft.take}
                onChange={(event) => update("take", event.target.value)}
                rows={5}
                placeholder="Жишээ: Зэсийн үнэ өсөх нь Оюу толгойн экспортын орлогыг нэмэх ч…"
                className="field-sizing-content mt-3 min-h-28 w-full resize-none bg-transparent text-[1.0625rem] leading-[1.7] outline-none placeholder:text-muted-foreground/80"
              />
            </section>
          ) : editable ? (
            <button type="button" onClick={() => setTakeOpen(true)} className={cn(buttonClass.ghost, "mt-12")}>
              + EZ-ийн дүгнэлт нэмэх
            </button>
          ) : null}
        </main>

        {/* Live preview beside the editor on wide screens. */}
        {split ? (
          <aside aria-label="Урьдчилсан харагдац" className="bg-muted sticky top-14 hidden h-[calc(100svh-3.5rem)] overflow-y-auto border-l p-6 lg:block">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-muted-foreground font-mono text-[11px] uppercase">Сайт дээр ингэж харагдана</p>
              {deviceToggle}
            </div>
            <div
              className={cn(
                "bg-background mx-auto overflow-hidden border shadow-sm",
                device === "phone" ? "max-w-[402px] rounded-[2rem] border-[6px] border-foreground/80" : "rounded-xl",
              )}
            >
              {preview(deviceWidth)}
            </div>
          </aside>
        ) : null}
      </div>

      {/* Publish settings panel */}
      {panelOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button type="button" aria-label="Хаах" className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => setPanelOpen(false)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Нийтлэх тохиргоо"
            className="bg-background relative flex h-full w-full flex-col border-l shadow-2xl sm:w-[460px]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-5">
              <p className="font-news text-lg">Нийтлэх тохиргоо</p>
              <button type="button" aria-label="Хаах" onClick={() => setPanelOpen(false)} className="hover:bg-foreground/5 grid size-9 place-items-center rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
              {/* Readiness */}
              <section>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold">Бэлэн байдал</p>
                  <span className="text-muted-foreground font-mono text-[12px]">
                    {doneCount}/{required.length}
                  </span>
                </div>
                <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                  <div
                    className={cn("h-full rounded-full transition-all", requiredOk ? "bg-[var(--up)]" : "bg-brand")}
                    style={{ width: `${(doneCount / required.length) * 100}%` }}
                  />
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {checks.map((check) => (
                    <li key={check.id} className="flex items-start gap-2 text-[13px]">
                      {check.ok ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-[var(--up)]" />
                      ) : (
                        <Circle className={cn("mt-0.5 size-4 shrink-0", check.required ? "text-[var(--down)]" : "text-muted-foreground")} />
                      )}
                      <span className={check.ok ? "text-muted-foreground" : ""}>
                        {check.label}
                        {!check.required ? <span className="text-muted-foreground"> · зөвлөмж</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <Field
                label="Шошго"
                hint={canManageTags(member) ? "Enter дарж нэмнэ. Байхгүй шошгыг шинээр үүсгэж болно." : "Байгаа шошгоос сонгоно."}
                htmlFor="tag-input"
              >
                <TagInput
                  value={draft.tags}
                  tags={tags}
                  disabled={!editable}
                  canCreate={canManageTags(member)}
                  onChange={(next) => update("tags", next)}
                  onCreate={async (label) => {
                    const tag = await backend.createTag(label)
                    setTags((current) => (current.some((item) => item.slug === tag.slug) ? current : [...current, tag]))
                    return tag
                  }}
                />
              </Field>

              <Field label="Ширээ">
                <div role="radiogroup" aria-label="Ширээ" className="bg-muted flex rounded-full p-1">
                  {(["mongolia", "world"] as const).map((desk) => (
                    <button
                      key={desk}
                      type="button"
                      role="radio"
                      aria-checked={draft.desk === desk}
                      disabled={!editable}
                      onClick={() => update("desk", desk)}
                      className={cn("h-8 flex-1 rounded-full text-[13px] font-medium transition-colors", draft.desk === desk ? "bg-background shadow-sm" : "text-muted-foreground")}
                    >
                      {desk === "mongolia" ? "Монгол" : "Дэлхий"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Нүүр зураг" hint="Сайт, сошиал хуваалцалт дээр харагдана.">
                <div className="flex flex-col gap-2">
                  {draft.coverUrl ? (
                    <div className="relative overflow-hidden rounded-lg border">
                      <img src={draft.coverUrl} alt={draft.coverAlt} className="aspect-[16/9] w-full object-cover" />
                      {editable ? (
                        <button type="button" onClick={() => update("coverUrl", "")} className="bg-background/90 absolute top-2 right-2 rounded-full px-3 py-1 text-[12px]">
                          Солих
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!editable || busy}
                      onClick={() => coverInput.current?.click()}
                      className="text-muted-foreground hover:text-foreground border-foreground/20 hover:border-foreground/40 flex aspect-[16/7] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-[13px] transition-colors"
                    >
                      <ImagePlus className="size-5" />
                      Зураг сонгох
                    </button>
                  )}
                  <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={onCover} />
                  <label htmlFor="article-cover-alt" className="sr-only">
                    Зургийн тайлбар
                  </label>
                  <input
                    id="article-cover-alt"
                    disabled={!editable}
                    value={draft.coverAlt}
                    onChange={(event) => update("coverAlt", event.target.value)}
                    placeholder="Тайлбар (заавал биш, жишээ: Оюу толгойн далд уурхай)"
                    className={inputClass}
                  />
                  <label htmlFor="article-cover-credit" className="sr-only">
                    Зургийн эх сурвалж
                  </label>
                  <input
                    id="article-cover-credit"
                    disabled={!editable}
                    value={draft.coverCredit}
                    onChange={(event) => update("coverCredit", event.target.value)}
                    placeholder="Зургийн эх сурвалж (жишээ: Зураг: Rio Tinto)"
                    className={inputClass}
                  />
                  {draft.coverUrl && (isAgent || !draft.coverRightsOk) ? (
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-[13px] leading-relaxed",
                        draft.coverRightsOk ? "border-[color-mix(in_oklch,var(--up)_40%,transparent)]" : "border-[color-mix(in_oklch,var(--down)_40%,transparent)]",
                      )}
                    >
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={draft.coverRightsOk}
                        onChange={(event) => update("coverRightsOk", event.target.checked)}
                        className="mt-0.5 size-4 accent-[var(--up)]"
                      />
                      <span>
                        <span className="flex items-center gap-1 font-medium">
                          <ShieldCheck className="size-4" />
                          Зургийг ашиглах эрхтэй
                        </span>
                        <span className="text-muted-foreground block text-[12px]">
                          Агентлагийн зураг ихэвчлэн зөвшөөрөлгүй ашиглах боломжгүй. Эх сурвалж нь ашиглахыг зөвшөөрсөн (хэвлэлийн зураг, нээлттэй лиценз) эсвэл
                          өөрсдийн зургаар сольсон бол тэмдэглэнэ.
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              </Field>

              <Field label="Эх сурвалж" hint="Мөр бүрт нэг: Нэр | https://холбоос" htmlFor="article-sources">
                <textarea
                  id="article-sources"
                  rows={3}
                  disabled={!editable}
                  value={sourcesText}
                  onChange={(event) => {
                    setSourcesText(event.target.value)
                    update("sources", parseSources(event.target.value))
                  }}
                  placeholder="Монголбанк, мэдэгдэл 2026/06 | https://www.mongolbank.mn/..."
                  className={cn(inputClass, "font-mono text-[13px]")}
                />
              </Field>

              <Field label="Хаяг" hint={`ediinzasag.mn/story/${draft.slug || "…"}`} htmlFor="article-slug">
                <input
                  id="article-slug"
                  disabled={!editable}
                  value={draft.slug}
                  onChange={(event) => {
                    setSlugTouched(true)
                    update("slug", slugify(event.target.value))
                  }}
                  className={cn(inputClass, "font-mono")}
                />
              </Field>

              {article ? (
                <section>
                  <button
                    type="button"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen((value) => !value)}
                    className="flex w-full items-center justify-between text-[13px] font-semibold"
                  >
                    Түүх
                    <ChevronDown className={cn("size-4 transition-transform", historyOpen && "rotate-180")} />
                  </button>
                  {historyOpen ? (
                    <ol className="mt-3 flex flex-col gap-3">
                      {activity.map((item) => {
                        const byAgent = item.action === "created" && item.note === "agent"
                        return (
                          <li key={item.id} className="border-l-2 pl-3 text-[13px]">
                            <p>
                              <span className="font-medium">{byAgent ? AGENT_NAME : item.actorName || "Гишүүн"}</span>{" "}
                              {byAgent ? "мэдээг орчуулж нэмэв" : (actionText[item.action] ?? item.action)}
                            </p>
                            {item.note && !byAgent ? <p className="text-muted-foreground mt-0.5">“{item.note}”</p> : null}
                            <p className="text-muted-foreground font-mono text-[11px]">{timeAgo(item.at)}</p>
                          </li>
                        )
                      })}
                    </ol>
                  ) : null}
                </section>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-col gap-2 border-t px-5 py-4">
              {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
              {noteOpen ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="review-note" className="text-[13px] font-medium">
                    Зохиогчид юуг засахыг бичнэ үү
                  </label>
                  <textarea id="review-note" autoFocus rows={2} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
                </div>
              ) : null}
              {article && transitions.includes("published") && !noteOpen ? (
                <div className="flex flex-col gap-2 rounded-lg border p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                    <input
                      type="checkbox"
                      checked={scheduleOn}
                      onChange={(event) => setScheduleOn(event.target.checked)}
                      className="accent-foreground size-4"
                    />
                    <CalendarClock className="size-4" />
                    Цаг товлож нийтлэх
                  </label>
                  {scheduleOn ? (
                    <div className="flex flex-col gap-2">
                      <ScheduleDate
                        day={scheduleDay}
                        hour={scheduleHour}
                        minute={scheduleMinute}
                        onDay={setScheduleDay}
                        onHour={setScheduleHour}
                        onMinute={setScheduleMinute}
                      />
                      <p className="text-muted-foreground text-[12px]">
                        {formatWhen(new Date(scheduleAt).toISOString())}-д сайт дээр автоматаар гарна. Тэр хүртэл уншигчид харахгүй.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {article && canDelete(member, article) ? (
                  <button type="button" onClick={remove} className={buttonClass.danger} aria-label="Устгах">
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  {unclaimed ? (
                    <button type="button" disabled={busy} onClick={claim} className={buttonClass.ghost}>
                      <Hand className="size-4" />
                      Би засна
                    </button>
                  ) : null}
                  {noteOpen ? (
                    <>
                      <button type="button" onClick={() => setNoteOpen(false)} className={buttonClass.ghost}>
                        Болих
                      </button>
                      <button type="button" disabled={busy} onClick={() => move("changes_requested")} className={buttonClass.primary}>
                        Засвар хүсэх
                      </button>
                    </>
                  ) : article ? (
                    transitions.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={busy}
                        onClick={() => move(status)}
                        className={status === "published" || status === "approved" || status === "in_review" ? buttonClass.primary : buttonClass.ghost}
                      >
                        {status === "published" && scheduleOn
                          ? "Товлох"
                          : status === "draft" && isScheduled(article)
                            ? "Товлолт цуцлах"
                            : transitionLabel(article.status, status)}
                      </button>
                    ))
                  ) : (
                    <button type="button" disabled={busy} onClick={() => move("in_review")} className={buttonClass.primary}>
                      Хянуулахаар илгээх
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Full-screen preview */}
      {previewOpen ? (
        <div role="dialog" aria-modal="true" aria-label="Урьдчилан харах" className="bg-muted fixed inset-0 z-40 flex flex-col">
          <div className="bg-background flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <p className="text-[13px] font-medium">Урьдчилан харах</p>
            <div className="ml-auto flex items-center gap-1">
              {deviceToggle}
              <button type="button" onClick={() => setPreviewOpen(false)} className={cn(buttonClass.ghost, "ml-2")}>
                Засварлах руу буцах
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div
              className={cn(
                "bg-background mx-auto overflow-hidden border shadow-sm transition-[max-width] duration-300",
                device === "phone" ? "max-w-[402px] rounded-[2rem] border-[6px] border-foreground/80" : "max-w-[1280px] rounded-xl",
              )}
            >
              {preview(deviceWidth)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
