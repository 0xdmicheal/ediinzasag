import { useEffect, useMemo, useState } from "react"
import { cn } from "cn"

import { SectionHeader } from "@/components/site/home-sections"
import { loadCalendar, recommendationLabel, type CalendarData, type EarningsEvent, type EconEvent } from "@/content/calendar"

/*
 * Markets → Календарь: this week's economic releases with a Mongolian name and
 * explanation, and the coming earnings reports of the top-20 economies' large
 * caps with analysts' estimates and target prices. Times are Ulaanbaatar time.
 */

const weekdays = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"]
const TZ = "Asia/Ulaanbaatar"

/** "2026-10-14" and "20:30" in Ulaanbaatar time. */
function ubParts(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

function dayLabel(day: string) {
  const today = ubParts(new Date().toISOString()).day
  const tomorrow = ubParts(new Date(Date.now() + 86_400_000).toISOString()).day
  const [, month, date] = day.split("-")
  const weekday = weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]
  const relative = day === today ? " · Өнөөдөр" : day === tomorrow ? " · Маргааш" : ""
  return `${Number(month)}-р сарын ${Number(date)} · ${weekday}${relative}`
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return [...groups]
}

const plainNumber = (n: number, digits = 2) => n.toLocaleString("en-US", { maximumFractionDigits: n >= 1000 ? 0 : digits, minimumFractionDigits: 0 })

function bigMoney(n: number, currency: string) {
  const unit = Math.abs(n) >= 1e12 ? [1e12, "их наяд"] : Math.abs(n) >= 1e9 ? [1e9, "тэрбум"] : Math.abs(n) >= 1e6 ? [1e6, "сая"] : [1, ""]
  return `${(n / (unit[0] as number)).toLocaleString("en-US", { maximumFractionDigits: 1 })} ${unit[1]} ${currency}`.replace(/\s+/g, " ").trim()
}

function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: { key: T; label: string; count?: number }[]; onChange: (key: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="bg-muted inline-flex w-fit gap-1 rounded-full p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "h-8 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
            value === option.key ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
          {option.count !== undefined ? <span className="ml-1.5 font-mono text-[11px] opacity-70">{option.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

function Impact({ level }: { level: EconEvent["impact"] }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap", level === "High" ? "text-[var(--down)]" : "text-muted-foreground")}>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span key={dot} className={cn("size-1.5 rounded-full", dot < (level === "High" ? 3 : 2) ? "bg-current" : "bg-foreground/15")} />
        ))}
      </span>
      {level === "High" ? "Өндөр" : "Дунд"}
    </span>
  )
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10.5px]">{label}</p>
      <p className={cn("font-mono text-[13px] tabular-nums", strong ? "font-semibold" : "", value ? "" : "text-muted-foreground/60")}>{value || "–"}</p>
    </div>
  )
}

function EconList({ events }: { events: EconEvent[] }) {
  const [onlyHigh, setOnlyHigh] = useState(false)
  const shown = onlyHigh ? events.filter((event) => event.impact === "High") : events
  if (!events.length) return <p className="text-muted-foreground text-sm">Энэ долоо хоногт үлдсэн чухал мэдээлэл алга.</p>
  return (
    <div className="flex flex-col gap-5">
      <Tabs
        label="Нөлөө"
        value={onlyHigh ? "high" : "all"}
        onChange={(key) => setOnlyHigh(key === "high")}
        options={[
          { key: "all", label: "Бүгд", count: events.length },
          { key: "high", label: "Өндөр нөлөөтэй", count: events.filter((event) => event.impact === "High").length },
        ]}
      />
      {groupBy(shown, (event) => ubParts(event.startsAt).day).map(([day, list]) => (
        <section key={day} aria-label={dayLabel(day)}>
          <h3 className="mb-2 text-[13px] font-semibold">{dayLabel(day)}</h3>
          <ul className="bg-card divide-y rounded-lg border">
            {list.map((event) => (
              <li key={event.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[3.25rem_minmax(0,1fr)_4.5rem_14rem] md:items-center">
                <span className="font-mono text-[13px] tabular-nums">{ubParts(event.startsAt).time}</span>
                <div className="min-w-0">
                  <p className="text-[14px] leading-snug font-medium">
                    <span className="bg-foreground/[0.06] text-muted-foreground mr-1.5 rounded px-1.5 py-0.5 align-[1px] text-[10.5px] font-medium">{event.country}</span>
                    {event.mnTitle || event.title}
                  </p>
                  {event.mnSummary ? <p className="text-muted-foreground mt-0.5 text-[12.5px] leading-snug">{event.mnSummary}</p> : null}
                  {event.mnTitle ? <p className="text-muted-foreground/70 mt-0.5 font-mono text-[10.5px]">{event.title}</p> : null}
                </div>
                <span className="col-start-2 md:col-start-auto">
                  <Impact level={event.impact} />
                </span>
                <div className="col-start-2 grid grid-cols-3 gap-2 md:col-start-auto">
                  <Figure label="Бодит" value={event.actual} strong />
                  <Figure label="Таамаг" value={event.forecast} />
                  <Figure label="Өмнөх" value={event.previous} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const shortWeekdays = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"]

/** "2026-10-14" moved by `days`. */
function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Monday of the week that holds `day`. */
const weekStart = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7))

const upsideOf = (item: EarningsEvent) => (item.price && item.targetMean ? (item.targetMean / item.price - 1) * 100 : null)

function Upside({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground/60 font-mono text-[12.5px]">–</span>
  return (
    <span className={cn("font-mono text-[12.5px] font-semibold tabular-nums", value >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
      {value >= 0 ? "▲ +" : "▼ "}
      {value.toFixed(1)}%
    </span>
  )
}

const ROW = "grid-cols-[minmax(0,1fr)_auto_4.75rem] sm:grid-cols-[minmax(0,1fr)_7rem_6.5rem_4.75rem]"

function EarningsRow({ item, open, onToggle }: { item: EarningsEvent; open: boolean; onToggle: () => void }) {
  const details = [
    item.targetMean !== null ? `Зорилт ${plainNumber(item.targetMean)} ${item.currency}` : "",
    item.price !== null ? `одоо ${plainNumber(item.price)}` : "",
    item.revenueEstimate !== null ? `орлогын таамаг ${bigMoney(item.revenueEstimate, item.currency)}` : "",
    item.analysts ? `${item.analysts} шинжээч` : "",
    recommendationLabel[item.recommendation] ?? "",
  ].filter(Boolean)
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn("hover:bg-foreground/[0.03] grid w-full items-center gap-x-3 px-4 py-3 text-left transition-colors", ROW)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("text-muted-foreground w-3 shrink-0 text-[9px] transition-transform", open ? "rotate-90" : "")} aria-hidden>
            ▶
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium">{item.name}</span>
            <span className="text-muted-foreground block truncate text-[11.5px] sm:hidden">
              {item.countryName} · <span className="font-mono">{item.symbol}</span>
            </span>
          </span>
        </span>
        <span className="text-muted-foreground hidden truncate text-[12.5px] sm:block">{item.countryName}</span>
        <span className="text-right font-mono text-[12.5px] tabular-nums sm:text-left">
          <span className="text-muted-foreground mr-1 font-sans text-[10.5px]">EPS</span>
          {item.epsEstimate !== null ? plainNumber(item.epsEstimate) : "–"}
        </span>
        <span className="text-right">
          <Upside value={upsideOf(item)} />
        </span>
      </button>
      {open ? (
        <div className="px-4 pb-4 text-[12.5px] leading-relaxed sm:pl-9">
          {item.mnSummary ? <p>{item.mnSummary}</p> : null}
          {details.length ? <p className="text-muted-foreground mt-1.5 font-mono text-[11.5px] tabular-nums">{details.join(" · ")}</p> : null}
        </div>
      ) : null}
    </li>
  )
}

function EarningsList({ items }: { items: EarningsEvent[] }) {
  const today = ubParts(new Date().toISOString()).day
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) map.set(item.reportDate, (map.get(item.reportDate) ?? 0) + 1)
    return map
  }, [items])
  const reportDays = useMemo(() => [...counts.keys()].sort(), [counts])
  const firstDay = reportDays.find((day) => day >= today) ?? today
  const lastDay = reportDays.at(-1) ?? today
  const [day, setDay] = useState(firstDay)
  const [week, setWeek] = useState(() => weekStart(firstDay))
  const [open, setOpen] = useState<string | null>(null)

  if (!items.length) return <p className="text-muted-foreground text-sm">Ойрын 60 хоногт тайлан гаргах компани алга.</p>

  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index))
  const list = items.filter((item) => item.reportDate === day).sort((a, b) => (b.analysts ?? 0) - (a.analysts ?? 0))
  const canBack = week > weekStart(today)
  const canForward = addDays(week, 7) <= lastDay
  const pick = (next: string) => {
    setDay(next)
    setOpen(null)
  }
  const moveWeek = (step: number) => {
    const next = addDays(week, step * 7)
    setWeek(next)
    // Land on the new week's first day with reports, so the list isn't empty for no reason.
    const week7 = Array.from({ length: 7 }, (_, index) => addDays(next, index)).filter((candidate) => candidate >= today)
    pick(week7.find((candidate) => counts.has(candidate)) ?? week7[0] ?? today)
  }
  const arrow = "bg-card hover:border-foreground/30 grid size-9 shrink-0 place-items-center rounded-full border text-[17px] leading-none transition-colors disabled:pointer-events-none disabled:opacity-30"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button type="button" className={arrow} onClick={() => moveWeek(-1)} disabled={!canBack} aria-label="Өмнөх долоо хоног">
          ‹
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-1" role="tablist" aria-label="Өдөр">
          {days.map((candidate) => {
            const count = counts.get(candidate) ?? 0
            const selected = candidate === day
            return (
              <button
                key={candidate}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`${dayLabel(candidate)}, ${count} компани`}
                disabled={candidate < today}
                onClick={() => pick(candidate)}
                className={cn(
                  "flex min-w-0 flex-col items-center rounded-lg border py-1.5 transition-colors disabled:opacity-35",
                  selected ? "bg-foreground text-background border-transparent" : "bg-card hover:border-foreground/30",
                )}
              >
                <span className={cn("text-[11px]", selected ? "opacity-75" : "text-muted-foreground")}>
                  {candidate === today ? "Өнөө" : shortWeekdays[new Date(`${candidate}T12:00:00Z`).getUTCDay()]}
                </span>
                <span className="text-[15px] leading-tight font-semibold tabular-nums">{Number(candidate.slice(8))}</span>
                <span className={cn("mt-0.5 font-mono text-[10.5px] tabular-nums", selected ? "opacity-75" : count ? "text-brand font-semibold" : "text-muted-foreground/50")}>
                  {count || "·"}
                </span>
              </button>
            )
          })}
        </div>
        <button type="button" className={arrow} onClick={() => moveWeek(1)} disabled={!canForward} aria-label="Дараагийн долоо хоног">
          ›
        </button>
      </div>

      <section aria-label={dayLabel(day)}>
        <h3 className="mb-2 text-[13px] font-semibold">
          {dayLabel(day)} <span className="text-muted-foreground font-normal">· {list.length} компани</span>
        </h3>
        {list.length ? (
          <ul className="bg-card divide-y rounded-lg border">
            <li className={cn("text-muted-foreground hidden gap-x-3 px-4 py-2 text-[11px] sm:grid", ROW)}>
              <span className="pl-5">Компани</span>
              <span>Улс</span>
              <span>Ашгийн таамаг</span>
              <span className="text-right">Зорилт</span>
            </li>
            {list.map((item) => (
              <EarningsRow key={item.symbol} item={item} open={open === item.symbol} onToggle={() => setOpen(open === item.symbol ? null : item.symbol)} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground bg-card rounded-lg border px-4 py-6 text-center text-sm">Энэ өдөр тайлан гаргах компани алга.</p>
        )}
        <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
          Мөрийг дарж шинжээчдийн товч дүгнэлтийг уншина. «Зорилт» нь шинжээчдийн дундаж зорилтот үнэ одоогийн үнээс хэдэн хувиар өндөр, нам байгааг харуулна.
        </p>
      </section>
    </div>
  )
}

export function MarketCalendar() {
  const [data, setData] = useState<CalendarData | null>(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<"econ" | "earnings">("econ")

  useEffect(() => {
    loadCalendar().then(setData, () => setError(true))
  }, [])

  const tabs = (
    <Tabs
      label="Календарь"
      value={tab}
      onChange={setTab}
      options={[
        { key: "econ", label: "Эдийн засгийн" },
        { key: "earnings", label: "Ашгийн тайлан" },
      ]}
    />
  )

  return (
    <section id="calendar" className="scroll-mt-28">
      <SectionHeader title="Календарь">
        <div className="hidden sm:block">{tabs}</div>
      </SectionHeader>
      <div className="-mt-2 mb-4 sm:hidden">{tabs}</div>
      <p className="text-muted-foreground -mt-2 mb-6 max-w-2xl leading-relaxed">
        {tab === "econ"
          ? "Энэ долоо хоногт зах зээлийг хөдөлгөж болох эдийн засгийн мэдээлэл, Улаанбаатарын цагаар. Тайлбарыг хиймэл оюун ухаанаар бэлдэв."
          : "Дэлхийн 20 том эдийн засгийн томоохон компаниудын ойрын тайлан: шинжээчдийн таамаг, зорилтот үнэ. Товч тайлбарыг хиймэл оюун ухаанаар бэлдэв."}
      </p>

      {error ? <p className="text-muted-foreground text-sm">Календарийг ачаалж чадсангүй. Дараа дахин оролдоно уу.</p> : null}
      {!data && !error ? <div className="bg-muted h-48 animate-pulse rounded-lg" aria-label="Ачаалж байна" /> : null}
      {data ? (tab === "econ" ? <EconList events={data.econ} /> : <EarningsList items={data.earnings} />) : null}

      {data ? (
        <p className="text-muted-foreground mt-6 text-[11px] leading-relaxed">
          {data.demo ? "Демо: жишээ өгөгдөл. " : ""}
          Эх сурвалж: {tab === "econ" ? "Forex Factory" : "Yahoo Finance (шинжээчдийн дундаж таамаг)"}
          {data.updatedAt ? ` · Шинэчилсэн ${ubParts(data.updatedAt).day.slice(5).replace("-", ".")} ${ubParts(data.updatedAt).time}` : ""}. Мэдээж энэ бол санхүүгийн зөвлөгөө биш.
        </p>
      ) : null}
    </section>
  )
}
