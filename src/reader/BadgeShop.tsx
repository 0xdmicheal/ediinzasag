import { useEffect, useState } from "react"
import { Check, Lock, Sparkles } from "lucide-react"

import { BadgeArt, badges, FOUNDER_LIMIT } from "@/reader/badges"
import { getReaderAuth } from "@/reader/auth"
import { useReader } from "@/reader/session"

/**
 * Badges: trade points for one, then wear it next to your name. The founder
 * badge is free and numbered for the first 3,000 readers. The balance shown
 * is points earned minus points spent; the database re-checks every purchase.
 */
export function BadgeShop({ points }: { points: number }) {
  const { reader, refresh } = useReader()
  const [owned, setOwned] = useState<string[] | null>(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const readerId = reader?.id

  useEffect(() => {
    let cancelled = false
    if (!readerId) return
    getReaderAuth()
      .then((auth) => auth.listBadges())
      .then((ids) => !cancelled && setOwned(ids))
      .catch(() => !cancelled && setOwned([]))
    return () => {
      cancelled = true
    }
  }, [readerId])

  if (!reader) return null
  const founder = reader.memberNo !== null && reader.memberNo <= FOUNDER_LIMIT
  const ownedSet = new Set(owned ?? [])
  const spent = badges.reduce((sum, badge) => sum + (ownedSet.has(badge.id) ? (badge.cost ?? 0) : 0), 0)
  const balance = Math.max(0, points - spent)
  const has = (id: string) => (id === "founder" ? founder : ownedSet.has(id))

  async function run(id: string, task: () => Promise<void>) {
    setBusy(id)
    setError("")
    try {
      await task()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Алдаа гарлаа")
    } finally {
      setBusy("")
    }
  }

  const buy = (id: string) =>
    run(id, async () => {
      const auth = await getReaderAuth()
      await auth.buyBadge(id)
      setOwned((current) => [...(current ?? []), id])
    })

  const wear = (id: string) =>
    run(id, async () => {
      const auth = await getReaderAuth()
      await auth.wearBadge(reader.badge === id ? "" : id)
      await refresh()
    })

  return (
    <section aria-labelledby="badges-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="badges-heading" className="font-news text-2xl">
          Тэмдэг
        </h2>
        <span className="text-muted-foreground text-[13px]">
          Зарцуулах оноо: <strong className="text-foreground tabular-nums">{balance}</strong>
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-[13px]">Оноогоо тэмдгээр солиод нэрийнхээ хажууд зүүгээрэй. Сэтгэгдэл дээр ч харагдана.</p>
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-[color-mix(in_oklch,var(--down)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--down)]">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {badges.map((badge) => {
          const mine = has(badge.id)
          const wearing = reader.badge === badge.id
          const isFounder = badge.id === "founder"
          const affordable = badge.cost !== null && balance >= badge.cost
          return (
            <li
              key={badge.id}
              className={`bg-card relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors ${wearing ? "border-foreground ring-foreground/10 ring-4" : ""} ${isFounder && mine ? "bg-[linear-gradient(160deg,rgb(167_139_250/0.14),rgb(56_189_248/0.1))]" : ""}`}
            >
              {wearing ? (
                <span className="bg-foreground text-background absolute top-2 right-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">Зүүсэн</span>
              ) : null}
              <BadgeArt id={badge.id} size={64} locked={!mine} />
              <span className="text-[14px] font-semibold">{badge.name}</span>
              <span className="text-muted-foreground min-h-8 text-[12px] leading-snug">
                {isFounder && mine && reader.memberNo ? `№${String(reader.memberNo).padStart(4, "0")} / ${FOUNDER_LIMIT.toLocaleString("en-US")}` : badge.description}
              </span>

              {mine ? (
                <button
                  type="button"
                  disabled={busy === badge.id}
                  onClick={() => wear(badge.id)}
                  className={`ez-hit mt-auto inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-colors disabled:opacity-60 ${wearing ? "border-foreground/20 hover:bg-foreground/5 border" : "bg-foreground text-background hover:bg-foreground/85"}`}
                >
                  {wearing ? "Тайлах" : (
                    <>
                      <Check className="size-3.5" />
                      Зүүх
                    </>
                  )}
                </button>
              ) : isFounder ? (
                <span className="text-muted-foreground mt-auto inline-flex h-8 items-center gap-1.5 text-[12px]">
                  <Sparkles className="size-3.5" />
                  Эхний {FOUNDER_LIMIT.toLocaleString("en-US")}-д л
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!affordable || busy === badge.id || owned === null}
                  onClick={() => buy(badge.id)}
                  className="ez-hit border-foreground/20 hover:bg-foreground/5 mt-auto inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full border text-[12px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {affordable ? null : <Lock className="size-3" />}
                  {badge.cost} оноо
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
