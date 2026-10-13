import { useEffect, useState } from "react"
import { Check, Lock, Sparkles } from "lucide-react"

import { BadgeArt, badges, FOUNDER_LIMIT, rarityLabel, type Rarity } from "@/reader/badges"
import { getReaderAuth } from "@/reader/auth"
import { useReader } from "@/reader/session"
import type { OwnedBadge, PointGrant } from "@/reader/types"

/** The badges this reader bought (null while loading) and any admin point grants, shared by the shop and the ledger. */
export function useOwnedBadges() {
  const { reader } = useReader()
  const [owned, setOwned] = useState<OwnedBadge[] | null>(null)
  const [grants, setGrants] = useState<PointGrant[]>([])
  const readerId = reader?.id

  useEffect(() => {
    let cancelled = false
    if (!readerId) return
    getReaderAuth()
      .then((auth) => auth.listBadges())
      .then((rows) => !cancelled && setOwned(rows))
      .catch(() => !cancelled && setOwned([]))
    getReaderAuth()
      .then((auth) => auth.listGrants())
      .then((rows) => !cancelled && setGrants(rows))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [readerId])

  return { owned, setOwned, grants }
}

const rarityTone: Record<Rarity, string> = {
  common: "text-slate-500 dark:text-slate-400",
  rare: "text-amber-600 dark:text-amber-400",
  epic: "text-fuchsia-600 dark:text-fuchsia-400",
  legendary: "bg-[linear-gradient(90deg,#ec4899,#8b5cf6,#0ea5e9)] bg-clip-text text-transparent",
}

/**
 * Badges: trade points for one, then wear it next to your name. The founder
 * badge is free and numbered for the first 3,000 readers. The balance is
 * points earned minus points spent; the database re-checks every purchase.
 */
export function BadgeShop({ balance, owned, onBought }: { balance: number; owned: OwnedBadge[] | null; onBought: (badge: OwnedBadge) => void }) {
  const { reader, refresh } = useReader()
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  if (!reader) return null
  const founder = reader.memberNo !== null && reader.memberNo <= FOUNDER_LIMIT
  const ownedSet = new Set((owned ?? []).map((item) => item.id))
  const has = (id: string) => (id === "founder" ? founder : ownedSet.has(id))
  const collected = badges.filter((badge) => has(badge.id)).length

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

  const buy = (id: string, cost: number) =>
    run(id, async () => {
      const auth = await getReaderAuth()
      await auth.buyBadge(id)
      onBought({ id, cost, at: new Date().toISOString() })
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
        <span className="text-muted-foreground text-[13px] tabular-nums">
          {collected} / {badges.length} цуглуулсан
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-[13px]">
        Үлдэгдэл оноогоо тэмдгээр солиод нэрийнхээ хажууд зүүгээрэй. Сэтгэгдэл дээр ч харагдана.
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-[color-mix(in_oklch,var(--down)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--down)]">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {badges.map((badge) => {
          const mine = has(badge.id)
          const wearing = reader.badge === badge.id
          const isFounder = badge.id === "founder"
          const cost = badge.cost ?? 0
          const affordable = badge.cost !== null && balance >= cost
          const share = badge.cost ? Math.min(1, balance / cost) : 0
          return (
            <li
              key={badge.id}
              className={`bg-card relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors ${wearing ? "border-foreground ring-foreground/10 ring-4" : ""}`}
            >
              {wearing ? (
                <span className="bg-foreground text-background absolute top-2 right-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">Зүүсэн</span>
              ) : null}
              <span className={`text-[10.5px] font-semibold tracking-[0.14em] uppercase ${rarityTone[badge.rarity]}`}>{rarityLabel[badge.rarity]}</span>
              <BadgeArt id={badge.id} size={72} locked={!mine} />
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
                  {wearing ? (
                    "Тайлах"
                  ) : (
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
                <div className="mt-auto flex w-full flex-col gap-1.5">
                  {/* How close the balance is to this badge. */}
                  {affordable ? null : (
                    <span className="flex items-center gap-2">
                      <span className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                        <span className="bg-foreground/40 block h-full rounded-full" style={{ width: `${share * 100}%` }} />
                      </span>
                      <span className="text-muted-foreground font-mono text-[10.5px] tabular-nums">−{(cost - balance).toLocaleString("en-US")}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!affordable || busy === badge.id || owned === null}
                    onClick={() => buy(badge.id, cost)}
                    className={`ez-hit inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed ${affordable ? "bg-foreground text-background hover:bg-foreground/85" : "border-foreground/20 border opacity-60"}`}
                  >
                    {affordable ? null : <Lock className="size-3" />}
                    {cost.toLocaleString("en-US")} оноо
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
