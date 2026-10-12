import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { CalendarDays, CandlestickChart, Globe2, Landmark } from "lucide-react"
import { cn } from "cn"

import { MarketCalendar } from "@/components/site/MarketCalendar"
import { MarketTerminal } from "@/components/site/MarketTerminal"
import { signedPct } from "@/components/site/market-marks"
import {
  ChangePill,
  ExportMix,
  IndexRanking,
  parseNumber,
  PerformanceChart,
  StockExplorer,
  ValueBars,
  YieldCurve,
  type PerformanceRow,
} from "@/components/site/market-charts"
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
} from "@/content/markets"

/*
 * /markets: one "today" band with the six numbers that matter most to a
 * Mongolian reader, then four rooms instead of one long scroll:
 * Монгол (TOP-20, macro, exchange), Дэлхий (all markets at a glance, indices,
 * commodities, currencies), Календарь, График. Old links such as
 * /markets#copper or /markets#calendar open the right room and scroll to it.
 */

const narrow = "mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8"

type Room = "mongolia" | "world" | "calendar" | "chart"

const rooms: { id: Room; label: string; hint: string; icon: typeof Landmark }[] = [
  { id: "mongolia", label: "Монгол", hint: "ТОП-20, макро, бирж", icon: Landmark },
  { id: "world", label: "Дэлхий", hint: "Индекс, түүхий эд, валют", icon: Globe2 },
  { id: "calendar", label: "Календарь", hint: "Мэдээ, ашгийн тайлан", icon: CalendarDays },
  { id: "chart", label: "График", hint: "Шууд график", icon: CandlestickChart },
]

const allQuotes = [...worldIndices, ...commodities, ...fx]
const quote = (id: string) => allQuotes.find((item) => item.id === id)
const regionOf = (id: string) => regions.find((region) => region.ids.includes(id))?.title ?? ""

/** Which room an old anchor (#copper, #lend, #top20, #calendar…) belongs to. */
function roomOf(anchor: string): Room | null {
  if (!anchor) return null
  if ((rooms.map((room) => room.id) as string[]).includes(anchor)) return anchor as Room
  if (["top20", "macro", "exports", "exchange", "glossary"].includes(anchor)) return "mongolia"
  if (mongoliaIndices.some((item) => item.id === anchor) || fridayCloses.some((row) => row.symbol.toLowerCase() === anchor)) return "mongolia"
  if (["performance", "indices", "commodities", "currency"].includes(anchor) || allQuotes.some((item) => item.id === anchor)) return "world"
  return null
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground mt-1 max-w-2xl text-[14px] leading-relaxed">{children}</p>
}

/** A titled block inside a room: small heading, one-line lead, then content. */
function Block({ id, title, lead, aside, children, className }: { id?: string; title: string; lead?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-40", className)}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[19px] leading-tight font-semibold tracking-tight sm:text-[22px]">{title}</h3>
          {lead ? <Lead>{lead}</Lead> : null}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
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
  const bar = useRef<HTMLDivElement>(null)

  // A link such as /markets#copper opens the room that holds it and scrolls there.
  useEffect(() => {
    const target = roomOf(anchor)
    if (!target) return
    setRoom(target)
    const timer = window.setTimeout(() => {
      const node = document.getElementById(anchor)
      if (node && !(rooms.map((item) => item.id) as string[]).includes(anchor)) node.scrollIntoView({ behavior: "smooth", block: "start" })
      else bar.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [anchor])

  const open = (next: Room, focus?: string) => {
    setRoom(next)
    window.history.replaceState(null, "", `#${focus ?? next}`)
    window.setTimeout(() => {
      const node = focus ? document.getElementById(focus) : null
      if (node) node.scrollIntoView({ behavior: "smooth", block: "start" })
      else if (bar.current && bar.current.getBoundingClientRect().top < 0) bar.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 60)
  }

  return (
    <>
      <Pulse onOpen={open} />

      <div ref={bar} className="bg-background/90 sticky top-14 z-30 scroll-mt-14 border-b backdrop-blur-md">
        <nav aria-label="Зах зээлийн хэсгүүд" className={`${narrow} grid grid-cols-4 gap-1 py-2 sm:flex sm:gap-2`}>
          {rooms.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={room === id ? "page" : undefined}
              onClick={() => open(id)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-center transition-colors sm:flex-row sm:gap-2.5 sm:px-3.5 sm:py-2 sm:text-left",
                room === id ? "bg-foreground text-background" : "hover:bg-foreground/[0.05] text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={2} />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold sm:text-[14px]">{label}</span>
                <span className={cn("hidden text-[11px] leading-tight md:block", room === id ? "opacity-70" : "")}>{hint}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className={`${narrow} pt-8 pb-20 sm:pt-10`}>
        {room === "mongolia" ? <MongoliaRoom /> : null}
        {room === "world" ? <WorldRoom /> : null}
        {room === "calendar" ? <MarketCalendar /> : null}
        {room === "chart" ? <MarketTerminal /> : null}
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
    { id: "mnt", room: "world", label: "Ам.доллар", value: `${mnt.price}₮`, pct: null, note: `Дунд ханш · ${mnt.asOf.slice(5).replace(".", ".")}` },
    { id: "top20", room: "mongolia", label: "ТОП-20", value: top20.price, unit: "оноо", pct: top20.pct, note: `1 жилд ${String(top20.year).replace("-", "−")}` },
    fromQuote("copper"),
    fromQuote("coal"),
    fromQuote("gold"),
    fromQuote("brent"),
  ]
}

function Pulse({ onOpen }: { onOpen: (room: Room, focus?: string) => void }) {
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
            Монголын түрийвчинд хамгийн их нөлөөлдөг зургаан тоо. Дарвал дэлгэрэнгүй нь нээгдэнэ.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 sm:mt-8 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map((tile, index) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => onOpen(tile.room, tile.id)}
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

function MongoliaRoom() {
  return (
    <div className="flex flex-col gap-14">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] [&>*]:min-w-0">
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
    <section id="top20" className="bg-card flex scroll-mt-40 flex-col rounded-xl border p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[19px] font-semibold tracking-tight sm:text-[22px]">ТОП-20 индекс</h3>
          <p className="text-muted-foreground text-[13px]">Монголын хамгийн том 20 компанийн хувьцааны дундаж</p>
        </div>
        <span className="text-muted-foreground font-mono text-[11px]">{top20.asOf}</span>
      </div>

      <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="text-[2.6rem] leading-none font-semibold tracking-tight tabular-nums sm:text-6xl">{top20.price}</span>
        <span className="text-muted-foreground text-sm">оноо</span>
        <ChangePill pct={top20.pct} size="lg" />
      </p>

      <dl className="mt-6 grid grid-cols-3 divide-x rounded-lg border">
        {[
          ["Өнөөдөр", top20.pct],
          ["1 сард", month],
          ["1 жилд", year],
        ].map(([label, pct]) => (
          <div key={label as string} className="px-3 py-3 sm:px-4">
            <dt className="text-muted-foreground text-[11px]">{label}</dt>
            <dd className={cn("mt-0.5 text-[15px] font-semibold tabular-nums sm:text-lg", (pct as number) > 0 ? "text-[var(--up)]" : (pct as number) < 0 ? "text-[var(--down)]" : "")}>
              {(pct as number) > 0 ? "▲ " : (pct as number) < 0 ? "▼ " : ""}
              {signedPct(pct as number).replace(/^[+-]/, "")}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5">
        <div className="flex justify-between text-[12px]">
          <span className="text-muted-foreground">Түүхэн дээд цэгээс</span>
          <span className="font-medium">{belowHigh.toFixed(2)}% доогуур</span>
        </div>
        <div className="bg-foreground/10 relative mt-2 h-2 rounded-full">
          <div className="bg-brand h-full rounded-full" style={{ width: `${100 - belowHigh}%` }} />
        </div>
        <p className="text-muted-foreground mt-1.5 text-[11px]">
          Дээд цэг {top20.high} оноо, {top20.highWhen}
        </p>
      </div>

      <p className="bg-muted/60 mt-5 rounded-lg p-4 text-[13.5px] leading-relaxed">
        Нэг жилийн өмнө ТОП-20-д <strong>1,000,000₮</strong> хийсэн бол одоо ойролцоогоор <strong>{money(grown.toLocaleString("en-US"), "MNT")}</strong> болох байсан.
        <span className="text-muted-foreground block text-[11px]">Жишээ. Шимтгэл, ногдол ашгийг тооцоогүй.</span>
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
  const share = Math.round((reserves.value / mongoliaMacro.reservesGoal) * 100)
  const cells: { label: string; value: ReactNode; note: ReactNode; tone?: string }[] = [
    { label: "Инфляц, жилээр", value: `${inflation.value}%`, note: <>Зорилт {mongoliaMacro.target} · <a href={inflation.href}>{inflation.source}</a></> },
    { label: "Бодлогын хүү", value: `${policyRate.value}%`, note: <a href={policyRate.href}>{policyRate.source}, {policyRate.label}</a> },
    {
      label: "Бодит хүү",
      value: `${real < 0 ? "−" : "+"}${Math.abs(real).toFixed(1)} нэгж`,
      tone: real < 0 ? "text-[var(--down)]" : "text-[var(--up)]",
      note: real < 0 ? "Хүү инфляцаас доогуур: хадгаламж бодитоор үнэ цэнээ алдаж байна." : "Хүү инфляцаас дээгүүр: хадгаламж бодитоор өсөж байна.",
    },
    {
      label: "Валютын нөөц",
      value: `${reserves.value} тэрбум $`,
      note: (
        <>
          <span className="bg-foreground/10 mb-1.5 block h-1.5 overflow-hidden rounded-full" aria-hidden>
            <span className="bg-brand block h-full rounded-full" style={{ width: `${share}%` }} />
          </span>
          {mongoliaMacro.reservesGoal} тэрбумын зорилтын {share}% · <a href={reserves.href}>{reserves.source}</a>
        </>
      ),
    },
  ]
  return (
    <section id="macro" className="flex scroll-mt-40 flex-col">
      <h3 className="text-[19px] font-semibold tracking-tight sm:text-[22px]">Макро</h3>
      <Lead>Ханш, хувьцааны ард байгаа дөрвөн тоо.</Lead>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {cells.map((cell) => (
          <div key={cell.label} className="bg-card flex flex-col rounded-xl border p-4 sm:p-5">
            <dt className="text-muted-foreground text-[12px]">{cell.label}</dt>
            <dd className={cn("mt-1 text-[22px] font-semibold tracking-tight tabular-nums sm:text-[28px]", cell.tone)}>{cell.value}</dd>
            <dd className="text-muted-foreground mt-2 text-[11px] leading-snug [&_a]:underline">{cell.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Exports() {
  const usdMnt = quote("mnt")
  const coreShare = Math.round(((exportMix.parts[0].value + exportMix.parts[1].value) / exportMix.total) * 100)
  return (
    <Block
      id="exports"
      title="Экспорт юунаас бүрдэв"
      lead={`${exportMix.label}: нийт ${exportMix.total} тэрбум $, жилээр ▲ ${exportMix.growth}%. Зэс, нүүрс хоёр л ${coreShare}%.`}
    >
      <div className="bg-card rounded-xl border p-5 sm:p-6">
        <ExportMix parts={exportMix.parts} total={exportMix.total} />
        <SourceLine>
          Тиймээс зэс, нүүрсний үнэ валютын нөөц, төсөвт шууд нөлөөлнө.{usdMnt ? ` Төгрөг ам.доллартай ${usdMnt.price} (${usdMnt.asOf}).` : ""} Эх сурвалж:{" "}
          <a href={exportMix.href}>{exportMix.source}</a> · <Link to="/story/reserves-record-september">Нөөцийн тойм</Link>
        </SourceLine>
      </div>
    </Block>
  )
}

function Exchange() {
  const stat = (label: string) => sessionStats.find((item) => item.label === label)?.value ?? ""
  const cap = mongoliaIndices.find((item) => item.id === "cap")
  const otherIndices = mongoliaIndices.filter((item) => item.denom.kind === "index")
  return (
    <Block
      id="exchange"
      title="Монголын хөрөнгийн бирж"
      lead={
        <>
          Хувьцаа, арилжааны дүн нь <a className="underline" href={top20.reportHref}>{top20.reportLabel}</a>. Биржийн шинэ тайлан уншигдахуйц хэлбэрээр гараагүй байна.
        </>
      }
    >
      <dl className="bg-card mb-4 grid grid-cols-2 divide-y rounded-xl border sm:grid-cols-4 sm:divide-x sm:divide-y-0 [&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-r-0">
        {[
          ["Арилжааны дүн", stat("Үнийн дүн")],
          ["Хэлцэл", stat("Хэлцэл")],
          ["Арилжсан компани", stat("Үнэт цаас")],
          ["Биржийн үнэлгээ", cap ? formatValue(cap.price, cap.denom) : ""],
        ].map(([label, figure]) => (
          <div key={label} className="px-4 py-3 sm:px-5 sm:py-4">
            <dt className="text-muted-foreground text-[12px]">{label}</dt>
            <dd className="mt-0.5 text-[17px] font-semibold tracking-tight tabular-nums sm:text-xl">{figure}</dd>
          </div>
        ))}
      </dl>

      <StockExplorer rows={fridayCloses} reportHref={top20.reportHref} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="bg-card rounded-xl border p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-semibold">Хамгийн их арилжаалагдсан</h4>
            <p className="text-muted-foreground text-xs">Нэг өдөрт гар солисон дүн</p>
          </div>
          <div className="mt-4">
            <ValueBars rows={fridayFlow.map((row) => ({ key: row.symbol, name: row.name, value: row.value, weight: parseNumber(row.value) }))} />
          </div>
          <SourceLine>Хаан банк, Худалдаа хөгжлийн банк, Ард санхүүгийн нэгдлийн хаалтын үнэ энэ өдрийн тайланд байхгүй.</SourceLine>
        </div>
        <ul className="bg-card divide-y self-start rounded-xl border">
          {otherIndices.map((item) => (
            <li key={item.id} id={item.id} className="target:bg-muted flex scroll-mt-40 items-center justify-between gap-3 px-5 py-4">
              <span>
                <span className="text-muted-foreground block text-[12px]">{/индекс/i.test(item.label) ? item.label : `${item.label} индекс`}</span>
                <span className="mt-0.5 block text-lg font-semibold tabular-nums">
                  {item.price} <span className="text-muted-foreground font-sans text-xs font-normal">оноо</span>
                </span>
              </span>
              <ChangePill pct={item.pct} />
            </li>
          ))}
        </ul>
      </div>
    </Block>
  )
}

/* ------------------------------------------------------------------ */
/* Дэлхий                                                              */
/* ------------------------------------------------------------------ */

const sinceOf = (item: { price: string; prev?: string }) =>
  item.prev ? Math.round(((parseNumber(item.price) - parseNumber(item.prev)) / parseNumber(item.prev)) * 10000) / 100 : undefined

function WorldRoom() {
  return (
    <div className="flex flex-col gap-14">
      <Performance />
      <div className="grid gap-14 xl:grid-cols-2 xl:gap-8 [&>*]:min-w-0">
        <Block
          id="indices"
          title="Хувьцааны индекс"
          lead="Сүүлийн өдрийн өөрчлөлтөөр эрэмбэлэв."
        >
          <IndexRanking quotes={worldIndices} describe={(id) => plain[id] ?? ""} region={regionOf} />
          <SourceLine>
            АНУ, Европ, Япон, Шанхай: 10.08-ны хаалт. Hang Seng: 10.09. <Link to="/story/wall-street-chip-selloff">Чип үйлдвэрлэгчдийн уналтын тойм</Link>
          </SourceLine>
        </Block>
        <Block id="commodities" title="Түүхий эд" lead="Монголын экспортын орлого, шатахууны үнэ эндээс хамаарна. Бүгд ам.доллараар.">
          <QuoteBoard ids={["copper", "coal", "gold", "brent", "wti"]} />
          <SourceLine>
            Зэсийн компаниуд (10.02):{" "}
            {miners.map((row, index) => (
              <span key={row.symbol}>
                {index > 0 ? " · " : ""}
                {row.name} {money(row.price, row.currency)}{" "}
                <span className={row.pct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>
                  {row.pct >= 0 ? "▲" : "▼"} {row.move.replace(/^[+-]/, "")}
                </span>
              </span>
            ))}
            . Тойм: <Link to="/story/copper-weekly-gain">зэс</Link>, <Link to="/story/brent-hormuz-october">нефть</Link>, <Link to="/story/gold-yields-ease">алт</Link>.
          </SourceLine>
        </Block>
      </div>
      <Currency />
    </div>
  )
}

function Performance() {
  const groupOf = (id: string) =>
    commodities.some((item) => item.id === id) ? "Түүхий эд" : fx.some((item) => item.id === id) ? "Валют" : regionOf(id) || "Индекс"
  const rows: PerformanceRow[] = [
    { id: "top20", label: "ТОП-20", group: "Монгол", since: sinceOf(top20), year: parseNumber(top20.year), detail: `10.02: ${top20.prev} → ${top20.price}` },
    ...allQuotes
      .filter((item) => item.denom.kind !== "percent")
      .map((item) => ({
        id: item.id,
        label: friendlyName[item.id] ?? item.label,
        group: groupOf(item.id),
        since: sinceOf(item),
        ytd: item.ytd,
        year: item.year,
        detail: item.prev ? `10.02: ${item.prev} → ${item.price}` : undefined,
      })),
  ]
  return (
    <Block id="performance" title="Бүх зах зээл нэг дор" lead="Хугацаагаа сонгоод аль нь өсөж, аль нь унасныг нэг харцаар. Валютын өсөлт нь ам.доллар чангарсныг илтгэнэ.">
      <PerformanceChart rows={rows} />
    </Block>
  )
}

/** Compact rows: name and what it is, price with its unit, the day's move, date and source. */
function QuoteBoard({ ids }: { ids: string[] }) {
  return (
    <ul className="bg-card divide-y rounded-xl border">
      {ids.map((id) => {
        const item = quote(id)
        if (!item) return null
        const per = item.denom.kind === "money" ? item.denom.per : undefined
        const hint = per ? unitHint[per] : undefined
        const flatNote = item.pct === 0 && (!/\d/.test(item.move) || item.denom.kind === "percent") ? item.move : ""
        return (
          <li key={id} id={id} className="target:bg-muted grid scroll-mt-40 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{friendlyName[id] ?? item.label}</p>
              <p className="text-muted-foreground truncate text-[12px]">{plain[id]}</p>
            </div>
            <div className="text-right">
              <p className="text-[17px] font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-[19px]">
                {formatValue(item.price, item.denom)}
                {per ? <span className="text-muted-foreground ml-1 font-sans text-[11px] font-normal">/ {per}</span> : null}
              </p>
              <p className="mt-0.5 flex items-center justify-end gap-2">
                {/\d/.test(item.move) && !item.move.endsWith("%") && item.pct !== 0 ? (
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums">{formatMove(item.move, item.denom)}</span>
                ) : null}
                {flatNote ? <span className="text-muted-foreground text-[11px]">{flatNote}</span> : <ChangePill pct={item.pct} />}
              </p>
            </div>
            <p className="text-muted-foreground col-span-2 text-[10.5px]">
              {hint ? `${hint} · ` : ""}
              {item.asOf} · {item.href ? <a className="underline" href={item.href}>{item.source}</a> : item.source}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function Currency() {
  return (
    <Block id="currency" title="Валют ба хүү" lead="Төгрөг, гол валютын ханш ба дэлхийн зээлийн хүүний жишиг.">
      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <QuoteBoard ids={fx.map((item) => item.id)} />
        <div className="bg-card rounded-xl border p-5 sm:p-6">
          <h4 className="font-semibold">АНУ-ын бондын өгөөжийн муруй</h4>
          <p className="text-muted-foreground text-xs">Хугацаагаар · {usCurve.asOf}</p>
          <div className="mt-4 max-w-[520px]">
            <YieldCurve points={usCurve.points} />
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed">
            30 жилийн зээл 2 жилийнхээс <strong className="tabular-nums">{(usCurve.points[2].yield - usCurve.points[0].yield).toFixed(2)} нэгжээр</strong> үнэтэй. Хөрөнгө
            оруулагчид инфляц, төсвийн алдагдлын эрсдэлд нэмэлт хүү шаардаж байна. 10 жилийн өгөөж 10.08-нд {usCurve.high10}% хүрч, 2002 оноос хойших дээд түвшинд гарсан.
            Монголын гадаад зээлийн хүү энэ өгөөж дээр эрсдэлийн нэмэгдэл нэмж тогтдог.
          </p>
          <SourceLine>
            <a href={usCurve.href}>{usCurve.source}</a> · Японы 10 жилийн өгөөж {usCurve.japan10.yield}% ·{" "}
            <Link to="/story/treasury-yields-24-year-high">АНУ-ын өгөөжийн тойм</Link>
          </SourceLine>
        </div>
      </div>
    </Block>
  )
}

/* ------------------------------------------------------------------ */
/* Тайлбар: small, at the end of every room                             */
/* ------------------------------------------------------------------ */

function Glossary() {
  const [open, setOpen] = useState<string | null>(null)
  const current = glossary.find((item) => item.term === open)
  return (
    <section id="glossary" aria-label="Үгийн тайлбар" className="mt-16 scroll-mt-40 border-t pt-6">
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
