import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"

import { canManageTags, slugify } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { buttonClass, inputClass, Notice } from "@/admin/ui"
import type { Article, Tag } from "@/admin/types"

export function TagsPage() {
  const { backend, member } = useTeam()
  const [tags, setTags] = useState<Tag[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [label, setLabel] = useState("")
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null)

  useEffect(() => {
    Promise.all([backend.listTags(), backend.listArticles()]).then(([tagList, list]) => {
      setTags(tagList)
      setArticles(list)
    })
  }, [backend])

  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    articles.forEach((article) => article.tags.forEach((slug) => counts.set(slug, (counts.get(slug) ?? 0) + 1)))
    return counts
  }, [articles])

  if (!canManageTags(member)) return <Navigate to="/admin" replace />

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!label.trim()) return
    try {
      const tag = await backend.createTag(label)
      setTags((current) => (current.some((item) => item.slug === tag.slug) ? current : [...current, tag]))
      setLabel("")
      setMessage({ tone: "success", text: `#${tag.label} нэмэгдлээ` })
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Нэмж чадсангүй" })
    }
  }

  async function rename(tag: Tag, next: string) {
    if (!next.trim() || next.trim() === tag.label) return
    await backend.renameTag(tag.slug, next)
    setTags((current) => current.map((item) => (item.slug === tag.slug ? { ...item, label: next.trim() } : item)))
  }

  async function remove(tag: Tag) {
    const count = usage.get(tag.slug) ?? 0
    if (!window.confirm(count ? `#${tag.label} ${count} нийтлэлд байна. Устгах уу?` : `#${tag.label} устгах уу?`)) return
    await backend.deleteTag(tag.slug)
    setTags((current) => current.filter((item) => item.slug !== tag.slug))
  }

  const sorted = [...tags].sort((a, b) => (usage.get(b.slug) ?? 0) - (usage.get(a.slug) ?? 0) || a.label.localeCompare(b.label))
  const max = Math.max(1, ...sorted.map((tag) => usage.get(tag.slug) ?? 0))

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <p className="text-muted-foreground font-mono text-[11px] uppercase">Ангилал</p>
        <h1 className="font-news mt-1 text-3xl">Шошго</h1>
        <p className="text-muted-foreground mt-1 text-[14px]">Шошго бүр сайт дээр өөрийн хуудастай: /tag/хаяг. Нэрийг дарж засна.</p>
      </header>

      <form onSubmit={create} className="flex gap-2">
        <label htmlFor="new-tag" className="sr-only">
          Шинэ шошго
        </label>
        <input id="new-tag" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Шинэ шошгоны нэр, жишээ: Төсөв" className={inputClass} />
        <button type="submit" className={buttonClass.primary}>
          <Plus className="size-4" />
          Нэмэх
        </button>
      </form>
      {label ? <p className="text-muted-foreground -mt-4 font-mono text-[12px]">/tag/{slugify(label) || "…"}</p> : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <ul className="bg-card divide-y rounded-xl border">
        {sorted.map((tag) => {
          const count = usage.get(tag.slug) ?? 0
          return (
            <li key={tag.slug} className="flex items-center gap-3 px-4 py-3">
              <span className="text-muted-foreground font-mono text-[13px]">#</span>
              <input
                aria-label={`${tag.label} нэр`}
                defaultValue={tag.label}
                onBlur={(event) => rename(tag, event.target.value)}
                className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[14px] font-medium outline-none focus:ring-2 focus:ring-brand/20"
              />
              <span className="text-muted-foreground hidden font-mono text-[11px] sm:block">{tag.slug}</span>
              <span className="flex w-28 items-center gap-2" title={`${count} нийтлэл`}>
                <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                  <span className="bg-brand block h-full rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <span className="text-muted-foreground w-6 text-right font-mono text-[12px]">{count}</span>
              </span>
              <button type="button" aria-label={`${tag.label} устгах`} onClick={() => remove(tag)} className={buttonClass.danger}>
                <Trash2 className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
