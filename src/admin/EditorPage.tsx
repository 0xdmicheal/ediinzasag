import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Check, ChevronDown, Circle, Eye, ImagePlus, Monitor, Smartphone, Trash2, X } from "lucide-react"
import { cn } from "cn"

import { ArticlePreview } from "@/admin/ArticlePreview"
import { RichEditor } from "@/admin/RichEditor"
import {
  allowedTransitions,
  canDelete,
  canEdit,
  canManageTags,
  formatSources,
  parseSources,
  readiness,
  slugify,
  statusMeta,
  timeAgo,
  transitionLabel,
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
  sources: [],
}

const actionText: Record<string, string> = {
  created: "үүсгэв",
  edited: "засварлав",
  draft: "ноорог руу буцаав",
  in_review: "хянуулахаар илгээв",
  changes_requested: "засвар хүсэв",
  approved: "батлав",
  published: "нийтлэв",
}

const AUTOSAVE_MS = 1500

/**
 * Writing view modelled on Substack: a quiet page with title, subtitle and
 * body; settings, tags and the approval steps live in a side panel opened
 * with "Үргэлжлүүлэх". Saves on its own as you type.
 */
export function EditorPage() {
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
  const [device, setDevice] = useState<"desktop" | "phone">("desktop")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(Boolean(id))
  const [openedAt] = useState(() => new Date().toISOString())
  const coverInput = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    backend.listTags().then(setTags)
  }, [backend])

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
        setArticle(found)
        setDraft({
          slug: found.slug,
          title: found.title,
          dek: found.dek,
          body: bodyToHtml(found.body),
          desk: found.desk,
          tags: found.tags,
          coverUrl: found.coverUrl,
          coverAlt: found.coverAlt,
          sources: found.sources,
        })
        setEditorKey(found.id)
        setSourcesText(formatSources(found.sources))
        setSlugTouched(true)
        setActivity(log)
      })
      .catch((failure: Error) => !cancelled && setMessage({ tone: "error", text: failure.message }))
    return () => {
      cancelled = true
    }
  }, [backend, id])

  const editable = article ? canEdit(member, article) : true
  const checks = useMemo(() => readiness(draft), [draft])
  const required = checks.filter((check) => check.required)
  const requiredOk = required.every((check) => check.ok)
  const transitions = article ? allowedTransitions(member, article) : []

  function update<K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value }
      if (key === "title" && !slugTouched) next.slug = slugify(String(value))
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
    let current = article
    if (dirty || !current) current = await save()
    if (!current) return
    setBusy(true)
    try {
      const next = await backend.setStatus(current.id, status, note.trim())
      setArticle(next)
      setActivity(await backend.listActivity(next.id))
      setNoteOpen(false)
      setNote("")
      setMessage({ tone: "success", text: `${statusMeta[status].label} боллоо` })
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Алдаа гарлаа" })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!article || !window.confirm("Энэ нийтлэлийг бүр мөсөн устгах уу?")) return
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
  const author = article?.authorName || member.name
  const doneCount = required.filter((check) => check.ok).length

  return (
    <div className="bg-background text-foreground min-h-svh">
      {/* Top bar */}
      <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link to="/admin" aria-label="Самбар руу буцах" className="hover:bg-foreground/5 grid size-9 place-items-center rounded-md">
            <ArrowLeft className="size-4" />
          </Link>
          <img src={publicUrl("brand/logo-black.png")} alt="" className="hidden h-5 w-auto sm:block dark:hidden" />
          <img src={publicUrl("brand/logo-white.png")} alt="" className="hidden h-5 w-auto dark:sm:block" />
          {article ? <StatusPill status={article.status} className="hidden sm:inline-flex" /> : null}
          <span className="text-muted-foreground text-[13px]" aria-live="polite">
            {saveText}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setPreviewOpen(true)} className={buttonClass.ghost}>
              <Eye className="size-4" />
              <span className="hidden sm:inline">Урьдчилан харах</span>
            </button>
            <button type="button" onClick={openPanel} className={buttonClass.brand}>
              Үргэлжлүүлэх
            </button>
          </div>
        </div>
      </header>

      {/* Page */}
      <main className="mx-auto max-w-[728px] px-4 pt-10 pb-32 sm:pt-14">
        <div className="mb-6 flex flex-col gap-3 empty:hidden">
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          {article?.status === "changes_requested" && article.reviewNote ? (
            <Notice tone="error">Редакторын тэмдэглэл: “{article.reviewNote}”</Notice>
          ) : null}
          {!editable ? (
            <Notice>
              {article?.status === "in_review"
                ? "Редактор хянаж байна. Засах бол “Үргэлжлүүлэх” → “Ноорог руу буцаах”."
                : "Энэ нийтлэлийг засах эрх танд алга. Зөвхөн уншина."}
            </Notice>
          ) : null}
        </div>

        <label htmlFor="article-title" className="sr-only">
          Гарчиг
        </label>
        <textarea
          id="article-title"
          rows={1}
          disabled={!editable}
          value={draft.title}
          onChange={(event) => {
            update("title", event.target.value.replace(/\n/g, " "))
            event.target.style.height = "auto"
            event.target.style.height = `${event.target.scrollHeight}px`
          }}
          placeholder="Гарчиг"
          className="font-news field-sizing-content w-full resize-none bg-transparent text-[2.25rem] leading-[1.12] outline-none placeholder:text-muted-foreground/40 sm:text-[2.75rem]"
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
          className="text-muted-foreground field-sizing-content mt-3 w-full resize-none bg-transparent text-xl leading-relaxed outline-none placeholder:text-muted-foreground/40"
        />

        <div className="mt-6 mb-8 flex items-center gap-3 border-b pb-6">
          <Avatar name={author} />
          <div className="text-[13px]">
            <p className="font-medium">{author}</p>
            <p className="text-muted-foreground">
              {(article?.publishedAt ?? article?.updatedAt ?? openedAt).slice(0, 10).replace(/-/g, ".")} · {words} үг · {Math.max(1, Math.round(words / 200))} мин унших
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
        />
      </main>

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
                    placeholder="Тайлбар ба эх сурвалж (жишээ: Оюу толгой · Rio Tinto)"
                    className={inputClass}
                  />
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
                      {activity.map((item) => (
                        <li key={item.id} className="border-l-2 pl-3 text-[13px]">
                          <p>
                            <span className="font-medium">{item.actorName || "Гишүүн"}</span> {actionText[item.action] ?? item.action}
                          </p>
                          {item.note ? <p className="text-muted-foreground mt-0.5">“{item.note}”</p> : null}
                          <p className="text-muted-foreground font-mono text-[11px]">{timeAgo(item.at)}</p>
                        </li>
                      ))}
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
              <div className="flex flex-wrap items-center gap-2">
                {article && canDelete(member, article) ? (
                  <button type="button" onClick={remove} className={buttonClass.danger} aria-label="Устгах">
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
                <div className="ml-auto flex flex-wrap justify-end gap-2">
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
                        {transitionLabel(article.status, status)}
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
                  onClick={() => setDevice(key)}
                  className={cn("grid size-9 place-items-center rounded-md", device === key ? "bg-foreground text-background" : "hover:bg-foreground/5")}
                >
                  <Icon className="size-4" />
                </button>
              ))}
              <button type="button" onClick={() => setPreviewOpen(false)} className={cn(buttonClass.ghost, "ml-2")}>
                Засварлах руу буцах
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className={cn("mx-auto overflow-hidden rounded-xl border shadow-sm", device === "phone" ? "max-w-[390px]" : "max-w-[760px]")}>
              <ArticlePreview draft={draft} tags={tags} authorName={author} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
