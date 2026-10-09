import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type TextareaHTMLAttributes } from "react"
import { Link } from "react-router-dom"
import { Check, ChevronDown, MessageSquare, ThumbsUp, X } from "lucide-react"

import { buttonClass, inputClass, Notice } from "@/admin/ui"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { getReaderAuth } from "@/reader/auth"
import { BadgeMark } from "@/reader/badges"
import { ReaderAvatar } from "@/reader/ReaderAvatar"
import { useReader } from "@/reader/session"
import { COMMENT_MAX, type StoryComment } from "@/reader/types"

const linkButton = "text-muted-foreground hover:text-foreground text-[12px] font-medium transition-colors disabled:opacity-50"

function when(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "дөнгөж сая"
  if (minutes < 60) return `${minutes} минутын өмнө`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} цагийн өмнө`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} өдрийн өмнө`
  return new Date(iso).toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" })
}

/**
 * Textarea that grows with its text (up to 60% of the screen, then scrolls),
 * so nobody has to drag it open. Also shrinks back after the text is cleared.
 */
function AutoTextarea({ value, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.height = "auto"
    node.style.height = `${node.scrollHeight + node.offsetHeight - node.clientHeight}px`
  }, [value])
  return <textarea ref={ref} value={value} className={`${className ?? ""} max-h-[60vh] resize-none overflow-y-auto`} {...props} />
}

type Sort = "new" | "liked"

const sorts: { key: Sort; label: string }[] = [
  { key: "new", label: "Шинэ" },
  { key: "liked", label: "Их таалагдсан" },
]

const PAGE = 10

function sortIds(list: StoryComment[], sort: Sort) {
  const newest = (a: StoryComment, b: StoryComment) => b.createdAt.localeCompare(a.createdAt)
  const compare = sort === "liked" ? (a: StoryComment, b: StoryComment) => b.likes - a.likes || newest(a, b) : newest
  return [...list].sort(compare).map((item) => item.id)
}

/**
 * Reader comments under a story or letter. Anyone can read; signed-in readers
 * write and like. The order is fixed when the list loads or the sort changes,
 * so a comment does not jump away while someone is liking it (like Reddit).
 */
export function Comments({ slug, id = "comments" }: { slug: string; id?: string }) {
  const { reader, openLogin } = useReader()
  const [comments, setComments] = useState<StoryComment[] | null>(null)
  const [order, setOrder] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>("new")
  const [shown, setShown] = useState(PAGE)
  const [myLikes, setMyLikes] = useState<Set<string>>(() => new Set())
  const [loadError, setLoadError] = useState(false)
  const [body, setBody] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getReaderAuth()
      .then((auth) => auth.listComments(slug))
      .then((list) => {
        if (cancelled) return
        setComments(list)
        setOrder(sortIds(list, "new"))
        setSort("new")
        setShown(PAGE)
        setLoadError(false)
      })
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [slug])

  const readerId = reader?.id
  useEffect(() => {
    let cancelled = false
    getReaderAuth()
      .then((auth) => (readerId ? auth.listMyLikes(slug) : []))
      .then((ids) => !cancelled && setMyLikes(new Set(ids)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug, readerId])

  function changeSort(next: Sort) {
    setSort(next)
    setOrder(sortIds(comments ?? [], next))
    setShown(PAGE)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const comment = await (await getReaderAuth()).addComment(slug, body)
      setComments((current) => [...(current ?? []), comment])
      // Your own new comment shows first, whatever the sort.
      setOrder((current) => [comment.id, ...current])
      setBody("")
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Илгээж чадсангүй")
    } finally {
      setBusy(false)
    }
  }

  async function toggleLike(comment: StoryComment) {
    const liked = !myLikes.has(comment.id)
    const apply = (on: boolean) => {
      setMyLikes((current) => {
        const next = new Set(current)
        if (on) next.add(comment.id)
        else next.delete(comment.id)
        return next
      })
      setComments((current) =>
        (current ?? []).map((item) => (item.id === comment.id ? { ...item, likes: item.likes + (on ? 1 : -1) } : item)),
      )
    }
    apply(liked)
    try {
      await (await getReaderAuth()).like(comment.id, liked)
    } catch (failure) {
      apply(!liked)
      throw failure
    }
  }

  const byId = new Map((comments ?? []).map((item) => [item.id, item]))
  const ordered = order.flatMap((key) => byId.get(key) ?? [])
  const visible = ordered.slice(0, shown)
  const hidden = ordered.length - visible.length
  const count = comments?.length ?? 0

  return (
    <section id={id} className="mt-12 scroll-mt-24" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="font-news flex items-center gap-2 text-2xl">
        Сэтгэгдэл
        {count > 0 ? <span className="text-muted-foreground font-sans text-[15px] font-normal">{count}</span> : null}
      </h2>

      {reader ? (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <label htmlFor={`${id}-body`} className="sr-only">
            Сэтгэгдэл бичих
          </label>
          <AutoTextarea
            id={`${id}-body`}
            rows={3}
            required
            maxLength={COMMENT_MAX}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Санал бодлоо хуваалцаарай…"
            className={inputClass}
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-[13px]">
                {reader.anonymous ? (
                  <>
                    <strong className="font-semibold italic">Зочин</strong> нэрээр нийтлэгдэнэ
                  </>
                ) : (
                  <>
                    <strong className="font-semibold">{reader.name || "Уншигч"}</strong> нэрээр нийтлэгдэнэ
                  </>
                )}
                {" · "}
                <Link to="/account" state={{ edit: true }} className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
                  солих
                </Link>
              </p>
              <span className="text-muted-foreground text-[12px]">
                {body.length > COMMENT_MAX * 0.8 ? `${body.length}/${COMMENT_MAX}` : "Хүндэтгэлтэй, сэдэвтээ хамааралтай бичнэ үү."}
              </span>
            </div>
            <button type="submit" disabled={busy || !body.trim()} className={`${buttonClass.primary} ml-auto`}>
              {busy ? "Илгээж байна…" : "Нийтлэх"}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-muted/60 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <p className="text-[14px]">Сэтгэгдэл үлдээх, таалагдсаныг тэмдэглэхийн тулд нэвтэрнэ үү.</p>
          <ShimmerButton type="button" onClick={openLogin} className="h-9 px-4 text-[13px] font-medium">
            Нэвтрэх
          </ShimmerButton>
        </div>
      )}

      {loadError ? (
        <p className="text-muted-foreground mt-6 text-[14px]">Сэтгэгдлийг ачаалж чадсангүй.</p>
      ) : comments === null ? (
        <p className="text-muted-foreground mt-6 text-[14px]">Ачаалж байна…</p>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground mt-6 flex items-center gap-2 text-[14px]">
          <MessageSquare className="size-4" />
          Одоогоор сэтгэгдэл алга. Эхнийх нь болоорой.
        </p>
      ) : (
        <>
          <div role="group" aria-label="Эрэмбэлэх" className="mt-6 flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground mr-1 text-[12px]">Эрэмбэ:</span>
            {sorts.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={sort === item.key}
                onClick={() => changeSort(item.key)}
                className={`h-7 rounded-full px-3 text-[12px] font-medium transition-colors ${sort === item.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <ul className="mt-3 divide-y border-t">
            {visible.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                liked={myLikes.has(comment.id)}
                onLike={() => toggleLike(comment)}
                onChange={(next) => setComments((current) => (current ?? []).map((item) => (item.id === next.id ? next : item)))}
                onRemove={() => setComments((current) => (current ?? []).filter((item) => item.id !== comment.id))}
              />
            ))}
          </ul>
          {hidden > 0 ? (
            <button type="button" onClick={() => setShown((value) => value + PAGE)} className={`${buttonClass.ghost} mt-2 w-full`}>
              <ChevronDown className="size-4" />
              Дахин {Math.min(PAGE, hidden)} сэтгэгдэл харах · үлдсэн {hidden}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}

function CommentItem({
  comment,
  liked,
  onLike,
  onChange,
  onRemove,
}: {
  comment: StoryComment
  liked: boolean
  onLike: () => Promise<void>
  onChange: (comment: StoryComment) => void
  onRemove: () => void
}) {
  const { reader } = useReader()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const own = comment.mine
  const shownName = comment.anonymous ? "Зочин" : comment.authorName || "Уншигч"
  const canDelete = own || Boolean(reader?.moderator)

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await task()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Алдаа гарлаа")
    } finally {
      setBusy(false)
    }
  }

  function save(event: FormEvent) {
    event.preventDefault()
    run(async () => {
      onChange(await (await getReaderAuth()).editComment(comment.id, draft))
      setEditing(false)
    })
  }

  function remove() {
    const question = own ? "Сэтгэгдлээ устгах уу?" : `${shownName}-ийн сэтгэгдлийг устгах уу?`
    if (!window.confirm(question)) return
    run(async () => {
      await (await getReaderAuth()).deleteComment(comment.id)
      onRemove()
    })
  }

  return (
    <li className="flex gap-3 py-5">
      <ReaderAvatar name={shownName} avatar={comment.authorAvatar} anonymous={comment.anonymous} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <span className={comment.anonymous ? "text-muted-foreground font-semibold italic" : "font-semibold"}>{shownName}</span>
          {!comment.anonymous && comment.authorBadge ? <BadgeMark id={comment.authorBadge} size={16} /> : null}
          {own ? <span className="bg-foreground/[0.07] text-muted-foreground rounded px-1.5 text-[11px]">Та</span> : null}
          <time dateTime={comment.createdAt} className="text-muted-foreground text-[12px]">
            {when(comment.createdAt)}
          </time>
          {comment.editedAt ? <span className="text-muted-foreground text-[12px]">· засварласан</span> : null}
        </p>
        {editing ? (
          <form onSubmit={save} className="mt-2 flex flex-col gap-2">
            <label htmlFor={`edit-${comment.id}`} className="sr-only">
              Сэтгэгдэл засах
            </label>
            <AutoTextarea
              id={`edit-${comment.id}`}
              rows={3}
              required
              autoFocus
              maxLength={COMMENT_MAX}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !draft.trim() || draft.trim() === comment.body} className={buttonClass.primary}>
                <Check className="size-4" />
                {busy ? "Хадгалж байна…" : "Хадгалах"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setDraft(comment.body)
                  setError("")
                }}
                className={buttonClass.ghost}
              >
                <X className="size-4" />
                Болих
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-1 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{comment.body}</p>
        )}
        {error ? (
          <p role="alert" className="mt-1 text-[12px] text-[var(--down)]">
            {error}
          </p>
        ) : null}
        {!editing ? (
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              aria-pressed={liked}
              aria-label={`Таалагдлаа: ${comment.likes}`}
              title={!reader ? "Нэвтэрч байж тэмдэглэнэ" : own ? "Өөрийн сэтгэгдэл" : liked ? "Буцаах" : "Таалагдлаа"}
              disabled={!reader || own}
              onClick={() => onLike().catch((failure) => setError(failure instanceof Error ? failure.message : "Тэмдэглэж чадсангүй"))}
              className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px] font-medium tabular-nums transition-colors disabled:cursor-default ${liked ? "text-brand-strong bg-brand-soft" : "text-muted-foreground enabled:hover:bg-foreground/5 enabled:hover:text-foreground"}`}
            >
              <ThumbsUp className={`size-3.5 ${liked ? "fill-current" : ""}`} />
              {comment.likes}
            </button>
            {own ? (
              <button type="button" onClick={() => setEditing(true)} className={linkButton}>
                Засах
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" disabled={busy} onClick={remove} className={linkButton}>
                Устгах
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
