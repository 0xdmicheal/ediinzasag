import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, CandlestickChart, Minus } from "lucide-react"
import { cn } from "cn"

import { signedPct } from "@/components/site/market-marks"
import { formatValue } from "@/components/site/money"
import { TradingViewChart } from "@/components/site/TradingViewChart"
import { loadCalendar, recommendationLabel, type CalendarData, type EarningsEvent, type EconEvent } from "@/content/calendar"
import { commodities, fx, sessionShort, worldIndices, type Quote } from "@/content/markets"

/*
 * EZ Desk: the calendar and the chart as one tool, on the fixed-dark studio
 * surface. A week timeline puts every release at its hour (taller = more
 * market-moving) with a "now" line, and the week's earnings on their own lane.
 * Picking anything opens a focus card (countdown, figures, the Mongolian
 * explanation, analysts' targets) and switches the chart to the market that
 * news moves: US CPI → dollar index, an ASML report → ASML. The agenda under
 * it lists the chosen day, releases and reports together.
 *
 * Times are Ulaanbaatar time (UTC+8, no daylight saving). Chart prices are
 * TradingView's own feed; the watchlist shows our sourced closes.
 */

const TZ = "Asia/Ulaanbaatar"
const UB_OFFSET = "+08:00"
const STUDIO = "#16181c"
const UP = "text-[#2fae74]"
const DOWN = "text-[#f0643f]"
const HOT = "#f0643f"
const weekdays = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"]
const shortWeekdays = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"]

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

/** "2026-10-14" and "20:30" in Ulaanbaatar time. */
function ubParts(iso: string | number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()
const weekStart = (day: string) => addDays(day, -((weekdayOf(day) + 6) % 7))
const dayStartMs = (day: string) => Date.parse(`${day}T00:00:00${UB_OFFSET}`)

function dayName(day: string, today: string) {
  const [, month, date] = day.split("-")
  const relative = day === today ? "Өнөөдөр" : day === addDays(today, 1) ? "Маргааш" : day === addDays(today, -1) ? "Өчигдөр" : weekdays[weekdayOf(day)]
  return `${relative}, ${Number(month)}-р сарын ${Number(date)}`
}

/** "2 цаг 15 минутын дараа", "Гарсан"… */
function countdown(targetMs: number, nowMs: number) {
  const minutes = Math.round((targetMs - nowMs) / 60_000)
  if (minutes < -5) return { text: "Гарсан", live: false, past: true }
  if (minutes <= 5) return { text: "Яг одоо", live: true, past: false }
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days >= 1) return { text: `${days} хоног ${hours} цагийн дараа`, live: false, past: false }
  if (hours >= 1) return { text: `${hours} цаг ${rest} минутын дараа`, live: false, past: false }
  return { text: `${rest} минутын дараа`, live: true, past: false }
}

function useNow(step = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), step)
    return () => window.clearInterval(timer)
  }, [step])
  return now
}

/* ------------------------------------------------------------------ */
/* Number helpers                                                      */
/* ------------------------------------------------------------------ */

const plainNumber = (n: number, digits = 2) => n.toLocaleString("en-US", { maximumFractionDigits: n >= 1000 ? 0 : digits, minimumFractionDigits: 0 })

function bigMoney(n: number, currency: string) {
  const unit = Math.abs(n) >= 1e12 ? [1e12, "их наяд"] : Math.abs(n) >= 1e9 ? [1e9, "тэрбум"] : Math.abs(n) >= 1e6 ? [1e6, "сая"] : [1, ""]
  return `${(n / (unit[0] as number)).toLocaleString("en-US", { maximumFractionDigits: 1 })} ${unit[1]} ${currency}`.replace(/\s+/g, " ").trim()
}

/** "3.6%", "195K", "-0.1%" → a number to compare; null when it isn't one. */
function figure(value: string) {
  const match = value.replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*([KMBT%]?)$/i)
  if (!match) return null
  const scale = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[match[2].toLowerCase() as "k"] ?? 1
  return Number(match[1]) * scale
}

const upsideOf = (item: EarningsEvent) => (item.price && item.targetMean ? (item.targetMean / item.price - 1) * 100 : null)

/* ------------------------------------------------------------------ */
/* What each piece of news moves on the chart                          */
/* ------------------------------------------------------------------ */

interface ChartPick {
  symbol: string
  label: string
  code: string
  quote?: Quote
}

/** The market a currency's data releases move most. */
const CURRENCY_CHART: Record<string, ChartPick> = {
  USD: { symbol: "CAPITALCOM:DXY", label: "Долларын индекс", code: "DXY" },
  EUR: { symbol: "FX:EURUSD", label: "Евро/ам.доллар", code: "EURUSD" },
  GBP: { symbol: "FX:GBPUSD", label: "Фунт/ам.доллар", code: "GBPUSD" },
  JPY: { symbol: "FX:USDJPY", label: "Ам.доллар/иен", code: "USDJPY" },
  CNY: { symbol: "FX_IDC:USDCNY", label: "Ам.доллар/юань", code: "USDCNY" },
  CAD: { symbol: "FX:USDCAD", label: "Ам.доллар/канад доллар", code: "USDCAD" },
  AUD: { symbol: "FX:AUDUSD", label: "Австрали доллар/ам.доллар", code: "AUDUSD" },
  NZD: { symbol: "FX:NZDUSD", label: "Шинэ Зеланд доллар/ам.доллар", code: "NZDUSD" },
  CHF: { symbol: "FX:USDCHF", label: "Ам.доллар/франк", code: "USDCHF" },
}

/** Yahoo ticker suffix → TradingView exchange prefix. */
const EXCHANGES: Record<string, string> = {
  HK: "HKEX", SS: "SSE", DE: "XETR", T: "TSE", NS: "NSE", L: "LSE", PA: "EURONEXT", MI: "MIL", TO: "TSX", SA: "BMFBOVESPA",
  MX: "BMV", AX: "ASX", KS: "KRX", MC: "BME", JK: "IDX", AS: "EURONEXT", IS: "BIST", SR: "TADAWUL", SW: "SIX",
}

/** Exchanges TradingView's free widget won't show ("only available on TradingView"), checked 2026-10-12. */
const CHART_BLOCKED = new Set(["HK", "T", "NS", "L", "MX", "KS", "IS", "SR"])

/** The company's chart, or null where the free widget can't show it. */
function stockChart(item: EarningsEvent): ChartPick | null {
  const [base, suffix] = item.symbol.split(".")
  if (suffix && CHART_BLOCKED.has(suffix)) return null
  const code = base.replace("-", ".")
  return { symbol: suffix && EXCHANGES[suffix] ? `${EXCHANGES[suffix]}:${code}` : code, label: item.name, code: item.symbol }
}

const all = [...worldIndices, ...commodities, ...fx]
const q = (id: string) => all.find((item) => item.id === id)

/** Everything the chart can switch to, in groups (each symbol checked to render in the free widget). */
const GROUPS: { id: string; title: string; items: ChartPick[] }[] = [
  {
    id: "mongolia",
    title: "Монголд хамаатай",
    items: [
      { label: "Зэс", symbol: "OANDA:XCUUSD", code: "XCUUSD", quote: q("copper") },
      { label: "Алт", symbol: "OANDA:XAUUSD", code: "XAUUSD", quote: q("gold") },
      { label: "Мөнгө", symbol: "OANDA:XAGUSD", code: "XAGUSD" },
      { label: "Брент", symbol: "TVC:UKOIL", code: "UKOIL", quote: q("brent") },
      { label: "WTI", symbol: "TVC:USOIL", code: "USOIL", quote: q("wti") },
      { label: "Ам.доллар/төгрөг", symbol: "FX_IDC:USDMNT", code: "USDMNT", quote: q("mnt") },
      { label: "Ам.доллар/юань", symbol: "FX_IDC:USDCNY", code: "USDCNY", quote: q("cny") },
      { label: "Ам.доллар/рубль", symbol: "FX_IDC:USDRUB", code: "USDRUB" },
    ],
  },
  {
    id: "fx",
    title: "Валют, хүү",
    items: [
      CURRENCY_CHART.USD,
      { ...CURRENCY_CHART.EUR, quote: q("eur") },
      CURRENCY_CHART.GBP,
      { ...CURRENCY_CHART.JPY, quote: q("jpy") },
      CURRENCY_CHART.CHF,
      CURRENCY_CHART.CAD,
      CURRENCY_CHART.AUD,
      CURRENCY_CHART.NZD,
      { label: "Ам.доллар/вон", symbol: "FX_IDC:USDKRW", code: "USDKRW" },
      { label: "АНУ 10 жилийн өгөөж", symbol: "FRED:DGS10", code: "DGS10", quote: q("ust") },
    ],
  },
  {
    id: "indices",
    title: "Индекс",
    items: [
      { label: "S&P 500", symbol: "CAPITALCOM:US500", code: "US500", quote: q("spx") },
      { label: "Nasdaq 100", symbol: "CAPITALCOM:US100", code: "US100" },
      { label: "Dow", symbol: "CAPITALCOM:US30", code: "US30", quote: q("dow") },
      { label: "Euro Stoxx 50", symbol: "CAPITALCOM:EU50", code: "EU50" },
      { label: "DAX", symbol: "XETR:DAX", code: "DAX", quote: q("dax") },
      { label: "FTSE 100", symbol: "CAPITALCOM:UK100", code: "UK100", quote: q("ftse") },
      { label: "Nikkei", symbol: "CAPITALCOM:J225", code: "J225", quote: q("nikkei") },
      { label: "Hang Seng", symbol: "CAPITALCOM:HK50", code: "HK50", quote: q("hsi") },
      { label: "Шанхай", symbol: "SSE:000001", code: "000001", quote: q("shanghai") },
    ],
  },
]

/** Flat list, for the page's "today" tiles. */
export const WATCHLIST: ChartPick[] = GROUPS.flatMap((group) => group.items)

/* ------------------------------------------------------------------ */
/* Items on the timeline                                               */
/* ------------------------------------------------------------------ */

type Pick = { kind: "econ"; id: string } | { kind: "earn"; symbol: string }

/** Releases at the same minute: one marker. */
interface Cluster {
  key: string
  at: number
  day: string
  events: EconEvent[]
  high: boolean
}

function clusters(events: EconEvent[]) {
  const map = new Map<string, Cluster>()
  for (const event of events) {
    const at = Date.parse(event.startsAt)
    const key = String(at)
    const cluster = map.get(key) ?? { key, at, day: ubParts(at).day, events: [], high: false }
    cluster.events.push(event)
    cluster.high ||= event.impact === "High"
    map.set(key, cluster)
  }
  // Within a minute, the market-moving ones first.
  for (const cluster of map.values()) cluster.events.sort((a, b) => Number(b.impact === "High") - Number(a.impact === "High"))
  return [...map.values()].sort((a, b) => a.at - b.at)
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Change({ pct }: { pct: number }) {
  const Icon = Math.abs(pct) < 0.005 ? Minus : pct > 0 ? ArrowUp : ArrowDown
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums", Math.abs(pct) < 0.005 ? "text-white/50" : pct > 0 ? UP : DOWN)}>
      <Icon className="size-3" strokeWidth={2.75} />
      {signedPct(pct).replace("-", "−")}
    </span>
  )
}

function Impact({ high, compact = false }: { high: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", high ? "text-[#f0643f]" : "text-white/55")}>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span key={dot} className={cn("size-1.5 rounded-full", dot < (high ? 3 : 2) ? "bg-current" : "bg-white/15")} />
        ))}
      </span>
      <span className={compact ? "hidden sm:inline" : ""}>{high ? "Өндөр нөлөө" : "Дунд нөлөө"}</span>
    </span>
  )
}

const panel = "rounded-xl border border-white/10 bg-white/[0.03]"
const label = "text-[10.5px] font-medium tracking-[0.14em] text-white/45 uppercase"

/* ------------------------------------------------------------------ */
/* Desk                                                                */
/* ------------------------------------------------------------------ */

export function MarketDesk({ request }: { request?: { symbol: string; n: number } | null }) {
  const [data, setData] = useState<CalendarData | null>(null)
  const [failed, setFailed] = useState(false)
  const now = useNow()
  const today = ubParts(now).day
  const [week, setWeek] = useState(() => weekStart(ubParts(Date.now()).day))
  const [day, setDay] = useState(today)
  const [pick, setPick] = useState<Pick | null>(null)
  const [chart, setChart] = useState<ChartPick>(WATCHLIST[0])
  const [linked, setLinked] = useState(false)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    loadCalendar().then(setData, () => setFailed(true))
  }, [])

  // The page's "today" tiles can point the chart at a market.
  useEffect(() => {
    if (!request) return
    const match = WATCHLIST.find((item) => item.symbol === request.symbol)
    if (match) {
      setChart(match)
      setLinked(false)
    }
    root.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [request])

  const econ = useMemo(() => clusters(data?.econ ?? []), [data])
  const earnings = useMemo(() => data?.earnings ?? [], [data])

  // On load: the next market-moving release (or the next anything), without moving the chart.
  useEffect(() => {
    if (!data || pick) return
    const upcoming = econ.filter((cluster) => cluster.at > Date.now() - 5 * 60_000)
    const next = upcoming.find((cluster) => cluster.high) ?? upcoming[0]
    if (next) {
      setPick({ kind: "econ", id: next.events[0].id })
      setDay(next.day)
      setWeek(weekStart(next.day))
    } else if (earnings[0]) {
      setPick({ kind: "earn", symbol: earnings[0].symbol })
      setDay(earnings[0].reportDate)
      setWeek(weekStart(earnings[0].reportDate))
    }
  }, [data, econ, earnings, pick])

  const choose = (next: Pick, moveChart = true) => {
    setPick(next)
    if (next.kind === "econ") {
      const event = data?.econ.find((item) => item.id === next.id)
      if (event) {
        setDay(ubParts(event.startsAt).day)
        const target = CURRENCY_CHART[event.currency]
        if (moveChart && target) {
          setChart(target)
          setLinked(true)
        }
      }
    } else {
      const item = earnings.find((row) => row.symbol === next.symbol)
      if (item) {
        setDay(item.reportDate)
        const target = stockChart(item)
        if (moveChart && target) {
          setChart(target)
          setLinked(true)
        }
      }
    }
  }

  // This and next weeks' reporting companies the chart can show.
  const companies = useMemo(() => {
    const seen = new Set<string>()
    return earnings
      .filter((item) => item.reportDate >= today && item.reportDate < addDays(today, 21))
      .map(stockChart)
      .filter((item): item is ChartPick => item !== null && !seen.has(item.symbol) && Boolean(seen.add(item.symbol)))
  }, [earnings, today])

  const lastDay = [...econ.map((cluster) => cluster.day), ...earnings.map((item) => item.reportDate)].sort().at(-1) ?? today
  const canBack = week > weekStart(today)
  const canForward = addDays(week, 7) <= lastDay

  return (
    <section ref={root} id="desk" aria-labelledby="desk-title" className="bg-studio text-photo-foreground scroll-mt-14">
      <span id="chart" className="block scroll-mt-14" aria-hidden />
      <span id="calendar" className="block scroll-mt-14" aria-hidden />
      <div className="px-[10px] pt-2">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-white/10 px-1 pt-8">
          <div className="flex items-center gap-3">
            <span className="bg-brand text-brand-foreground grid size-9 place-items-center rounded-lg">
              <CandlestickChart className="size-5" strokeWidth={2.25} />
            </span>
            <div>
              <h2 id="desk-title" className="font-news text-2xl leading-none sm:text-3xl">
                EZ Desk
              </h2>
              <p className="mt-1 text-[13px] text-white/55">Мэдээ хэзээ гарах, юуг хөдөлгөхийг нэг дор. Мэдээг дарвал график тэр зах зээл рүү шилжинэ.</p>
            </div>
          </div>
          <p className="font-mono text-[12px] text-white/55 tabular-nums">
            <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-[#2fae74] align-middle" aria-hidden />
            Улаанбаатар {ubParts(now).time}
          </p>
        </header>

        {failed ? <p className="mt-6 text-sm text-white/60">Календарийг ачаалж чадсангүй. Дараа дахин оролдоно уу.</p> : null}

        <Timeline
          econ={econ}
          earnings={earnings}
          week={week}
          today={today}
          now={now}
          day={day}
          pick={pick}
          loading={!data && !failed}
          canBack={canBack}
          canForward={canForward}
          onWeek={(step) => {
            const next = addDays(week, step * 7)
            setWeek(next)
            setDay(next <= today && today < addDays(next, 7) ? today : next)
          }}
          onDay={setDay}
          onPick={choose}
        />

      </div>

      {/* The working row runs edge to edge, 10px from each side: calendar | chart | explanation. */}
      <div className="mt-4 grid gap-[10px] px-[10px] xl:grid-cols-[17.5rem_minmax(0,1fr)_21rem] 2xl:grid-cols-[19rem_minmax(0,1fr)_23rem] [&>*]:min-w-0">
        <DayRail econ={econ} earnings={earnings} week={week} day={day} today={today} now={now} pick={pick} onDay={setDay} onPick={choose} />
        <div className="order-2 flex min-w-0 flex-col gap-[10px]">
          <Watchlist
            current={chart}
            linked={linked}
            companies={companies}
            onPick={(item, fromCompanies) => {
              setChart(item)
              setLinked(fromCompanies)
            }}
          />
          <TradingViewChart
            symbol={chart.symbol}
            title={chart.label}
            theme="dark"
            background={STUDIO}
            className="h-[480px] rounded-xl border border-white/10 sm:h-[640px] xl:h-[760px]"
          />
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-[10px] xl:order-3">
          <Focus data={data} econ={econ} pick={pick} now={now} chart={chart} linked={linked} onPick={choose} />
          <UpNext econ={econ} earnings={earnings} now={now} today={today} pick={pick} onPick={choose} />
        </div>
      </div>

      <div className="px-[10px] pb-10">
        <p className="mt-6 text-[11px] leading-relaxed text-white/45">
          Календарь: Forex Factory, Yahoo Finance (шинжээчдийн дундаж таамаг); тайлбарыг хиймэл оюун ухаанаар бэлдэв
          {data?.updatedAt ? `, шинэчилсэн ${ubParts(data.updatedAt).day.slice(5).replace("-", ".")} ${ubParts(data.updatedAt).time}` : ""}
          {data?.demo ? " (демо: жишээ өгөгдөл)" : ""}. График: TradingView (шууд эсвэл хоцрогдолтой), индексийг CFD хэлбэрээр харуулав. Жагсаалтын үнэ: эх сурвалжийн{" "}
          {sessionShort}. Хөрөнгө оруулалтын зөвлөгөө биш.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Timeline: the week at a glance                                      */
/* ------------------------------------------------------------------ */

function Timeline(props: {
  econ: Cluster[]
  earnings: EarningsEvent[]
  week: string
  today: string
  now: number
  day: string
  pick: Pick | null
  loading: boolean
  canBack: boolean
  canForward: boolean
  onWeek: (step: number) => void
  onDay: (day: string) => void
  onPick: (pick: Pick) => void
}) {
  const { econ, earnings, week, today, now, day, pick, onPick } = props
  const start = dayStartMs(week)
  const span = 7 * 86_400_000
  const at = (ms: number) => `${((ms - start) / span) * 100}%`
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index))
  const inWeek = (ms: number) => ms >= start && ms < start + span
  const shown = econ.filter((cluster) => inWeek(cluster.at))
  const reports = (target: string) => earnings.filter((item) => item.reportDate === target)
  const scroller = useRef<HTMLDivElement>(null)

  // Phones: start the scrollable week at "now".
  useEffect(() => {
    const node = scroller.current
    if (!node || node.scrollWidth <= node.clientWidth || !inWeek(now)) return
    node.scrollLeft = ((now - start) / span) * node.scrollWidth - node.clientWidth / 3
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week])

  const arrow = "grid size-8 place-items-center rounded-full border border-white/15 text-[16px] leading-none transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-25"

  return (
    <div className={cn(panel, "mt-6 p-3 sm:p-4")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className={label}>
          {Number(week.slice(5, 7))}-р сарын {Number(week.slice(8))}–{Number(addDays(week, 6).slice(8))} · {shown.length} цаг, {days.reduce((sum, target) => sum + reports(target).length, 0)} ашгийн тайлан
        </p>
        <div className="flex items-center gap-1.5">
          <button type="button" className={arrow} onClick={() => props.onWeek(-1)} disabled={!props.canBack} aria-label="Өмнөх долоо хоног">
            ‹
          </button>
          <button type="button" className={arrow} onClick={() => props.onWeek(1)} disabled={!props.canForward} aria-label="Дараагийн долоо хоног">
            ›
          </button>
        </div>
      </div>

      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        <div className="relative min-w-[760px]">
          {/* Day headers (pick a day for the agenda) */}
          <div className="grid grid-cols-7">
            {days.map((target) => {
              const count = shown.filter((cluster) => cluster.day === target).reduce((sum, cluster) => sum + cluster.events.length, 0) + reports(target).length
              return (
                <button
                  key={target}
                  type="button"
                  onClick={() => props.onDay(target)}
                  aria-pressed={day === target}
                  className={cn(
                    "mx-0.5 flex items-baseline justify-between rounded-md px-2 py-1.5 text-left transition-colors",
                    day === target ? "bg-white/12" : "hover:bg-white/6",
                    target < today ? "opacity-50" : "",
                  )}
                >
                  <span className="text-[12px]">
                    <span className={cn("font-semibold", target === today ? "text-brand" : "")}>{target === today ? "Өнөөдөр" : shortWeekdays[weekdayOf(target)]}</span>{" "}
                    <span className="text-white/50 tabular-nums">{Number(target.slice(8))}</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-white/40 tabular-nums">{count || ""}</span>
                </button>
              )
            })}
          </div>

          {/* The river: releases at their hour */}
          <div className="relative mt-2 h-[104px] rounded-lg bg-white/[0.025]">
            {days.map((target, index) => (
              <span key={target} className={cn("absolute inset-y-0 border-l border-white/[0.06]", weekdayOf(target) % 6 === 0 ? "bg-white/[0.02]" : "")} style={{ left: `${(index / 7) * 100}%`, width: `${100 / 7}%` }} aria-hidden>
                {[6, 12, 18].map((hour) => (
                  <span key={hour} className="absolute bottom-0 h-1.5 border-l border-white/10" style={{ left: `${(hour / 24) * 100}%` }} />
                ))}
              </span>
            ))}
            <span className="absolute bottom-0 left-0 h-px w-full bg-white/10" aria-hidden />

            {inWeek(now) ? (
              <span className="bg-brand absolute inset-y-0 z-10 w-0.5" style={{ left: at(now) }} aria-hidden>
                <span className="bg-brand absolute -top-1 left-1/2 -translate-x-1/2 rounded px-1 font-mono text-[9.5px] leading-4 font-semibold text-white">Одоо</span>
              </span>
            ) : null}

            {props.loading ? <span className="absolute inset-0 animate-pulse rounded-lg bg-white/[0.04]" /> : null}

            {shown.map((cluster) => {
              const selected = pick?.kind === "econ" && cluster.events.some((event) => event.id === pick.id)
              const past = cluster.at < now - 5 * 60_000
              const first = cluster.events[0]
              return (
                <button
                  key={cluster.key}
                  type="button"
                  onClick={() => onPick({ kind: "econ", id: first.id })}
                  title={`${ubParts(cluster.at).time} · ${cluster.events.map((event) => event.mnTitle || event.title).join(" · ")}`}
                  aria-label={`${dayName(cluster.day, today)} ${ubParts(cluster.at).time}: ${first.mnTitle || first.title}${cluster.events.length > 1 ? ` ба ${cluster.events.length - 1} бусад` : ""}`}
                  className="group absolute bottom-0 z-20 flex w-5 -translate-x-1/2 flex-col items-center justify-end"
                  style={{ left: at(cluster.at), height: cluster.high ? 84 : 52 }}
                >
                  <span
                    className={cn(
                      "grid min-w-[18px] place-items-center rounded-full px-1 font-mono text-[9.5px] leading-[18px] font-semibold transition-transform group-hover:scale-110",
                      selected ? "bg-brand text-white ring-brand/40 ring-4" : cluster.high ? "text-white" : "bg-white/25 text-white",
                      past && !selected ? "opacity-45" : "",
                    )}
                    style={!selected && cluster.high ? { background: HOT } : undefined}
                  >
                    {cluster.events.length > 1 ? cluster.events.length : ""}
                  </span>
                  <span className={cn("w-0.5 flex-1", selected ? "bg-brand" : cluster.high ? "bg-[#f0643f]/60" : "bg-white/25", past && !selected ? "opacity-45" : "")} />
                </button>
              )
            })}
          </div>

          {/* Earnings lane */}
          <div className="mt-2 grid grid-cols-7">
            {days.map((target) => {
              const list = reports(target)
              const selected = pick?.kind === "earn" && list.some((item) => item.symbol === pick.symbol)
              return (
                <span key={target} className="mx-0.5 flex min-w-0">
                  {list.length ? (
                    <button
                      type="button"
                      onClick={() => onPick({ kind: "earn", symbol: list[0].symbol })}
                      title={list.map((item) => item.name).join(", ")}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] transition-colors",
                        selected ? "border-brand bg-brand/20" : "border-white/10 hover:bg-white/6",
                        target < today ? "opacity-40" : "",
                      )}
                    >
                      <span className="flex -space-x-1" aria-hidden>
                        {list.slice(0, 3).map((item) => (
                          <span key={item.symbol} className="grid size-4 place-items-center rounded-full bg-white/90 text-[8.5px] font-bold text-[#16181c] ring-1 ring-[#16181c]">
                            {item.name.replace(/^Жишээ: /, "").charAt(0)}
                          </span>
                        ))}
                      </span>
                      <span className="truncate">
                        {list.length} тайлан
                      </span>
                    </button>
                  ) : (
                    <span className="flex-1 rounded-md border border-dashed border-white/[0.06] py-1 text-center text-[10px] text-white/20">·</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: HOT }} /> Өндөр нөлөөтэй
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-white/25" /> Дунд
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="grid size-3.5 place-items-center rounded-full bg-white/25 font-mono text-[8px] text-white">3</span> Нэг цагт хэд гарах
        </span>
        <span>Доод мөр: компаниудын ашгийн тайлан</span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Watchlist chips above the chart                                     */
/* ------------------------------------------------------------------ */

function Watchlist({ current, linked, companies, onPick }: { current: ChartPick; linked: boolean; companies: ChartPick[]; onPick: (item: ChartPick, fromCompanies: boolean) => void }) {
  const groups = [...GROUPS, ...(companies.length ? [{ id: "companies", title: "Тайлан гаргах компаниуд", items: companies }] : [])]
  const home = groups.find((group) => group.items.some((item) => item.symbol === current.symbol))?.id ?? groups[0].id
  const [open, setOpen] = useState(home)
  // Follow the chart: when news switches it, show the group that holds the new market.
  useEffect(() => setOpen(home), [home])
  const group = groups.find((entry) => entry.id === open) ?? groups[0]

  return (
    <div className={cn(panel, "p-2")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Зах зээлийн бүлэг" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {groups.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === open}
              onClick={() => setOpen(entry.id)}
              className={cn(
                "h-8 shrink-0 rounded-lg px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors",
                entry.id === open ? "bg-white text-[#16181c]" : "text-white/60 hover:bg-white/8 hover:text-white",
              )}
            >
              {entry.title}
              <span className="ml-1.5 font-mono text-[10.5px] opacity-55">{entry.items.length}</span>
            </button>
          ))}
        </div>
        <p className="flex min-w-0 items-center gap-2 px-2 text-[12px]">
          {linked ? <span className="text-brand shrink-0 text-[10px] font-semibold tracking-[0.12em] uppercase">Мэдээтэй холбоотой</span> : null}
          <span className="truncate font-semibold">{current.label}</span>
          <span className="shrink-0 font-mono text-[11px] text-white/40">{current.code}</span>
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/[0.07] pt-2">
        {group.items.map((item) => {
          const active = item.symbol === current.symbol
          return (
            <button
              key={item.symbol}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(item, group.id === "companies")}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1 text-left transition-colors",
                active ? "border-brand bg-brand/20" : "border-white/10 hover:border-white/25 hover:bg-white/6",
              )}
            >
              <span className="text-[12.5px] font-medium whitespace-nowrap">{item.label}</span>
              {item.quote ? (
                <span className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                  <span className="text-white/60 tabular-nums">{item.quote.denom.kind === "index" || item.quote.denom.kind === "percent" ? item.quote.price : formatValue(item.quote.price, item.quote.denom)}</span>
                  {item.quote.pct !== 0 ? <Change pct={item.quote.pct} /> : null}
                </span>
              ) : (
                <span className="font-mono text-[10.5px] text-white/35">{item.code}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Focus card                                                          */
/* ------------------------------------------------------------------ */

function Focus({ data, econ, pick, now, chart, linked, onPick }: { data: CalendarData | null; econ: Cluster[]; pick: Pick | null; now: number; chart: ChartPick; linked: boolean; onPick: (pick: Pick) => void }) {
  if (!data) return <div className={cn(panel, "h-[340px] animate-pulse")} />
  if (!pick) return <div className={cn(panel, "p-5 text-sm text-white/60")}>Ойрын хугацаанд чухал мэдээ алга.</div>
  if (pick.kind === "earn") {
    const item = data.earnings.find((row) => row.symbol === pick.symbol)
    if (!item) return null
    const sameDay = data.earnings.filter((row) => row.reportDate === item.reportDate)
    return <EarningsFocus item={item} sameDay={sameDay} now={now} chart={chart} linked={linked} onPick={onPick} />
  }
  const cluster = econ.find((entry) => entry.events.some((event) => event.id === pick.id))
  const event = cluster?.events.find((entry) => entry.id === pick.id)
  if (!cluster || !event) return null
  return <EconFocus event={event} cluster={cluster} now={now} chart={chart} linked={linked} onPick={onPick} />
}

function When({ ms, now, allDay }: { ms: number; now: number; allDay?: boolean }) {
  const today = ubParts(now).day
  const { day, time } = ubParts(ms)
  const left = allDay ? (day === today ? { text: "Өнөөдөр", live: true, past: false } : day < today ? { text: "Гарсан", live: false, past: true } : countdown(ms, now)) : countdown(ms, now)
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p className="text-[13px] text-white/70">
        {dayName(day, today)}
        {allDay ? "" : <span className="ml-1.5 font-mono text-white tabular-nums">{time}</span>}
      </p>
      <p className={cn("font-mono text-[12px] font-semibold tabular-nums", left.live ? "text-[#2fae74]" : left.past ? "text-white/40" : "text-brand")}>
        {left.live ? <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current align-middle" /> : null}
        {left.text}
      </p>
    </div>
  )
}

function LinkedNote({ chart, linked }: { chart: ChartPick; linked: boolean }) {
  if (!linked) return null
  return (
    <p className="mt-4 flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-white/70">
      <CandlestickChart className="text-brand size-4 shrink-0" />
      <span>
        Графикт: <strong className="text-white">{chart.label}</strong>. Мэдээ гарахаас өмнө ба дараа нь хэрхэн хөдөлснийг харна уу.
      </span>
    </p>
  )
}

function EconFocus({ event, cluster, now, chart, linked, onPick }: { event: EconEvent; cluster: Cluster; now: number; chart: ChartPick; linked: boolean; onPick: (pick: Pick) => void }) {
  const actual = figure(event.actual)
  const forecast = figure(event.forecast)
  const verdict = actual === null || forecast === null ? null : actual > forecast ? "Таамгаас өндөр" : actual < forecast ? "Таамгаас доогуур" : "Таамагтай тэнцүү"
  return (
    <article className={cn(panel, "p-5")} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11.5px] font-medium">{event.country}</span>
        <Impact high={event.impact === "High"} />
      </div>
      <h3 className="mt-3 text-[20px] leading-snug font-semibold">{event.mnTitle || event.title}</h3>
      {event.mnTitle ? <p className="mt-0.5 font-mono text-[11px] text-white/40">{event.title}</p> : null}
      <div className="mt-3">
        <When ms={Date.parse(event.startsAt)} now={now} />
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-white/10 rounded-lg border border-white/10">
        {[
          ["Таамаг", event.forecast],
          ["Өмнөх", event.previous],
          ["Бодит", event.actual],
        ].map(([name, value]) => (
          <div key={name} className="px-3 py-2.5">
            <dt className="text-[10.5px] text-white/45">{name}</dt>
            <dd className={cn("mt-0.5 font-mono text-[17px] font-semibold tabular-nums", value ? "" : "text-white/25", name === "Бодит" && value ? "text-brand" : "")}>{value || "–"}</dd>
          </div>
        ))}
      </dl>
      {verdict ? (
        <p className="mt-2 text-[11.5px] text-white/55">
          <strong className="text-white">{verdict}</strong> гарлаа. Өндөр нь үргэлж сайн гэсэн үг биш: ажилгүйдэл, инфляцын хувьд эсрэгээрээ.
        </p>
      ) : null}

      {event.mnSummary ? <p className="mt-4 text-[14px] leading-relaxed text-white/80">{event.mnSummary}</p> : null}
      <LinkedNote chart={chart} linked={linked} />

      {cluster.events.length > 1 ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className={label}>Яг энэ цагт бас</p>
          <ul className="mt-2 flex flex-col gap-1">
            {cluster.events
              .filter((entry) => entry.id !== event.id)
              .map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => onPick({ kind: "econ", id: entry.id })} className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-white/6">
                    <span className="truncate">{entry.mnTitle || entry.title}</span>
                    <span className="font-mono text-[11px] text-white/45 tabular-nums">{entry.forecast || "–"}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

const RATINGS = ["sell", "underperform", "hold", "buy", "strong_buy"]

function EarningsFocus({ item, sameDay, now, chart, linked, onPick }: { item: EarningsEvent; sameDay: EarningsEvent[]; now: number; chart: ChartPick; linked: boolean; onPick: (pick: Pick) => void }) {
  const upside = upsideOf(item)
  const { targetLow: low, targetHigh: high, targetMean: mean, price } = item
  const range = low !== null && high !== null && mean !== null && high > low
  const pos = (value: number) => `${Math.min(100, Math.max(0, ((value - low!) / (high! - low!)) * 100))}%`
  const rating = RATINGS.indexOf(item.recommendation)
  return (
    <article className={cn(panel, "p-5")} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11.5px] font-medium">
          {item.countryName} · <span className="font-mono">{item.symbol}</span>
        </span>
        <span className="text-[11px] font-medium text-white/55">Ашгийн тайлан</span>
      </div>
      <h3 className="mt-3 text-[20px] leading-snug font-semibold">{item.name}</h3>
      <div className="mt-2">
        <When ms={dayStartMs(item.reportDate)} now={now} allDay />
      </div>

      <dl className="mt-4 grid grid-cols-[1fr_1.8fr_0.9fr] divide-x divide-white/10 rounded-lg border border-white/10">
        {[
          ["EPS таамаг", item.epsEstimate !== null ? plainNumber(item.epsEstimate) : ""],
          ["Орлогын таамаг", item.revenueEstimate !== null ? bigMoney(item.revenueEstimate, item.currency) : ""],
          ["Шинжээч", item.analysts ? String(item.analysts) : ""],
        ].map(([name, value]) => (
          <div key={name} className="min-w-0 px-3 py-2.5">
            <dt className="truncate text-[10.5px] text-white/45">{name}</dt>
            <dd className={cn("mt-0.5 truncate font-mono text-[14px] font-semibold tabular-nums", value ? "" : "text-white/25")}>{value || "–"}</dd>
          </div>
        ))}
      </dl>

      {range ? (
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="text-white/55">Шинжээчдийн зорилтот үнэ</span>
            {upside !== null ? (
              <span className={cn("font-mono font-semibold tabular-nums", upside >= 0 ? UP : DOWN)}>
                {upside >= 0 ? "▲ +" : "▼ "}
                {upside.toFixed(1)}%
              </span>
            ) : null}
          </div>
          <div className="relative mt-5 h-2 rounded-full bg-gradient-to-r from-white/10 via-white/20 to-white/10">
            <span className="bg-brand absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-[#16181c]" style={{ left: pos(mean!) }}>
              <span className="text-brand absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10.5px] font-semibold whitespace-nowrap">{plainNumber(mean!)}</span>
            </span>
            {price !== null ? (
              <span className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white" style={{ left: pos(price) }}>
                <span className="absolute top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap text-white/70">одоо {plainNumber(price)}</span>
              </span>
            ) : null}
          </div>
          <div className="mt-6 flex justify-between font-mono text-[10px] text-white/40 tabular-nums">
            <span>Доод {plainNumber(low!)}</span>
            <span>{item.currency}</span>
            <span>Дээд {plainNumber(high!)}</span>
          </div>
        </div>
      ) : null}

      {rating >= 0 ? (
        <div className="mt-4">
          <p className="text-[11px] text-white/45">Шинжээчдийн зөвлөмж</p>
          <div className="mt-1.5 grid grid-cols-5 gap-1">
            {RATINGS.map((key, index) => (
              <span key={key} className={cn("h-1.5 rounded-full", index === rating ? (index >= 3 ? "bg-[#2fae74]" : index === 2 ? "bg-white" : "bg-[#f0643f]") : "bg-white/10")} />
            ))}
          </div>
          <p className="mt-1 text-[12.5px] font-semibold">{recommendationLabel[item.recommendation]}</p>
        </div>
      ) : null}

      {item.mnSummary ? <p className="mt-4 text-[14px] leading-relaxed text-white/80">{item.mnSummary}</p> : null}
      {stockChart(item) ? (
        <LinkedNote chart={chart} linked={linked && chart.code === item.symbol} />
      ) : (
        <p className="mt-4 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-white/70">
          Энэ биржийн график TradingView-ийн нээлттэй хувилбарт байхгүй.{" "}
          <a className="text-brand underline" href={`https://finance.yahoo.com/quote/${encodeURIComponent(item.symbol)}`} target="_blank" rel="noreferrer">
            Yahoo Finance дээр харах
          </a>
        </p>
      )}

      {sameDay.length > 1 ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className={label}>Мөн энэ өдөр</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sameDay
              .filter((row) => row.symbol !== item.symbol)
              .map((row) => (
                <button key={row.symbol} type="button" onClick={() => onPick({ kind: "earn", symbol: row.symbol })} className="rounded-full border border-white/15 px-2.5 py-1 text-[12px] hover:bg-white/8">
                  {row.name}
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Up next                                                             */
/* ------------------------------------------------------------------ */

function UpNext({ econ, earnings, now, today, pick, onPick }: { econ: Cluster[]; earnings: EarningsEvent[]; now: number; today: string; pick: Pick | null; onPick: (pick: Pick) => void }) {
  const items = [
    ...econ.filter((cluster) => cluster.at > now - 5 * 60_000).map((cluster) => ({ at: cluster.at, pick: { kind: "econ", id: cluster.events[0].id } as Pick, title: cluster.events[0].mnTitle || cluster.events[0].title, sub: cluster.events.length > 1 ? `${cluster.events[0].country} · +${cluster.events.length - 1}` : cluster.events[0].country, high: cluster.high, time: ubParts(cluster.at).time })),
    ...earnings.filter((item) => item.reportDate >= today).map((item) => ({ at: dayStartMs(item.reportDate) + 1, pick: { kind: "earn", symbol: item.symbol } as Pick, title: item.name, sub: `${item.countryName} · ашгийн тайлан`, high: false, time: "Өдөржин" })),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(0, 5)
  if (!items.length) return null
  return (
    <div className={cn(panel, "p-2")}>
      <p className={cn(label, "px-3 pt-2 pb-1")}>Дараа нь</p>
      <ul>
        {items.map((item) => {
          const selected = JSON.stringify(item.pick) === JSON.stringify(pick)
          return (
            <li key={JSON.stringify(item.pick)}>
              <button
                type="button"
                onClick={() => onPick(item.pick)}
                className={cn("grid w-full grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors", selected ? "bg-white/10" : "hover:bg-white/6")}
              >
                <span className="font-mono text-[12px] text-white/60 tabular-nums">
                  <span className="block text-[10px] text-white/35">{ubParts(item.at).day === today ? "Өнөөдөр" : shortWeekdays[weekdayOf(ubParts(item.at).day)]}</span>
                  {item.time}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    {item.high ? <span className="size-1.5 shrink-0 rounded-full" style={{ background: HOT }} /> : null}
                    <span className="truncate text-[13px] font-medium">{item.title}</span>
                  </span>
                  <span className="block truncate text-[11px] text-white/45">{item.sub}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Day rail: the calendar beside the chart, one line per item          */
/* ------------------------------------------------------------------ */

function DayRail({ econ, earnings, week, day, today, now, pick, onDay, onPick }: { econ: Cluster[]; earnings: EarningsEvent[]; week: string; day: string; today: string; now: number; pick: Pick | null; onDay: (day: string) => void; onPick: (pick: Pick) => void }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index))
  const releasesOf = (target: string) => econ.filter((cluster) => cluster.day === target).flatMap((cluster) => cluster.events)
  const reportsOf = (target: string) => earnings.filter((item) => item.reportDate === target).sort((a, b) => (b.analysts ?? 0) - (a.analysts ?? 0))
  const releases = releasesOf(day)
  const reports = reportsOf(day)
  const row = "grid w-full grid-cols-[2.6rem_0.4rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-[7px] text-left transition-colors"

  return (
    // xl: as tall as the chart beside it; the list scrolls inside.
    <aside aria-label="Календарь" className={cn(panel, "order-3 flex min-w-0 flex-col xl:order-1 xl:h-0 xl:min-h-full")}>
      <div role="tablist" aria-label="Өдөр" className="grid grid-cols-7 gap-0.5 border-b border-white/10 p-1.5">
        {days.map((target) => {
          const count = releasesOf(target).length + reportsOf(target).length
          const selected = target === day
          return (
            <button
              key={target}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${dayName(target, today)}, ${count}`}
              onClick={() => onDay(target)}
              className={cn(
                "flex min-w-0 flex-col items-center rounded-md py-1 transition-colors",
                selected ? "bg-white text-[#16181c]" : "hover:bg-white/8",
                !selected && target < today ? "opacity-45" : "",
              )}
            >
              <span className={cn("text-[10.5px]", selected ? "" : target === today ? "text-brand font-semibold" : "text-white/55")}>
                {target === today ? "Өнөө" : shortWeekdays[weekdayOf(target)]}
              </span>
              <span className="text-[13px] leading-tight font-semibold tabular-nums">{Number(target.slice(8))}</span>
              <span className={cn("font-mono text-[9.5px] tabular-nums", selected ? "opacity-60" : "text-white/35")}>{count || "·"}</span>
            </button>
          )
        })}
      </div>
      <p className="flex items-baseline justify-between px-3 pt-2.5 pb-1">
        <span className="text-[12.5px] font-semibold">{dayName(day, today)}</span>
        <span className="font-mono text-[10.5px] text-white/40">{releases.length + reports.length}</span>
      </p>
      <ul className="max-h-[420px] min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1.5 [scrollbar-width:thin] xl:max-h-none">
        {!releases.length && !reports.length ? <li className="px-2 py-6 text-center text-[12px] text-white/40">Энэ өдөр мэдээ алга.</li> : null}
        {releases.map((event) => {
          const selected = pick?.kind === "econ" && pick.id === event.id
          const past = Date.parse(event.startsAt) < now - 5 * 60_000
          const high = event.impact === "High"
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onPick({ kind: "econ", id: event.id })}
                title={`${event.mnTitle || event.title} · ${event.country}`}
                className={cn(row, selected ? "bg-brand/25" : "hover:bg-white/6", past && !selected ? "opacity-50" : "")}
              >
                <span className="font-mono text-[11.5px] text-white/60 tabular-nums">{ubParts(event.startsAt).time}</span>
                <span className={cn("size-1.5 rounded-full", high ? "" : "bg-white/25")} style={high ? { background: HOT } : undefined} />
                <span className="truncate text-[12.5px]">{event.mnTitle || event.title}</span>
                <span className="font-mono text-[11px] text-white/50 tabular-nums">{event.actual ? <span className="text-brand font-semibold">{event.actual}</span> : event.forecast}</span>
              </button>
            </li>
          )
        })}
        {reports.map((item) => {
          const selected = pick?.kind === "earn" && pick.symbol === item.symbol
          const upside = upsideOf(item)
          return (
            <li key={item.symbol}>
              <button
                type="button"
                onClick={() => onPick({ kind: "earn", symbol: item.symbol })}
                title={`${item.name} · ${item.countryName}`}
                className={cn(row, selected ? "bg-brand/25" : "hover:bg-white/6", day < today && !selected ? "opacity-50" : "")}
              >
                <span className="text-[10px] text-white/40">Тайлан</span>
                <span className="size-1.5 rounded-sm bg-white/80" />
                <span className="truncate text-[12.5px]">{item.name}</span>
                <span className={cn("font-mono text-[11px] font-semibold tabular-nums", upside === null ? "text-white/30" : upside >= 0 ? UP : DOWN)}>
                  {upside === null ? "–" : `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
