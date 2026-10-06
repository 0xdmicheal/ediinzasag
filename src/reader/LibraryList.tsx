import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Bookmark, CheckCheck, ChevronDown, X } from "lucide-react"

import { buttonClass } from "@/admin/ui"
import type { LibraryItem } from "@/reader/library-items"
import { useReader } from "@/reader/session"
import type { LibraryEntry } from "@/reader/types"

/*
 * Saved / read lists that stay manageable as they grow: newest first, grouped
 * by when (today, this week, this month, then by month), 8 at a time with
 * "show more", a stories/articles filter once the list is long, and on the
 * saved list a way to clear what has already been read.
 */

const PAGE = 8
const TOOLS_FROM = PAGE

type Kind = "all" | "story" | "letter"

const kinds: { id: Kind; label: string }[] = [
  { id: "all", label: "Бүгд" },
  { id: "story", label: "Тойм" },
  { id: "letter", label: "Нийтлэл" },
]

const isLetter = (key: string) => key.startsWith("letter-")

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Group label for a date, relative to now. */
function bucket(iso: string, now = new Date()) {
  const at = new Date(iso)
  const today = startOfDay(now)
  const day = startOfDay(at)
  if (day === today) return "Өнөөдөр"
  if (today - day < 7 * 864e5) return "Энэ долоо хоног"
  if (at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth()) return "Энэ сар"
  return `${at.getFullYear()} оны ${at.getMonth() + 1}-р сар`
}

export function LibraryList({
  mode,
  entries,
  items,
  empty,
}: {
  mode: "saved" | "read"
  entries: LibraryEntry[]
  items: Map<string, LibraryItem>
  empty: string
}) {
  const { reads, toggleSaved } = useReader()
  const [kind, setKind] = useState<Kind>("all")
  const [shown, setShown] = useState(PAGE)
  const [clearing, setClearing] = useState(false)

  const readKeys = useMemo(() => new Set(reads.map((entry) => entry.slug)), [reads])

  const rows = useMemo(
    () =>
      entries
        .flatMap((entry) => {
          const item = items.get(entry.slug)
          return item ? [{ entry, item }] : []
        })
        .sort((a, b) => b.entry.at.localeCompare(a.entry.at)),
    [entries, items],
  )

  const filtered = useMemo(() => rows.filter(({ item }) => kind === "all" || (kind === "letter") === isLetter(item.key)), [rows, kind])

  const visible = filtered.slice(0, shown)
  const hidden = filtered.length - visible.length
  const groups = visible.reduce<{ label: string; rows: typeof visible }[]>((list, row) => {
    const label = bucket(row.entry.at)
    const last = list[list.length - 1]
    if (last?.label === label) last.rows.push(row)
    else list.push({ label, rows: [row] })
    return list
  }, [])

  const savedAndRead = mode === "saved" ? rows.filter(({ item }) => readKeys.has(item.key)) : []

  async function clearRead() {
    setClearing(true)
    try {
      for (const { item } of savedAndRead) await toggleSaved(item.key)
    } finally {
      setClearing(false)
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-[14px]">
        <Bookmark className="size-4 shrink-0" />
        {empty}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.length > TOOLS_FROM ? (
        <div role="radiogroup" aria-label="Төрөл" className="bg-muted inline-flex w-fit gap-1 rounded-full p-1">
          {kinds.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={kind === item.id}
              onClick={() => {
                setKind(item.id)
                setShown(PAGE)
              }}
              className={`h-7 rounded-full px-3 text-[12px] font-medium transition-colors ${kind === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {savedAndRead.length > 0 ? (
        <div className="bg-muted/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <p className="text-muted-foreground flex items-center gap-2 text-[13px]">
            <CheckCheck className="size-4 shrink-0" />
            Хадгалснаас {savedAndRead.length} нь уншигдсан
          </p>
          <button
            type="button"
            disabled={clearing}
            onClick={clearRead}
            className="text-foreground text-[13px] font-semibold underline-offset-2 hover:underline disabled:opacity-50"
          >
            {clearing ? "Хасаж байна…" : "Уншсаныг жагсаалтаас хасах"}
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-[14px]">Илэрц алга.</p>
      ) : (
        groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h3 className="text-muted-foreground mb-1 font-mono text-[11px] uppercase">{group.label}</h3>
            <ul className="divide-y">
              {group.rows.map(({ item }) => (
                <li key={item.key} className="group flex items-center gap-3">
                  <Link to={item.href} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 sm:gap-4">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        loading="lazy"
                        referrerPolicy={item.imageReferrer ? "no-referrer" : undefined}
                        className="aspect-[16/10] w-20 shrink-0 rounded-md border object-cover sm:w-24"
                      />
                    ) : (
                      <span className="bg-muted aspect-[16/10] w-20 shrink-0 rounded-md border sm:w-24" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="text-muted-foreground flex items-center gap-2 text-[12px]">
                        <span className="truncate">{item.meta}</span>
                        {mode === "saved" && readKeys.has(item.key) ? (
                          <span className="bg-foreground/[0.07] inline-flex shrink-0 items-center gap-1 rounded px-1.5 text-[11px]">
                            <CheckCheck className="size-3" />
                            Уншсан
                          </span>
                        ) : null}
                      </span>
                      <span className="font-news line-clamp-2 block text-[15px] leading-snug group-hover:underline sm:text-[16px]">{item.title}</span>
                    </span>
                  </Link>
                  {mode === "saved" ? (
                    <button
                      type="button"
                      aria-label={`${item.title}: хадгалснаас хасах`}
                      title="Хадгалснаас хасах"
                      onClick={() => toggleSaved(item.key).catch(() => {})}
                      className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 grid size-9 shrink-0 place-items-center rounded-full transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {hidden > 0 ? (
        <button type="button" onClick={() => setShown((value) => value + PAGE)} className={`${buttonClass.ghost} w-full`}>
          <ChevronDown className="size-4" />
          Дахин {Math.min(PAGE, hidden)} харах · үлдсэн {hidden}
        </button>
      ) : null}
    </div>
  )
}
