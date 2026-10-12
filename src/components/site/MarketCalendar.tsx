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

function TargetBar({ item }: { item: EarningsEvent }) {
  const { targetLow: low, targetHigh: high, targetMean: mean, price } = item
  if (low === null || high === null || mean === null || high <= low) return null
  const span = high - low
  const at = (value: number) => `${Math.min(100, Math.max(0, ((value - low) / span) * 100))}%`
  return (
    <div className="mt-2" aria-hidden>
      <div className="bg-foreground/10 relative h-1.5 rounded-full">
        <span className="bg-brand absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: at(mean) }} title="Дундаж зорилт" />
        {price !== null ? <span className="bg-foreground absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2" style={{ left: at(price) }} title="Одоогийн үнэ" /> : null}
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between font-mono text-[10px] tabular-nums">
        <span>{plainNumber(low)}</span>
        <span>{plainNumber(high)}</span>
      </div>
    </div>
  )
}

function EarningsCard({ item }: { item: EarningsEvent }) {
  const upside = item.price && item.targetMean ? (item.targetMean / item.price - 1) * 100 : null
  return (
    <li className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{item.name}</p>
          <p className="text-muted-foreground text-[12px]">
            {item.countryName} · <span className="font-mono">{item.symbol}</span>
          </p>
        </div>
        {item.recommendation ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              item.recommendation.includes("buy") ? "bg-[color-mix(in_oklch,var(--up)_14%,transparent)] text-[var(--up)]" : item.recommendation === "hold" ? "bg-foreground/[0.07]" : "bg-[color-mix(in_oklch,var(--down)_12%,transparent)] text-[var(--down)]",
            )}
          >
            {recommendationLabel[item.recommendation] ?? item.recommendation}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Figure label="EPS таамаг" value={item.epsEstimate !== null ? plainNumber(item.epsEstimate) : ""} />
        <Figure label="Орлогын таамаг" value={item.revenueEstimate !== null ? bigMoney(item.revenueEstimate, item.currency) : ""} />
        <Figure label="Шинжээч" value={item.analysts ? String(item.analysts) : ""} />
      </div>
      {item.targetMean !== null ? (
        <div>
          <p className="text-[12.5px]">
            Зорилтот үнэ <span className="font-mono font-semibold tabular-nums">{plainNumber(item.targetMean)}</span>
            {item.price !== null ? <span className="text-muted-foreground"> · одоо {plainNumber(item.price)}</span> : null}
            {upside !== null ? (
              <span className={cn("ml-1.5 font-mono text-[12px] font-semibold tabular-nums", upside >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
                {upside >= 0 ? "▲ +" : "▼ "}
                {upside.toFixed(1)}%
              </span>
            ) : null}
            <span className="text-muted-foreground"> {item.currency}</span>
          </p>
          <TargetBar item={item} />
        </div>
      ) : null}
      {item.mnSummary ? <p className="text-muted-foreground border-t pt-3 text-[12.5px] leading-relaxed">{item.mnSummary}</p> : null}
    </li>
  )
}

function EarningsList({ items }: { items: EarningsEvent[] }) {
  const [country, setCountry] = useState("all")
  const countries = useMemo(() => [...new Map(items.map((item) => [item.country, { name: item.countryName }])).entries()], [items])
  const shown = country === "all" ? items : items.filter((item) => item.country === country)
  if (!items.length) return <p className="text-muted-foreground text-sm">Ойрын 60 хоногт тайлан гаргах компани алга.</p>
  return (
    <div className="flex flex-col gap-5">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {[["all", { name: "Бүх улс" }] as const, ...countries].map(([code, info]) => (
          <button
            key={code}
            type="button"
            aria-pressed={country === code}
            onClick={() => setCountry(code)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-[12.5px] whitespace-nowrap transition-colors",
              country === code ? "bg-foreground text-background border-transparent" : "bg-card hover:border-foreground/30",
            )}
          >
            {info.name}
          </button>
        ))}
      </div>
      {groupBy(shown, (item) => item.reportDate).map(([day, list]) => (
        <section key={day} aria-label={dayLabel(day)}>
          <h3 className="mb-2 text-[13px] font-semibold">
            {dayLabel(day)} <span className="text-muted-foreground font-normal">· {list.length} компани</span>
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((item) => (
              <EarningsCard key={item.symbol} item={item} />
            ))}
          </ul>
        </section>
      ))}
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
