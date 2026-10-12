import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, CandlestickChart, Minus } from "lucide-react"
import { cn } from "cn"

import { signedPct } from "@/components/site/market-marks"
import { formatValue } from "@/components/site/money"
import { TradingViewChart } from "@/components/site/TradingViewChart"
import { loadCalendar, recommendationLabel, type CalendarData, type EarningsEvent, type EconEvent } from "@/content/calendar"
import { commodities, fx, worldIndices, type Quote } from "@/content/markets"

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
const UP = "text-[var(--up)]"
const DOWN = "text-[var(--down)]"
const HOT = "var(--brand)"
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
    <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums", Math.abs(pct) < 0.005 ? "text-muted-foreground" : pct > 0 ? UP : DOWN)}>
      <Icon className="size-3" strokeWidth={2.75} />
      {signedPct(pct).replace("-", "−")}
    </span>
  )
}

function Impact({ high, compact = false }: { high: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", high ? "text-brand-strong" : "text-muted-foreground")}>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span key={dot} className={cn("size-1.5 rounded-full", dot < (high ? 3 : 2) ? "bg-current" : "bg-gray-200 dark:bg-gray-700")} />
        ))}
      </span>
      <span className={compact ? "hidden sm:inline" : ""}>{high ? "Өндөр нөлөө" : "Дунд нөлөө"}</span>
    </span>
  )
}

const panel = "rounded-xl border bg-card"
const label = "text-[10.5px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
const weekArrow =
  "grid size-7 place-items-center rounded-full border border-border text-[15px] leading-none transition-colors hover:bg-foreground/[0.06] disabled:pointer-events-none disabled:opacity-25"

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
    <section ref={root} id="desk" aria-labelledby="desk-title" className="scroll-mt-14">
      <span id="chart" className="block scroll-mt-14" aria-hidden />
      <span id="calendar" className="block scroll-mt-14" aria-hidden />
      <div className="px-[10px] pt-2">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-border px-1 pt-8">
          <div className="flex items-center gap-3">
            <span className="bg-brand text-brand-foreground grid size-9 place-items-center rounded-lg">
              <CandlestickChart className="size-5" strokeWidth={2.25} />
            </span>
            <div>
              <h2 id="desk-title" className="font-news text-2xl leading-none sm:text-3xl">
                EZ Desk
              </h2>
            </div>
          </div>
          <p className="font-mono text-[12px] text-muted-foreground tabular-nums">
            <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-[var(--up)] align-middle" aria-hidden />
            Улаанбаатар {ubParts(now).time}
          </p>
        </header>

        {failed ? <p className="mt-6 text-sm text-muted-foreground">Календарийг ачаалж чадсангүй. Дараа дахин оролдоно уу.</p> : null}


      </div>

      {/* The working row runs edge to edge, 10px from each side: calendar (explanations open in place) | chart | pairs. */}
      <div className="mt-4 grid gap-[10px] px-[10px] xl:grid-cols-[21rem_minmax(0,1fr)_16rem] 2xl:grid-cols-[23rem_minmax(0,1fr)_18rem] [&>*]:min-w-0">
        {/* xl: the side columns are exactly as tall as the chart and scroll inside. */}
        <DayRail
          econ={econ}
          earnings={earnings}
          week={week}
          day={day}
          today={today}
          now={now}
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
          detail={<Focus data={data} econ={econ} pick={pick} now={now} chart={chart} linked={linked} onPick={choose} />}
        />
        <TradingViewChart
          symbol={chart.symbol}
          title={chart.label}
          className="bg-card h-[480px] rounded-xl border sm:h-[640px] xl:h-[820px]"
        />
        <PairRail
          current={chart}
          linked={linked}
          companies={companies}
          onPick={(item, fromCompanies) => {
            setChart(item)
            setLinked(fromCompanies)
          }}
        />
      </div>

      <div className="px-[10px] pb-10">
        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          Forex Factory · Yahoo Finance · TradingView{data?.demo ? " · демо" : ""}. Зөвлөгөө биш.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Pairs: the chart's watchlist, a rail on the right                   */
/* ------------------------------------------------------------------ */

function PairRail({ current, companies, onPick }: { current: ChartPick; linked: boolean; companies: ChartPick[]; onPick: (item: ChartPick, fromCompanies: boolean) => void }) {
  const groups = [...GROUPS, ...(companies.length ? [{ id: "companies", title: "Компаниуд", items: companies }] : [])]
  const home = groups.find((group) => group.items.some((item) => item.symbol === current.symbol))?.id ?? groups[0].id
  const [open, setOpen] = useState(home)
  // Follow the chart: when news switches it, show the group that holds the new market.
  useEffect(() => setOpen(home), [home])
  const group = groups.find((entry) => entry.id === open) ?? groups[0]
  const short: Record<string, string> = { mongolia: "Монгол", fx: "Валют", indices: "Индекс", companies: "Компани" }

  return (
    <aside aria-label="Зах зээлүүд" className={cn(panel, "flex min-w-0 flex-col xl:h-0 xl:min-h-full")}>
      <div role="tablist" aria-label="Бүлэг" className="grid grid-cols-2 gap-1 border-b border-border p-1.5">
        {groups.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === open}
            title={entry.title}
            onClick={() => setOpen(entry.id)}
            className={cn(
              "flex h-8 items-center justify-between rounded-md px-2.5 text-[12px] font-medium transition-colors",
              entry.id === open ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
            )}
          >
            {short[entry.id] ?? entry.title}
            <span className="font-mono text-[10px] opacity-50">{entry.items.length}</span>
          </button>
        ))}
      </div>
      <ul className="max-h-[360px] min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin] xl:max-h-none">
        {group.items.map((item) => {
          const active = item.symbol === current.symbol
          return (
            <li key={item.symbol}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onPick(item, group.id === "companies")}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-md border-l-2 px-2.5 py-2 text-left transition-colors",
                  active ? "border-brand bg-blue-100 dark:bg-blue-800" : "border-transparent hover:bg-foreground/[0.04]",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{item.label}</span>
                  <span className="block font-mono text-[10.5px] text-muted-foreground">{item.code}</span>
                </span>
                {item.quote ? (
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="text-[12px] text-foreground/80 tabular-nums">{item.quote.denom.kind === "index" || item.quote.denom.kind === "percent" ? item.quote.price : formatValue(item.quote.price, item.quote.denom)}</span>
                    {item.quote.pct !== 0 ? <Change pct={item.quote.pct} /> : null}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Focus card                                                          */
/* ------------------------------------------------------------------ */

function Focus({ data, econ, pick, now, chart, linked, onPick }: { data: CalendarData | null; econ: Cluster[]; pick: Pick | null; now: number; chart: ChartPick; linked: boolean; onPick: (pick: Pick) => void }) {
  if (!data) return <div className={cn(panel, "h-[340px] animate-pulse")} />
  if (!pick) return <div className={cn(panel, "p-5 text-sm text-muted-foreground")}>Ойрын хугацаанд чухал мэдээ алга.</div>
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
      <p className="text-[13px] text-foreground/80">
        {dayName(day, today)}
        {allDay ? "" : <span className="ml-1.5 font-mono text-foreground tabular-nums">{time}</span>}
      </p>
      <p className={cn("font-mono text-[12px] font-semibold tabular-nums", left.live ? "text-[var(--up)]" : left.past ? "text-muted-foreground" : "text-brand-strong")}>
        {left.live ? <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current align-middle" /> : null}
        {left.text}
      </p>
    </div>
  )
}

function EconFocus({ event, cluster, now, onPick }: { event: EconEvent; cluster: Cluster; now: number; chart: ChartPick; linked: boolean; onPick: (pick: Pick) => void }) {
  const actual = figure(event.actual)
  const forecast = figure(event.forecast)
  const verdict = actual === null || forecast === null ? null : actual > forecast ? "Таамгаас өндөр" : actual < forecast ? "Таамгаас доогуур" : "Таамагтай тэнцүү"
  return (
    <article className="p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[11.5px] font-medium">{event.country}</span>
        <Impact high={event.impact === "High"} />
      </div>
      <h3 className="mt-2.5 text-[17px] leading-snug font-semibold">{event.mnTitle || event.title}</h3>
      <div className="mt-3">
        <When ms={Date.parse(event.startsAt)} now={now} />
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
        {[
          ["Таамаг", event.forecast],
          ["Өмнөх", event.previous],
          ["Бодит", event.actual],
        ].map(([name, value]) => (
          <div key={name} className="px-3 py-2.5">
            <dt className="text-[10.5px] text-muted-foreground">{name}</dt>
            <dd className={cn("mt-0.5 font-mono text-[17px] font-semibold tabular-nums", value ? "" : "text-muted-foreground", name === "Бодит" && value ? "text-brand-strong" : "")}>{value || "–"}</dd>
          </div>
        ))}
      </dl>
      {verdict ? (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          <strong className="text-foreground">{verdict}</strong>
        </p>
      ) : null}

      {event.mnSummary ? <p className="mt-4 text-[14px] leading-relaxed text-foreground/80">{event.mnSummary}</p> : null}

      {cluster.events.length > 1 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className={label}>Яг энэ цагт бас</p>
          <ul className="mt-2 flex flex-col gap-1">
            {cluster.events
              .filter((entry) => entry.id !== event.id)
              .map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => onPick({ kind: "econ", id: entry.id })} className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-foreground/[0.04]">
                    <span className="truncate">{entry.mnTitle || entry.title}</span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{entry.forecast || "–"}</span>
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

function EarningsFocus({ item, sameDay, now, onPick }: { item: EarningsEvent; sameDay: EarningsEvent[]; now: number; chart: ChartPick; linked: boolean; onPick: (pick: Pick) => void }) {
  const upside = upsideOf(item)
  const { targetLow: low, targetHigh: high, targetMean: mean, price } = item
  const range = low !== null && high !== null && mean !== null && high > low
  const pos = (value: number) => `${Math.min(100, Math.max(0, ((value - low!) / (high! - low!)) * 100))}%`
  const rating = RATINGS.indexOf(item.recommendation)
  return (
    <article className="p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[11.5px] font-medium">
          {item.countryName} · <span className="font-mono">{item.symbol}</span>
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">Ашгийн тайлан</span>
      </div>
      <h3 className="mt-2.5 text-[17px] leading-snug font-semibold">{item.name}</h3>
      <div className="mt-2">
        <When ms={dayStartMs(item.reportDate)} now={now} allDay />
      </div>

      <dl className="mt-4 grid grid-cols-[1fr_1.8fr_0.9fr] divide-x divide-border rounded-lg border border-border">
        {[
          ["EPS таамаг", item.epsEstimate !== null ? plainNumber(item.epsEstimate) : ""],
          ["Орлогын таамаг", item.revenueEstimate !== null ? bigMoney(item.revenueEstimate, item.currency) : ""],
          ["Шинжээч", item.analysts ? String(item.analysts) : ""],
        ].map(([name, value]) => (
          <div key={name} className="min-w-0 px-3 py-2.5">
            <dt className="truncate text-[10.5px] text-muted-foreground">{name}</dt>
            <dd className={cn("mt-0.5 truncate font-mono text-[14px] font-semibold tabular-nums", value ? "" : "text-muted-foreground")}>{value || "–"}</dd>
          </div>
        ))}
      </dl>

      {range ? (
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="text-muted-foreground">Шинжээчдийн зорилтот үнэ</span>
            {upside !== null ? (
              <span className={cn("font-mono font-semibold tabular-nums", upside >= 0 ? UP : DOWN)}>
                {upside >= 0 ? "▲ +" : "▼ "}
                {upside.toFixed(1)}%
              </span>
            ) : null}
          </div>
          <div className="relative mt-5 h-2 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700">
            <span className="bg-brand absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-card" style={{ left: pos(mean!) }}>
              <span className="text-brand-strong absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10.5px] font-semibold whitespace-nowrap">{plainNumber(mean!)}</span>
            </span>
            {price !== null ? (
              <span className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground" style={{ left: pos(price) }}>
                <span className="absolute top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap text-foreground/80">одоо {plainNumber(price)}</span>
              </span>
            ) : null}
          </div>
          <div className="mt-6 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
            <span>Доод {plainNumber(low!)}</span>
            <span>{item.currency}</span>
            <span>Дээд {plainNumber(high!)}</span>
          </div>
        </div>
      ) : null}

      {rating >= 0 ? (
        <div className="mt-4">
          <p className="text-[11px] text-muted-foreground">Шинжээчдийн зөвлөмж</p>
          <div className="mt-1.5 grid grid-cols-5 gap-1">
            {RATINGS.map((key, index) => (
              <span key={key} className={cn("h-1.5 rounded-full", index === rating ? (index >= 3 ? "bg-[var(--up)]" : index === 2 ? "bg-gray-500" : "bg-[var(--down)]") : "bg-foreground/[0.06]")} />
            ))}
          </div>
          <p className="mt-1 text-[12.5px] font-semibold">{recommendationLabel[item.recommendation]}</p>
        </div>
      ) : null}

      {item.mnSummary ? <p className="mt-4 text-[14px] leading-relaxed text-foreground/80">{item.mnSummary}</p> : null}
      {stockChart(item) ? null : (
        <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-foreground/80 dark:bg-blue-800/50">
          График байхгүй.{" "}
          <a className="text-brand-strong underline" href={`https://finance.yahoo.com/quote/${encodeURIComponent(item.symbol)}`} target="_blank" rel="noreferrer">
            Yahoo Finance дээр харах
          </a>
        </p>
      )}

      {sameDay.length > 1 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className={label}>Мөн энэ өдөр</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sameDay
              .filter((row) => row.symbol !== item.symbol)
              .map((row) => (
                <button key={row.symbol} type="button" onClick={() => onPick({ kind: "earn", symbol: row.symbol })} className="rounded-full border border-border px-2.5 py-1 text-[12px] hover:bg-foreground/[0.05]">
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
/* Day rail: the calendar beside the chart, one line per item          */
/* ------------------------------------------------------------------ */

function DayRail(props: {
  econ: Cluster[]
  earnings: EarningsEvent[]
  week: string
  day: string
  today: string
  now: number
  pick: Pick | null
  loading: boolean
  canBack: boolean
  canForward: boolean
  onWeek: (step: number) => void
  onDay: (day: string) => void
  onPick: (pick: Pick) => void
  /** The picked item's explanation: replaces the list until «Буцах». */
  detail: ReactNode
}) {
  const { econ, earnings, week, day, today, now, pick, onDay, onPick, detail } = props
  // List or one item's page; the list keeps its scroll position across the round trip.
  const [reading, setReading] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  const scroll = useRef(0)
  const page = useRef<HTMLDivElement>(null)
  const pickKey = pick ? (pick.kind === "econ" ? pick.id : pick.symbol) : ""
  useEffect(() => {
    if (reading) page.current?.scrollTo({ top: 0 })
  }, [pickKey, reading])
  useEffect(() => {
    if (!reading && list.current) list.current.scrollTop = scroll.current
  }, [reading])
  useEffect(() => {
    scroll.current = 0
    setReading(false)
  }, [day])
  const open = (next: Pick) => {
    scroll.current = list.current?.scrollTop ?? 0
    onPick(next)
    setReading(true)
  }
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index))
  const releasesOf = (target: string) => econ.filter((cluster) => cluster.day === target).flatMap((cluster) => cluster.events)
  const reportsOf = (target: string) => earnings.filter((item) => item.reportDate === target).sort((a, b) => (b.analysts ?? 0) - (a.analysts ?? 0))
  const releases = releasesOf(day)
  const reports = reportsOf(day)
  const row = "grid w-full grid-cols-[2.6rem_0.4rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-[7px] text-left transition-colors"

  return (
    // xl: as tall as the chart beside it; the list scrolls inside.
    <aside aria-label="Календарь" className={cn(panel, "flex min-w-0 flex-col overflow-hidden xl:h-0 xl:min-h-full")}>
      {reading ? (
        <>
          <div className="flex items-center justify-between gap-2 border-b px-2 py-2">
            <button type="button" onClick={() => setReading(false)} className="hover:bg-foreground/[0.05] flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors">
              <span className="text-[17px] leading-none" aria-hidden>
                ‹
              </span>
              Буцах
            </button>
            <span className="text-muted-foreground pr-2 text-[11.5px]">{dayName(day, today)}</span>
          </div>
          <div ref={page} className="max-h-[640px] min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin] xl:max-h-none">
            {detail}
          </div>
        </>
      ) : (
        <>
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <p className={label}>
          {Number(week.slice(5, 7))}-р сарын {Number(week.slice(8))}–{Number(addDays(week, 6).slice(8))}
        </p>
        <div className="flex gap-1">
          <button type="button" className={weekArrow} onClick={() => props.onWeek(-1)} disabled={!props.canBack} aria-label="Өмнөх долоо хоног">
            ‹
          </button>
          <button type="button" className={weekArrow} onClick={() => props.onWeek(1)} disabled={!props.canForward} aria-label="Дараагийн долоо хоног">
            ›
          </button>
        </div>
      </div>
      <div role="tablist" aria-label="Өдөр" className="grid grid-cols-7 gap-0.5 border-b border-border p-1.5">
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
                selected ? "bg-foreground text-background" : "hover:bg-foreground/[0.05]",
                !selected && target < today ? "opacity-45" : "",
              )}
            >
              <span className={cn("text-[10.5px]", selected ? "" : target === today ? "text-brand-strong font-semibold" : "text-muted-foreground")}>
                {target === today ? "Өнөө" : shortWeekdays[weekdayOf(target)]}
              </span>
              <span className="text-[13px] leading-tight font-semibold tabular-nums">{Number(target.slice(8))}</span>
              <span className={cn("font-mono text-[9.5px] tabular-nums", selected ? "opacity-60" : "text-muted-foreground")}>{count || "·"}</span>
            </button>
          )
        })}
      </div>
      <ul ref={list} className="relative max-h-[560px] min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1.5 [scrollbar-width:thin] xl:max-h-none">
        {props.loading ? <li className="mx-2 my-2 h-40 animate-pulse rounded-lg bg-muted" /> : null}
        {!props.loading && !releases.length && !reports.length ? <li className="px-2 py-6 text-center text-[12px] text-muted-foreground">Энэ өдөр мэдээ алга.</li> : null}
        {releases.map((event) => {
          const selected = pick?.kind === "econ" && pick.id === event.id
          const past = Date.parse(event.startsAt) < now - 5 * 60_000
          const high = event.impact === "High"
          return (
            <li key={event.id} data-picked={selected || undefined}>
              <button
                type="button"
                onClick={() => open({ kind: "econ", id: event.id })}
                title={`${event.mnTitle || event.title} · ${event.country}`}
                className={cn(row, selected ? "bg-blue-100 dark:bg-blue-800" : "hover:bg-foreground/[0.04]", past && !selected ? "opacity-50" : "")}
              >
                <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">{ubParts(event.startsAt).time}</span>
                <span className={cn("size-1.5 rounded-full", high ? "" : "bg-gray-300 dark:bg-gray-600")} style={high ? { background: HOT } : undefined} />
                <span className="truncate text-[12.5px]">{event.mnTitle || event.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{event.actual ? <span className="text-brand-strong font-semibold">{event.actual}</span> : event.forecast}</span>
              </button>
            </li>
          )
        })}
        {reports.map((item) => {
          const selected = pick?.kind === "earn" && pick.symbol === item.symbol
          const upside = upsideOf(item)
          return (
            <li key={item.symbol} data-picked={selected || undefined}>
              <button
                type="button"
                onClick={() => open({ kind: "earn", symbol: item.symbol })}
                title={`${item.name} · ${item.countryName}`}
                className={cn(row, selected ? "bg-blue-100 dark:bg-blue-800" : "hover:bg-foreground/[0.04]", day < today && !selected ? "opacity-50" : "")}
              >
                <span className="text-[10px] text-muted-foreground">Тайлан</span>
                <span className="size-1.5 rounded-sm bg-foreground/70" />
                <span className="truncate text-[12.5px]">{item.name}</span>
                <span className={cn("font-mono text-[11px] font-semibold tabular-nums", upside === null ? "text-muted-foreground" : upside >= 0 ? UP : DOWN)}>
                  {upside === null ? "–" : `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
        </>
      )}
    </aside>
  )
}
