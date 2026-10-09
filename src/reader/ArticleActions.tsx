import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { Bookmark, Flame } from "lucide-react"

import { getReaderAuth } from "@/reader/auth"
import { useReader } from "@/reader/session"

export type ActionsLayout = "vertical" | "horizontal"

/** 🔥 total and the reader's own reaction for one story or letter. Call once per page. */
export function useFire(slug: string) {
  const { reader } = useReader()
  const [count, setCount] = useState(0)
  const [mine, setMine] = useState(false)
  const readerId = reader?.id

  useEffect(() => {
    let cancelled = false
    getReaderAuth()
      .then((auth) => auth.getFire(slug))
      .then((value) => {
        if (cancelled) return
        setCount(value.count)
        setMine(value.mine)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug, readerId])

  async function toggle() {
    const on = !mine
    setMine(on)
    setCount((value) => Math.max(0, value + (on ? 1 : -1)))
    try {
      await (await getReaderAuth()).setFire(slug, on)
    } catch {
      setMine(!on)
      setCount((value) => Math.max(0, value + (on ? -1 : 1)))
    }
  }

  return { count, mine, toggle }
}

export type FireState = ReturnType<typeof useFire>

const FIRE_SPARKS = ["#f97316", "#facc15", "#ef4444", "#fb923c", "#fde047", "#f97316", "#f43f5e", "#fbbf24"]

/**
 * 🔥 and save for an article: a sticky column on the left on desktop, a row
 * under the title on phones. Signed-out readers are sent to log in and back.
 */
export function ArticleActions({ slug, fire, layout }: { slug: string; fire: FireState; layout: ActionsLayout }) {
  const { reader, saved, toggleSaved, openLogin } = useReader()
  const isSaved = saved.some((entry) => entry.slug === slug)

  /** False (and the login popup opens) for signed-out readers, so no animation plays. */
  function signedIn() {
    if (reader) return true
    openLogin()
    return false
  }

  return (
    <>
      <Reaction
        layout={layout}
        active={fire.mine}
        label={String(fire.count)}
        count={fire.count}
        ariaLabel={`Гал: ${fire.count}`}
        title={fire.mine ? "Галаа буцаах" : "Гал өгөх"}
        activeTone="text-orange-500 dark:text-orange-400"
        activeSurface="border-orange-500/40 bg-orange-500/10"
        sparks={FIRE_SPARKS}
        enter="ez-pop"
        onToggle={() => {
          if (!signedIn()) return false
          fire.toggle()
          return true
        }}
        icon={(active) => <Flame className={`${layout === "vertical" ? "size-5" : "size-4"} ${active ? "fill-current" : ""}`} />}
      />
      <Reaction
        layout={layout}
        active={isSaved}
        label={isSaved ? "Хадгалсан" : "Хадгалах"}
        ariaLabel="Хадгалах"
        title={isSaved ? "Хадгалснаас хасах" : "Хадгалах"}
        activeTone="text-foreground"
        activeSurface="border-foreground bg-foreground text-background"
        enter="ez-drop"
        onToggle={() => {
          if (!signedIn()) return false
          toggleSaved(slug).catch(() => {})
          return true
        }}
        icon={(active) => <Bookmark className={`${layout === "vertical" ? "size-5" : "size-4"} ${active ? "fill-current" : ""}`} />}
      />
    </>
  )
}

/**
 * One reaction button. Animations only play after the reader's own click
 * (never on page load): the icon pops (or drops), a ring and a burst of sparks
 * fly out, and the count rolls up or down. Each click remounts the animated
 * pieces through `pulse`, so quick repeated taps replay cleanly.
 */
function Reaction({
  layout,
  active,
  label,
  count,
  ariaLabel,
  title,
  activeTone,
  activeSurface,
  sparks,
  enter,
  onToggle,
  icon,
}: {
  layout: ActionsLayout
  active: boolean
  label: string
  /** When set, the label is this number and rolls on change. */
  count?: number
  ariaLabel: string
  title: string
  activeTone: string
  activeSurface: string
  sparks?: string[]
  enter: "ez-pop" | "ez-drop"
  /** Returns false when nothing happened (e.g. sent to log in). */
  onToggle: () => boolean
  icon: (active: boolean) => ReactNode
}) {
  const [pulse, setPulse] = useState(0)
  /** What the last click did; null until the reader clicks. */
  const [last, setLast] = useState<"on" | "off" | null>(null)
  const vertical = layout === "vertical"

  function click() {
    const next = active ? "off" : "on"
    if (!onToggle()) return
    setLast(next)
    setPulse((value) => value + 1)
  }

  const iconClass = last === "on" ? enter : last === "off" ? "ez-unpop" : ""
  const burst =
    last === "on" ? (
      <span key={`burst-${pulse}`} aria-hidden className={`pointer-events-none absolute inset-0 ${activeTone}`}>
        <span className="ez-ring" />
        {(sparks ?? []).map((color, index, all) => (
          <span
            key={index}
            className="ez-spark"
            style={
              {
                background: color,
                "--ez-angle": `${(360 / all.length) * index + 12}deg`,
                "--ez-distance": `${vertical ? -30 : -22 - (index % 2) * 4}px`,
                animationDelay: `${(index % 3) * 18}ms`,
              } as CSSProperties
            }
          />
        ))}
      </span>
    ) : null

  const shownLabel =
    count === undefined ? (
      label
    ) : (
      <span className="inline-flex h-[1.2em] overflow-hidden tabular-nums">
        <span key={`${count}-${pulse}`} className={last === null ? "" : last === "on" ? "ez-roll-up" : "ez-roll-down"}>
          {count}
        </span>
      </span>
    )

  if (vertical) {
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={ariaLabel}
        title={title}
        onClick={click}
        className={`group flex w-14 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-medium transition-colors ${active ? activeTone : "text-muted-foreground hover:text-foreground"}`}
      >
        <span
          className={`relative grid size-11 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-300 active:scale-90 ${active ? activeSurface : "bg-card group-hover:border-foreground/30"}`}
        >
          {burst}
          <span key={`icon-${pulse}`} className={`grid place-items-center ${iconClass}`}>
            {icon(active)}
          </span>
        </span>
        {shownLabel}
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      onClick={click}
      className={`ez-hit relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-300 active:scale-95 ${active ? `${activeSurface} ${activeTone === "text-foreground" ? "" : activeTone}` : "border-foreground/20 hover:bg-foreground/5"}`}
    >
      <span className="relative grid place-items-center">
        {burst}
        <span key={`icon-${pulse}`} className={`grid place-items-center ${iconClass}`}>
          {icon(active)}
        </span>
      </span>
      {shownLabel}
    </button>
  )
}
