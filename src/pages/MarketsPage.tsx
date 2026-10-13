import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { Globe2, Landmark } from "lucide-react"
import { cn } from "cn"

import { MarketDesk, WATCHLIST } from "@/components/site/MarketDesk"
import { signedPct } from "@/components/site/market-marks"
import { parseNumber, YieldCurve } from "@/components/site/market-charts"
import { formatMove, formatValue, money } from "@/components/site/money"
import { loadLiveQuotes, type LiveQuote } from "@/content/live-quotes"
import { friendlyName, glossary, plain, regions, unitHint } from "@/content/market-guide"
import {
  commodities,
  exportMix,
  fridayCloses,
  fridayFlow,
  fx,
  miners,
  mongoliaIndices,
  mongoliaMacro,
  sessionShort,
  sessionStats,
  top20,
  usCurve,
  worldIndices,
  type Quote,
} from "@/content/markets"

/*
 * /markets. The product is EZ Desk (calendar + chart as one tool), right
 * under a "today" band of the six numbers that matter most to a Mongolian
 * reader; tapping a tile points the desk's chart at it. Below the desk, the
 * reference numbers in two rooms: Монгол (TOP-20, macro, exchange) and
 * Дэлхий (all markets at a glance, indices, commodities, currencies).
 * Old links (/markets#copper, #lend, #calendar, #chart) still land right.
 */

const narrow = "mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8"

type Room = "mongolia" | "world"

const rooms: { id: Room; label: string; hint: string; icon: typeof Landmark }[] = [
  { id: "mongolia", label: "Монгол", hint: "ТОП-20, макро, бирж", icon: Landmark },
  { id: "world", label: "Дэлхий", hint: "Индекс, түүхий эд, валют", icon: Globe2 },
]

const allQuotes = [...worldIndices, ...commodities, ...fx]
const quote = (id: string) => allQuotes.find((item) => item.id === id)
const regionOf = (id: string) => regions.find((region) => region.ids.includes(id))?.title ?? ""

/** Which room an old anchor (#copper, #lend, #top20…) belongs to. */
function roomOf(anchor: string): Room | null {
  if (!anchor) return null
  if (anchor === "mongolia" || anchor === "world") return anchor
  if (["top20", "macro", "exports", "exchange"].includes(anchor)) return "mongolia"
  if (mongoliaIndices.some((item) => item.id === anchor) || fridayCloses.some((row) => row.symbol.toLowerCase() === anchor)) return "mongolia"
  if (["performance", "indices", "commodities", "currency"].includes(anchor) || allQuotes.some((item) => item.id === anchor)) return "world"
  return null
}

/** Today-band tiles the desk's chart can show. */
const TILE_CHART: Record<string, string> = {
  mnt: "FX_IDC:USDMNT",
  copper: "OANDA:XCUUSD",
  gold: "OANDA:XAUUSD",
  brent: "TVC:UKOIL",
}

function SourceLine({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed [&_a]:underline">{children}</p>
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MarketsPage() {
  const { hash } = useLocation()
  const anchor = decodeURIComponent(hash.replace(/^#/, "")).toLowerCase()
  const [room, setRoom] = useState<Room>(() => roomOf(anchor) ?? "mongolia")
  const [deskRequest, setDeskRequest] = useState<{ symbol: string; n: number } | null>(null)
  const rest = useRef<HTMLDivElement>(null)

  // Old links: /markets#copper opens the room that holds it; #chart, #calendar, #desk go to the desk.
  useEffect(() => {
    if (["chart", "calendar", "desk"].includes(anchor)) {
      const timer = window.setTimeout(() => document.getElementById("desk")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150)
      return () => window.clearTimeout(timer)
    }
    const target = roomOf(anchor)
    if (!target) return
    setRoom(target)
    const timer = window.setTimeout(() => {
      const node = document.getElementById(anchor)
      ;(node ?? rest.current)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [anchor])

  const openRoom = (next: Room, focus?: string) => {
    setRoom(next)
    window.history.replaceState(null, "", `#${focus ?? next}`)
    window.setTimeout(() => {
      const node = focus ? document.getElementById(focus) : null
      ;(node ?? rest.current)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 60)
  }

  const openTile = (id: string, tileRoom: Room) => {
    const symbol = TILE_CHART[id]
    if (symbol && WATCHLIST.some((item) => item.symbol === symbol)) setDeskRequest({ symbol, n: Date.now() })
    else openRoom(tileRoom, id)
  }

  return (
    <>
      <Pulse onOpen={openTile} />
      <MarketDesk request={deskRequest} />

      <div ref={rest} className={`${narrow} scroll-mt-14 pt-8 pb-20 sm:pt-10`}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="font-news text-2xl leading-none sm:text-4xl">Тоон мэдээлэл</h2>
          </div>
          <nav aria-label="Тоон мэдээллийн хэсэг" className="bg-muted flex gap-1 rounded-full p-1">
            {rooms.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={room === id ? "page" : undefined}
                onClick={() => openRoom(id)}
                title={hint}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium transition-colors",
                  room === id ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
        {room === "mongolia" ? <MongoliaRoom /> : <WorldRoom />}
        <Glossary />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Pulse: the six numbers, on the fixed-dark studio surface           */
/* ------------------------------------------------------------------ */

interface PulseTile {
  id: string
  room: Room
  label: string
  value: string
  unit?: string
  pct: number | null
  note: string
  /** Recent daily closes for the sparkline; empty for the hand-written fallback. */
  spark: number[]
  /** "10.12-ны хаалт" when the price is more than a day and a half old. */
  stale?: string
}

const PULSE_IDS = ["mnt", "top20", "copper", "coal", "gold", "brent"]
const REFRESH_MS = 5 * 60_000

const pctText = (pct: number) => signedPct(pct).replace("-", "−")
const priceText = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n >= 100 ? 2 : 3 })

/** The hand-written closes in content/markets.ts, used until the server job has run. */
function staticTile(id: string): PulseTile {
  if (id === "mnt") {
    const mnt = quote("mnt")!
    return { id, room: "world", label: "Ам.доллар", value: `${mnt.price}₮`, pct: null, note: `Дунд ханш · ${mnt.asOf.slice(5)}`, spark: [] }
  }
  if (id === "top20") return { id, room: "mongolia", label: "ТОП-20", value: top20.price, unit: "оноо", pct: top20.pct, note: `Жилд ${String(top20.year).replace("-", "−")}`, spark: [] }
  const item = quote(id)!
  const per = item.denom.kind === "money" ? item.denom.per : undefined
  const note = item.ytd !== undefined ? `Оны эхнээс ${pctText(item.ytd)}` : item.year !== undefined ? `Жилд ${pctText(item.year)}` : item.asOf
  return { id, room: "world", label: friendlyName[id] ?? item.label, value: formatValue(item.price, item.denom), unit: per ? `/ ${per}` : undefined, pct: item.pct, note, spark: [] }
}

function liveTile(id: string, live: LiveQuote, now: number): PulseTile {
  const base = staticTile(id)
  const value = id === "mnt" ? `${priceText(live.price)}₮` : id === "top20" ? priceText(live.price) : formatValue(priceText(live.price), quote(id)!.denom)
  const note = live.monthPct !== null ? `Сард ${pctText(live.monthPct)}` : live.yearPct !== null ? `Жилд ${pctText(live.yearPct)}` : id === "mnt" ? "Зах зээлийн ханш" : ""
  const asOf = new Date(live.asOf)
  const stale = now - asOf.getTime() > 36 * 3_600_000 ? `${String(asOf.getMonth() + 1).padStart(2, "0")}.${String(asOf.getDate()).padStart(2, "0")}-ны хаалт` : undefined
  return { ...base, value, pct: live.pct, note, spark: live.spark, stale }
}

/** "5 минутын өмнө шинэчлэгдсэн" */
function freshness(updatedAt: number, now: number) {
  const minutes = Math.max(0, Math.round((now - updatedAt) / 60_000))
  if (minutes < 1) return "Дөнгөж сая шинэчлэгдсэн"
  if (minutes < 60) return `${minutes} минутын өмнө шинэчлэгдсэн`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} цагийн өмнө шинэчлэгдсэн`
  return `${Math.round(hours / 24)} хоногийн өмнө шинэчлэгдсэн`
}

/** Live quotes from the server job, re-read every few minutes and when the tab comes back. */
function useLiveQuotes() {
  const [quotes, setQuotes] = useState<LiveQuote[]>([])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let alive = true
    const read = () =>
      loadLiveQuotes().then(
        (rows) => {
          if (!alive) return
          setQuotes(rows)
          setNow(Date.now())
        },
        () => undefined,
      )
    read()
    const timer = window.setInterval(read, REFRESH_MS)
    const tick = window.setInterval(() => setNow(Date.now()), 10_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") read()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])
  return { quotes, now }
}

function Sparkline({ points, tone, className = "h-10 w-full" }: { points: number[]; tone: string; className?: string }) {
  const id = useId().replace(/:/g, "")
  if (points.length < 2) return <div className={className} aria-hidden />
  const low = Math.min(...points)
  const high = Math.max(...points)
  const span = high - low || 1
  const xy = points.map((value, index) => [(index / (points.length - 1)) * 100, 30 - ((value - low) / span) * 26 - 2] as const)
  const line = xy.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ")
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("overflow-visible", className, tone)} aria-hidden>
      <defs>
        <linearGradient id={`spark${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill={`url(#spark${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Pulse({ onOpen }: { onOpen: (id: string, room: Room) => void }) {
  const { quotes, now } = useLiveQuotes()
  const byId = new Map(quotes.map((item) => [item.id, item]))
  const tiles = PULSE_IDS.map((id) => {
    const live = byId.get(id)
    return live ? liveTile(id, live, now) : staticTile(id)
  })
  const updated = quotes.length ? Math.max(...quotes.map((item) => Date.parse(item.updatedAt))) : null

  const clock = ubClock(now)

  return (
    <section aria-labelledby="markets-title" className="bg-studio text-photo-foreground">
      <div className={`${narrow} pt-7 pb-6 sm:pt-9 sm:pb-7`}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-photo-foreground/55 text-[11px] font-medium tracking-[0.18em] uppercase">Зах зээл</p>
            <h1 id="markets-title" className="font-news mt-2 text-[1.75rem] leading-none sm:text-4xl">
              Өнөөдөр юу хөдөлсөн бэ
            </h1>
          </div>
          {/* Date and time in Ulaanbaatar, the reader's clock for every number below. */}
          <div className="flex items-end gap-4">
            <time dateTime={new Date(now).toISOString()} className="text-right">
              <span className="block text-[13px] font-medium">{clock.date}</span>
              <span className="text-photo-foreground/55 mt-0.5 flex items-center justify-end gap-1.5 text-[11.5px]">
                {updated ? <span className="inline-block size-1.5 animate-pulse rounded-full bg-[var(--up-on-studio)]" aria-hidden /> : null}
                {updated ? freshness(updated, now) : sessionShort}
              </span>
            </time>
            <span className="bg-brand text-brand-foreground rounded-lg px-3 py-1.5 font-mono text-[26px] leading-none font-semibold tabular-nums sm:text-[32px]">
              {clock.time}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-[20px] sm:mt-6 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map((tile) => {
            const flat = tile.pct === null || Math.abs(tile.pct) < 0.005
            const trend = tile.spark.length > 1 ? tile.spark[tile.spark.length - 1] - tile.spark[0] : (tile.pct ?? 0)
            const lineTone = trend > 0 ? "text-[var(--up-on-studio)]" : trend < 0 ? "text-[var(--down-on-studio)]" : "text-photo-foreground/40"
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onOpen(tile.id, tile.room)}
                className="group border-photo-foreground/10 bg-photo-foreground/[0.03] hover:bg-photo-foreground/[0.07] grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors"
              >
                <span className="text-photo-foreground/60 truncate text-[11.5px]">{tile.label}</span>
                {tile.pct === null ? (
                  <span />
                ) : (
                  <span className={cn("text-right font-mono text-[11.5px] font-semibold tabular-nums", flat ? "text-photo-foreground/60" : tile.pct > 0 ? "text-[var(--up-on-studio)]" : "text-[var(--down-on-studio)]")}>
                    {flat ? "0.00%" : `${tile.pct > 0 ? "▲" : "▼"} ${signedPct(tile.pct).replace(/^[+-]/, "")}`}
                  </span>
                )}
                <span className="flex min-w-0 items-baseline gap-1">
                  <span className="truncate text-[17px] font-semibold tracking-tight tabular-nums sm:text-[19px]">{tile.value}</span>
                  {tile.unit ? <span className="text-photo-foreground/50 shrink-0 text-[10.5px]">{tile.unit}</span> : null}
                </span>
                <Sparkline points={tile.spark} tone={lineTone} className="row-span-2 h-7 w-14 sm:w-16" />
                <span className="text-photo-foreground/45 truncate text-[10.5px]">{tile.stale ?? tile.note}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const UB_WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"]

/** "Мягмар, 10-р сарын 13" and "20:45" in Ulaanbaatar time. */
function ubClock(ms: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value]),
  )
  const weekday = UB_WEEKDAYS[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)]
  return { date: `${weekday}, ${parts.month}-р сарын ${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/* ------------------------------------------------------------------ */
/* Монгол                                                              */
/* ------------------------------------------------------------------ */

/** Minimal type: a small label above a heading, hairlines instead of boxes. */
function Head({ kicker, title, note }: { kicker?: string; title: string; note?: ReactNode }) {
  return (
    <header className="mb-4">
      {kicker ? <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">{kicker}</p> : null}
      <h3 className="mt-1 text-[18px] leading-tight font-semibold tracking-tight">{title}</h3>
      {note ? <p className="text-muted-foreground mt-1 max-w-2xl text-[13px] leading-relaxed">{note}</p> : null}
    </header>
  )
}

/** "▲ 6.09%" in up/down colour, plain text (no pill). */
function Move({ pct, className }: { pct: number; className?: string }) {
  const flat = Math.abs(pct) < 0.005
  return (
    <span className={cn("font-medium whitespace-nowrap tabular-nums", flat ? "text-muted-foreground" : pct > 0 ? "text-[var(--up)]" : "text-[var(--down)]", className)}>
      {flat ? "0.00%" : `${pct > 0 ? "▲" : "▼"} ${signedPct(pct).replace(/^[+-]/, "")}`}
    </span>
  )
}

function MongoliaRoom() {
  return (
    <div className="flex flex-col gap-16">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 [&>*]:min-w-0">
        <Top20 />
        <Macro />
      </div>
      <Exports />
      <Exchange />
    </div>
  )
}

function Top20() {
  const price = parseNumber(top20.price)
  const month = parseNumber(top20.month)
  const year = parseNumber(top20.year)
  const high = parseNumber(top20.high)
  const belowHigh = ((high - price) / high) * 100
  // 1,000,000₮ grown by the one-year change, rounded to the nearest 100₮.
  const grown = Math.round((1_000_000 * (1 + year / 100)) / 100) * 100

  return (
    <section id="top20" className="scroll-mt-20">
      <Head kicker={`ТОП-20 индекс · ${top20.asOf}`} title="Монголын хамгийн том 20 компани" />
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-[3.25rem] leading-none font-semibold tracking-tight tabular-nums sm:text-[4.25rem]">{top20.price}</span>
        <span className="text-muted-foreground text-sm">оноо</span>
      </p>
      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
        {[
          ["Өнөөдөр", top20.pct],
          ["1 сард", month],
          ["1 жилд", year],
        ].map(([name, pct]) => (
          <div key={name as string} className="flex items-baseline gap-2">
            <dt className="text-muted-foreground text-[12px]">{name}</dt>
            <dd>
              <Move pct={pct as number} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6">
        <div className="bg-foreground/10 h-px">
          <div className="bg-foreground h-[2px] -translate-y-px" style={{ width: `${100 - belowHigh}%` }} />
        </div>
        <p className="text-muted-foreground mt-2 text-[12px]">
          Түүхэн дээд цэг {top20.high} ({top20.highWhen}) хүрэхэд {belowHigh.toFixed(2)}% дутуу.
        </p>
      </div>
      <p className="text-muted-foreground mt-5 border-l-2 pl-3 text-[13px] leading-relaxed">
        Нэг жилийн өмнө 1,000,000₮ хийсэн бол одоо ойролцоогоор <span className="text-foreground font-medium">{money(grown.toLocaleString("en-US"), "MNT")}</span> болох байсан (шимтгэл, ногдол
        ашгийг тооцоогүй).
      </p>
      <SourceLine>
        <a href={top20.href}>{top20.source}</a>
      </SourceLine>
    </section>
  )
}

function Macro() {
  const { inflation, policyRate, reserves } = mongoliaMacro
  const real = policyRate.value - inflation.value
  const cells: { name: string; value: string; note: ReactNode; tone?: string }[] = [
    { name: "Инфляц", value: `${inflation.value}%`, note: <>зорилт {mongoliaMacro.target} · <a href={inflation.href}>{inflation.source}</a></> },
    { name: "Бодлогын хүү", value: `${policyRate.value}%`, note: <a href={policyRate.href}>{policyRate.source}, {policyRate.label}</a> },
    {
      name: "Бодит хүү",
      value: `${real < 0 ? "−" : "+"}${Math.abs(real).toFixed(1)}`,
      tone: real < 0 ? "text-[var(--down)]" : "text-[var(--up)]",
      note: real < 0 ? "хүү инфляцаас доогуур" : "хүү инфляцаас дээгүүр",
    },
    { name: "Валютын нөөц", value: `$${reserves.value} тэрбум`, note: <>{mongoliaMacro.reservesGoal} тэрбумын зорилтын {Math.round((reserves.value / mongoliaMacro.reservesGoal) * 100)}% · <a href={reserves.href}>{reserves.source}</a></> },
  ]
  return (
    <section id="macro" className="scroll-mt-20">
      <Head kicker="Макро" title="Ханшийн ард байгаа дөрвөн тоо" />
      <dl className="grid grid-cols-2 border-t">
        {cells.map((cell, index) => (
          <div key={cell.name} className={cn("border-b py-4", index % 2 === 0 ? "pr-4" : "border-l pl-4")}>
            <dt className="text-muted-foreground text-[12px]">{cell.name}</dt>
            <dd className={cn("mt-1 text-[26px] leading-none font-semibold tracking-tight tabular-nums sm:text-[32px]", cell.tone)}>{cell.value}</dd>
            <dd className="text-muted-foreground mt-2 text-[11px] [&_a]:underline">{cell.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const MIX_COLORS = ["bg-foreground", "bg-foreground/60", "bg-foreground/30", "bg-foreground/15"]

function Exports() {
  const coreShare = Math.round(((exportMix.parts[0].value + exportMix.parts[1].value) / exportMix.total) * 100)
  return (
    <section id="exports" className="scroll-mt-20">
      <Head kicker={`Экспорт · ${exportMix.label}`} title={`$${exportMix.total} тэрбум, жилээр ▲ ${exportMix.growth}%. Зэс, нүүрс хоёр л ${coreShare}%.`} />
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {exportMix.parts.map((part, index) => (
          <span key={part.key} className={MIX_COLORS[index]} style={{ width: `${(part.value / exportMix.total) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
        {exportMix.parts.map((part, index) => (
          <div key={part.key}>
            <dt className="text-muted-foreground flex items-center gap-2 text-[12px]">
              <span className={cn("size-2 rounded-full", MIX_COLORS[index])} />
              {part.label}
            </dt>
            <dd className="mt-1 text-[15px] font-semibold tabular-nums">
              ${part.value} тэрбум
              <span className="text-muted-foreground ml-2 text-[12px] font-normal">
                {Math.round((part.value / exportMix.total) * 100)}%{part.growth !== undefined ? ` · ▲ ${part.growth}%` : ""}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <SourceLine>
        <a href={exportMix.href}>{exportMix.source}</a> · <Link to="/story/reserves-record-september">Нөөцийн тойм</Link>
      </SourceLine>
    </section>
  )
}

function Exchange() {
  const stat = (name: string) => sessionStats.find((item) => item.label === name)?.value ?? ""
  const cap = mongoliaIndices.find((item) => item.id === "cap")
  const otherIndices = mongoliaIndices.filter((item) => item.denom.kind === "index")
  const stocks = [...fridayCloses].sort((a, b) => b.pct - a.pct)
  const maxFlow = Math.max(...fridayFlow.map((row) => parseNumber(row.value)))
  return (
    <section id="exchange" className="scroll-mt-20">
      <Head
        kicker="Монголын хөрөнгийн бирж"
        title="Хувьцаа, арилжаа"
        note={
          <>
            <a className="underline" href={top20.reportHref}>{top20.reportLabel}</a>. Биржийн шинэ тайлан уншигдахуйц хэлбэрээр гараагүй байна.
          </>
        }
      />
      <dl className="mb-8 flex flex-wrap gap-x-10 gap-y-3 border-y py-4">
        {[
          ["Арилжааны дүн", stat("Үнийн дүн")],
          ["Хэлцэл", stat("Хэлцэл")],
          ["Арилжсан компани", stat("Үнэт цаас")],
          ["Биржийн үнэлгээ", cap ? formatValue(cap.price, cap.denom) : ""],
          ...otherIndices.map((item) => [/индекс/i.test(item.label) ? item.label : `${item.label} индекс`, item.price, item.pct] as const),
        ].map(([name, value, pct]) => (
          <div key={name as string}>
            <dt className="text-muted-foreground text-[12px]">{name}</dt>
            <dd className="mt-0.5 flex items-baseline gap-2 text-[17px] font-semibold tabular-nums">
              {value}
              {typeof pct === "number" ? <Move pct={pct} className="text-[12px]" /> : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <table className="w-full text-[14px]">
          <caption className="text-muted-foreground mb-2 text-left text-[12px]">Хаалтын үнэ, өөрчлөлтөөр эрэмбэлэв</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-left text-[11px]">
              <th className="py-2 font-medium">Компани</th>
              <th className="py-2 text-right font-medium">Хаалт</th>
              <th className="py-2 text-right font-medium">Өөрчлөлт</th>
              <th className="hidden py-2 text-right font-medium sm:table-cell">Ширхэг</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((row) => (
              <tr key={row.symbol} id={row.symbol.toLowerCase()} className="target:bg-muted scroll-mt-24 border-b">
                <td className="py-2.5">
                  {row.name} <span className="text-muted-foreground ml-1 font-mono text-[11px]">{row.symbol}</span>
                </td>
                <td className="py-2.5 text-right tabular-nums">{money(row.price, row.currency)}</td>
                <td className="py-2.5 text-right">
                  <Move pct={row.pct} />
                </td>
                <td className="text-muted-foreground hidden py-2.5 text-right tabular-nums sm:table-cell">{row.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <p className="text-muted-foreground mb-2 text-[12px]">Хамгийн их арилжаалагдсан (гар солисон дүн)</p>
          <ol className="border-t">
            {fridayFlow.map((row) => (
              <li key={row.symbol} className="border-b py-2.5">
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="truncate">{row.name}</span>
                  <span className="shrink-0 tabular-nums">{row.value}</span>
                </div>
                <div className="bg-foreground/[0.06] mt-1.5 h-[3px] rounded-full">
                  <div className="bg-foreground/70 h-full rounded-full" style={{ width: `${(parseNumber(row.value) / maxFlow) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <SourceLine>Хаан банк, Худалдаа хөгжлийн банк, Ард санхүүгийн нэгдлийн хаалтын үнэ энэ өдрийн тайланд байхгүй.</SourceLine>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Дэлхий                                                              */
/* ------------------------------------------------------------------ */

const sinceOf = (item: { price: string; prev?: string }) =>
  item.prev ? Math.round(((parseNumber(item.price) - parseNumber(item.prev)) / parseNumber(item.prev)) * 10000) / 100 : undefined

function WorldRoom() {
  return (
    <div className="flex flex-col gap-16">
      <Movers />
      <div className="grid gap-16 xl:grid-cols-2 xl:gap-12 [&>*]:min-w-0">
        <section id="indices" className="scroll-mt-20">
          <Head kicker="Хувьцааны индекс" title="Дэлхийн гол биржүүд" />
          <QuoteTable items={[...worldIndices].sort((a, b) => b.pct - a.pct)} />
          <SourceLine>
            АНУ, Европ, Япон, Шанхай: 10.08-ны хаалт, Hang Seng: 10.09 · <Link to="/story/wall-street-chip-selloff">Чип үйлдвэрлэгчдийн уналтын тойм</Link>
          </SourceLine>
        </section>
        <section id="commodities" className="scroll-mt-20">
          <Head kicker="Түүхий эд" title="Экспорт, шатахууны үнэ эндээс хамаарна" />
          <QuoteTable items={["copper", "coal", "gold", "brent", "wti"].map((id) => quote(id)!)} />
          <SourceLine>
            Зэсийн компаниуд (10.02):{" "}
            {miners.map((row, index) => (
              <span key={row.symbol}>
                {index > 0 ? ", " : ""}
                {row.name} {money(row.price, row.currency)} <Move pct={row.pct} />
              </span>
            ))}
            . Тойм: <Link to="/story/copper-weekly-gain">зэс</Link>, <Link to="/story/brent-hormuz-october">нефть</Link>, <Link to="/story/gold-yields-ease">алт</Link>.
          </SourceLine>
        </section>
      </div>
      <Currency />
    </div>
  )
}

type Period = "since" | "ytd" | "year"

/** Every market, one measure, sorted: a quiet list instead of a heatmap. */
function Movers() {
  const [period, setPeriod] = useState<Period>("since")
  const groupOf = (id: string) =>
    commodities.some((item) => item.id === id) ? "Түүхий эд" : fx.some((item) => item.id === id) ? "Валют" : regionOf(id) || "Индекс"
  const rows = [
    { id: "top20", label: "ТОП-20", group: "Монгол", since: sinceOf(top20), ytd: undefined as number | undefined, year: parseNumber(top20.year) as number | undefined },
    ...allQuotes
      .filter((item) => item.denom.kind !== "percent")
      .map((item) => ({ id: item.id, label: friendlyName[item.id] ?? item.label, group: groupOf(item.id), since: sinceOf(item), ytd: item.ytd, year: item.year })),
  ]
    .map((row) => ({ ...row, value: period === "since" ? row.since : period === "ytd" ? (row.ytd ?? row.year) : (row.year ?? row.ytd) }))
    .filter((row): row is typeof row & { value: number } => row.value !== undefined)
    .sort((a, b) => b.value - a.value)
  const max = Math.max(...rows.map((row) => Math.abs(row.value)))
  const periods: [Period, string][] = [
    ["since", "10.02-оос хойш"],
    ["ytd", "Оны эхнээс"],
    ["year", "12 сард"],
  ]
  return (
    <section id="performance" className="scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Head kicker="Бүх зах зээл нэг дор" title="Юу өсөж, юу унав" />
        <div className="mb-4 flex gap-4 text-[13px]">
          {periods.map(([key, text]) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
              className={cn("border-b-2 pb-1 transition-colors", period === key ? "border-foreground font-medium" : "text-muted-foreground hover:text-foreground border-transparent")}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <ul className="gap-x-12 border-t md:columns-2">
        {rows.map((row) => (
          <li key={row.id} className="grid break-inside-avoid grid-cols-[minmax(0,1fr)_5rem_4.5rem] items-center gap-3 border-b py-2.5 text-[14px]">
            <span className="min-w-0 truncate">
              {row.label} <span className="text-muted-foreground ml-1 text-[11px]">{row.group}</span>
            </span>
            <span className="bg-foreground/[0.06] relative h-[3px] rounded-full" aria-hidden>
              <span
                className={cn("absolute inset-y-0 rounded-full", row.value >= 0 ? "left-1/2 bg-[var(--up)]" : "right-1/2 bg-[var(--down)]")}
                style={{ width: `${(Math.abs(row.value) / max) * 50}%` }}
              />
            </span>
            <Move pct={row.value} className="text-right text-[13px]" />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Name and what it is, price with unit, the day's move. Sources collected under the table. */
function QuoteTable({ items }: { items: (Quote | undefined)[] }) {
  const rows = items.filter((item): item is Quote => Boolean(item))
  const sources = [...new Map(rows.map((item) => [item.source, item.href])).entries()]
  return (
    <>
      <ul className="border-t">
        {rows.map((item) => {
          const per = item.denom.kind === "money" ? item.denom.per : undefined
          const flatNote = item.pct === 0 ? (!/\d/.test(item.move) || item.denom.kind === "percent" ? item.move : "Өөрчлөлтгүй") : ""
          return (
            <li key={item.id} id={item.id} className="target:bg-muted grid scroll-mt-24 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b py-3">
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium">{friendlyName[item.id] ?? item.label}</span>
                <span className="text-muted-foreground block truncate text-[12px]">
                  {plain[item.id]}
                  {per && unitHint[per] ? ` · ${unitHint[per]}` : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[15px] font-semibold whitespace-nowrap tabular-nums">
                  {formatValue(item.price, item.denom)}
                  {per ? <span className="text-muted-foreground ml-1 text-[11px] font-normal">/ {per}</span> : null}
                </span>
                {flatNote ? (
                  <span className="text-muted-foreground block text-[12px]">{flatNote}</span>
                ) : (
                  <span className="block text-[12.5px]">
                    {/\d/.test(item.move) && !item.move.endsWith("%") ? <span className="text-muted-foreground mr-2 tabular-nums">{formatMove(item.move, item.denom)}</span> : null}
                    <Move pct={item.pct} />
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <SourceLine>
        {rows[0]?.asOf} ·{" "}
        {sources.map(([name, href], index) => (
          <span key={name}>
            {index > 0 ? ", " : ""}
            {href ? <a href={href}>{name}</a> : name}
          </span>
        ))}
      </SourceLine>
    </>
  )
}

function Currency() {
  return (
    <section id="currency" className="scroll-mt-20">
      <Head kicker="Валют ба хүү" title="Төгрөг, гол валют, дэлхийн зээлийн хүү" />
      <div className="grid gap-12 xl:grid-cols-2 [&>*]:min-w-0">
        <div>
          <QuoteTable items={fx} />
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-[12px]">АНУ-ын бондын өгөөжийн муруй · {usCurve.asOf}</p>
          <div className="max-w-[520px]">
            <YieldCurve points={usCurve.points} />
          </div>
          <p className="mt-4 text-[14px] leading-relaxed">
            30 жилийн зээл 2 жилийнхээс <strong className="tabular-nums">{(usCurve.points[2].yield - usCurve.points[0].yield).toFixed(2)} нэгжээр</strong> үнэтэй. 10 жилийн
            өгөөж 10.08-нд {usCurve.high10}% хүрч, 2002 оноос хойших дээд түвшинд гарсан. Монголын гадаад зээлийн хүү энэ өгөөж дээр эрсдэлийн нэмэгдэл нэмж тогтдог.
          </p>
          <SourceLine>
            <a href={usCurve.href}>{usCurve.source}</a> · Японы 10 жилийн өгөөж {usCurve.japan10.yield}% · <Link to="/story/treasury-yields-24-year-high">АНУ-ын өгөөжийн тойм</Link>
          </SourceLine>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Тайлбар: small, at the end of every room                             */
/* ------------------------------------------------------------------ */

/**
 * Questions on the left, the answer on the right in a panel as tall as the list,
 * so picking another question never moves the page. One answer is always open.
 */
function Glossary() {
  const [open, setOpen] = useState(glossary[0].term)
  const current = glossary.find((item) => item.term === open) ?? glossary[0]
  const index = glossary.indexOf(current)
  return (
    <section id="glossary" aria-label="Түгээмэл асуулт" className="mt-16 scroll-mt-20 border-t pt-8">
      <Head kicker="Түгээмэл асуулт" title="Ойлгомжгүй зүйл байна уу?" />
      <div className="grid gap-[20px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] [&>*]:min-w-0">
        <ul role="tablist" aria-label="Асуултууд" aria-orientation="vertical" className="bg-card divide-y overflow-hidden rounded-xl border">
          {glossary.map((item, at) => {
            const active = item.term === current.term
            return (
              <li key={item.term}>
                <button
                  type="button"
                  role="tab"
                  id={`faq-${at}`}
                  aria-selected={active}
                  aria-controls="faq-answer"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setOpen(item.term)}
                  onKeyDown={(event) => {
                    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
                    if (!step) return
                    event.preventDefault()
                    const next = (at + step + glossary.length) % glossary.length
                    setOpen(glossary[next].term)
                    document.getElementById(`faq-${next}`)?.focus()
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 border-l-2 px-4 py-3 text-left text-[13.5px] transition-colors",
                    active ? "border-brand bg-blue-100 font-medium dark:bg-blue-800" : "border-transparent hover:bg-foreground/[0.04]",
                  )}
                >
                  <span>{item.term}</span>
                  <span className={cn("shrink-0 transition-transform", active ? "text-brand-strong" : "text-muted-foreground/50")} aria-hidden>
                    →
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {/* Stretches to the list's height (md+); on phones a fixed minimum keeps short answers from jumping. */}
        <div id="faq-answer" role="tabpanel" aria-labelledby={`faq-${index}`} className="bg-card flex min-h-[11rem] flex-col rounded-xl border p-5 sm:p-6">
          <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
            {String(index + 1).padStart(2, "0")} / {String(glossary.length).padStart(2, "0")}
          </p>
          <h3 className="mt-2 text-[18px] leading-snug font-semibold">
            {current.term}
          </h3>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-foreground/85">{current.text}</p>
        </div>
      </div>
    </section>
  )
}
