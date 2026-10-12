import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { Globe2, Landmark } from "lucide-react"
import { cn } from "cn"

import { MarketDesk, WATCHLIST } from "@/components/site/MarketDesk"
import { signedPct } from "@/components/site/market-marks"
import { parseNumber, YieldCurve } from "@/components/site/market-charts"
import { formatMove, formatValue, money } from "@/components/site/money"
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

      <div ref={rest} className={`${narrow} scroll-mt-14 pt-12 pb-20 sm:pt-16`}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="font-news text-2xl leading-none sm:text-4xl">Тоон мэдээлэл</h2>
            <p className="text-muted-foreground mt-2 text-[14px]">Сүүлийн хаалтын үнэ, эх сурвалж бүртэй. {sessionShort}.</p>
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
/* Pulse: the six numbers, on ink                                      */
/* ------------------------------------------------------------------ */

interface PulseTile {
  id: string
  room: Room
  label: string
  value: string
  unit?: string
  pct: number | null
  note: string
}

function pulseTiles(): PulseTile[] {
  const fromQuote = (id: string): PulseTile => {
    const item = quote(id)!
    const per = item.denom.kind === "money" ? item.denom.per : undefined
    const longer = item.ytd !== undefined ? `Оны эхнээс ${signedPct(item.ytd).replace("-", "−")}` : item.year !== undefined ? `12 сард ${signedPct(item.year).replace("-", "−")}` : item.asOf
    return { id, room: "world", label: friendlyName[id] ?? item.label, value: formatValue(item.price, item.denom), unit: per ? `/ ${per}` : undefined, pct: item.pct, note: longer }
  }
  const mnt = quote("mnt")!
  return [
    { id: "mnt", room: "world", label: "Ам.доллар", value: `${mnt.price}₮`, pct: null, note: `Дунд ханш · ${mnt.asOf.slice(5)}` },
    { id: "top20", room: "mongolia", label: "ТОП-20", value: top20.price, unit: "оноо", pct: top20.pct, note: `1 жилд ${String(top20.year).replace("-", "−")}` },
    fromQuote("copper"),
    fromQuote("coal"),
    fromQuote("gold"),
    fromQuote("brent"),
  ]
}

function Pulse({ onOpen }: { onOpen: (id: string, room: Room) => void }) {
  const tiles = pulseTiles()
  return (
    <section aria-labelledby="markets-title" className="bg-ink text-ink-foreground">
      <div className={`${narrow} pt-8 pb-6 sm:pt-12 sm:pb-8`}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-ink-foreground/55 text-[11px] font-medium tracking-[0.18em] uppercase">Зах зээл · {sessionShort}</p>
            <h1 id="markets-title" className="font-news mt-2 text-[2rem] leading-none sm:text-5xl">
              Өнөөдөр юу хөдөлсөн бэ
            </h1>
          </div>
          <p className="text-ink-foreground/60 max-w-md text-[13px] leading-relaxed">
            Монголын түрийвчинд хамгийн их нөлөөлдөг зургаан тоо. Дарвал доорх EZ Desk-ийн график тэр зах зээл рүү шилжинэ.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 sm:mt-8 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map((tile, index) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => onOpen(tile.id, tile.room)}
              className={cn(
                "group flex min-w-0 flex-col items-start gap-1 border-white/10 p-4 text-left transition-colors hover:bg-white/[0.06] sm:p-5",
                index % 2 === 0 ? "border-r" : "md:border-r",
                index < tiles.length - 2 ? "border-b" : "",
                "md:[&:nth-child(3n)]:border-r-0 md:[&:nth-child(n+4)]:border-b-0 md:[&:nth-child(-n+3)]:border-b xl:[&:nth-child(3n)]:border-r xl:[&:nth-child(n)]:border-b-0 xl:last:border-r-0",
              )}
            >
              <span className="text-ink-foreground/60 flex w-full items-center justify-between gap-2 text-[12px]">
                {tile.label}
                <span className="text-ink-foreground/30 transition-transform group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </span>
              <span className="mt-1 flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-[19px] font-semibold tracking-tight tabular-nums sm:text-[24px]">{tile.value}</span>
                {tile.unit ? <span className="text-ink-foreground/50 shrink-0 text-[11px]">{tile.unit}</span> : null}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
                {tile.pct === null ? null : (
                  <span className={cn("font-mono font-semibold tabular-nums", Math.abs(tile.pct) < 0.005 ? "text-ink-foreground/60" : tile.pct > 0 ? "text-[#4ade80]" : "text-[#f87171]")}>
                    {Math.abs(tile.pct) < 0.005 ? "0.00%" : `${tile.pct > 0 ? "▲" : "▼"} ${signedPct(tile.pct).replace(/^[+-]/, "")}`}
                  </span>
                )}
                <span className="text-ink-foreground/50">{tile.note}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="text-ink-foreground/45 mt-3 text-[11px]">Сүүлийн хаалтын үнэ, шууд ханш биш. Эх сурвалж бүрийг тухайн хэсэгт заасан.</p>
      </div>
    </section>
  )
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
      <SourceLine>Валютын өсөлт нь ам.доллар (эсвэл евро) чангарсныг илтгэнэ. Оны эхний өөрчлөлт байхгүй бол 12 сарынхыг харуулав.</SourceLine>
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

function Glossary() {
  const [open, setOpen] = useState<string | null>(null)
  const current = glossary.find((item) => item.term === open)
  return (
    <section id="glossary" aria-label="Үгийн тайлбар" className="mt-16 scroll-mt-20 border-t pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground mr-1 text-[12px] font-medium">Ойлгомжгүй үг үү?</span>
        {glossary.map((item) => (
          <button
            key={item.term}
            type="button"
            aria-expanded={open === item.term}
            onClick={() => setOpen(open === item.term ? null : item.term)}
            className={cn(
              "h-8 rounded-full border px-3 text-[12.5px] transition-colors",
              open === item.term ? "bg-foreground text-background border-transparent" : "bg-card hover:border-foreground/30",
            )}
          >
            {item.term}
          </button>
        ))}
      </div>
      {current ? <p className="bg-card mt-3 max-w-3xl rounded-xl border p-4 text-[14px] leading-relaxed">{current.text}</p> : null}
      <p className="text-muted-foreground mt-4 text-[11px] leading-relaxed">
        Энэ хуудас нийтийн эх сурвалжийн хаалтын үнийг нэгтгэсэн мэдээлэл. Шууд ханш биш, хөрөнгө оруулалтын зөвлөгөө биш.
      </p>
    </section>
  )
}
