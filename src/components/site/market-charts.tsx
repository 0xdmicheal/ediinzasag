import { useEffect, useState, type KeyboardEvent } from "react"
import { useLocation } from "react-router-dom"
import { cn } from "cn"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Minus } from "lucide-react"

import { signedPct } from "@/components/site/market-marks"
import { money } from "@/components/site/money"
import type { CloseRow, Quote } from "@/content/markets"

/*
 * Charts for the markets page. Up/down marks use --up / --down (validated for
 * colour-vision deficiency in both themes) and always carry ▲/▼ plus a sign,
 * so direction never depends on colour alone. Numbers use the sans face.
 */

export function parseNumber(value: string) {
  return Number.parseFloat(value.replace(/[,%+]/g, "").replace("−", "-"))
}

function grouped(value: number, digits = 2) {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** ▲ +0.49% / ▼ −1.25%; moves under 0.1% read as "barely changed" and stay neutral. */
export function ChangePill({ pct, size = "md" }: { pct: number; size?: "md" | "lg" }) {
  const flat = Math.abs(pct) < 0.005
  const Icon = flat ? Minus : pct > 0 ? ArrowUp : ArrowDown
  const tone =
    Math.abs(pct) < 0.1
      ? "bg-foreground/[0.07] text-muted-foreground"
      : pct > 0
        ? "bg-[color-mix(in_oklch,var(--up)_12%,transparent)] text-[var(--up)]"
        : "bg-[color-mix(in_oklch,var(--down)_12%,transparent)] text-[var(--down)]"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold tabular-nums",
        size === "lg" ? "h-8 px-3 text-sm" : "h-6 px-2 text-xs",
        tone,
      )}
    >
      <Icon className={size === "lg" ? "size-4" : "size-3"} strokeWidth={2.5} />
      {flat ? "0.00%" : signedPct(pct).replace("-", "−")}
    </span>
  )
}

// Brand chart rule: cobalt = up, gray = down (text keeps green/red with ▲/▼).
const markColor = (pct: number) => (pct >= 0 ? "bg-[var(--mark-up)]" : "bg-[var(--mark-down)]")

/* ------------------------------------------------------------------ */
/* ТОП-20 checkpoints                                                  */
/* ------------------------------------------------------------------ */

export interface Checkpoint {
  label: string
  value: number
  exact: boolean
}

/**
 * Column chart of the index level at a few checkpoints. Only points that can be
 * derived from published figures are drawn; no daily path is invented between them.
 */
export function CheckpointChart({ points, high }: { points: Checkpoint[]; high: number }) {
  const top = Math.ceil((Math.max(high, ...points.map((point) => point.value)) * 1.08) / 10000) * 10000
  const ticks = Array.from({ length: top / 20000 + 1 }, (_, index) => index * 20000).filter((tick) => tick <= top)
  const y = (value: number) => (value / top) * 100

  return (
    <figure>
      <div className="relative h-64 sm:h-72">
        {/* Gridlines + y ticks */}
        {ticks.map((tick) => (
          <div key={tick} className="absolute inset-x-0 flex items-center" style={{ bottom: `${y(tick)}%` }}>
            <span className="text-muted-foreground w-9 shrink-0 pr-2 text-right text-[11px] tabular-nums sm:w-12">
              {tick === 0 ? "0" : `${tick / 1000}k`}
            </span>
            <span className="bg-border h-px flex-1" />
          </div>
        ))}

        {/* All-time high reference */}
        <div className="absolute right-0 left-9 flex items-center sm:left-12" style={{ bottom: `${y(high)}%` }}>
          <span className="bg-brand h-px flex-1" />
          <span className="bg-card text-brand-strong absolute -top-5 left-0 px-1 text-[11px] font-medium tabular-nums">
            Түүхэн дээд {grouped(high)}
          </span>
        </div>

        {/* Columns */}
        <div className="absolute inset-y-0 right-0 left-9 grid grid-cols-4 items-end sm:left-12">
          {points.map((point, index) => {
            const last = index === points.length - 1
            return (
              <div key={point.label} className="group relative flex h-full min-w-0 flex-col items-center justify-end">
                <span
                  className={cn(
                    "mb-1.5 text-[11px] font-semibold whitespace-nowrap tabular-nums sm:text-xs",
                    last ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {point.exact ? "" : "≈ "}
                  {grouped(point.value, point.exact ? 2 : 0)}
                </span>
                <span
                  tabIndex={0}
                  aria-label={`${point.label}: ${grouped(point.value, 0)} оноо`}
                  className={cn(
                    "w-6 rounded-t-[4px] transition-opacity outline-none group-hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring",
                    last ? "bg-brand" : "bg-foreground/25",
                  )}
                  style={{ height: `${y(point.value)}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="ml-9 grid grid-cols-4 border-t pt-2 sm:ml-12">
        {points.map((point, index) => (
          <span
            key={point.label}
            className={cn(
              "px-0.5 text-center text-[11px] leading-tight sm:text-[11px]",
              index === points.length - 1 ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            {point.label}
          </span>
        ))}
      </div>
      <figcaption className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
        ≈ тэмдэгтэй багана нь нийтэлсэн 1 сар, 1 жилийн өөрчлөлтөөс тооцсон түвшин. Өдөр бүрийн хөдөлгөөнийг харуулаагүй.
      </figcaption>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* World indices ranked by today's move                               */
/* ------------------------------------------------------------------ */

export function IndexRanking({
  quotes,
  describe,
  region,
}: {
  quotes: Quote[]
  describe: (id: string) => string
  region: (id: string) => string
}) {
  const rows = [...quotes].sort((a, b) => b.pct - a.pct)
  const max = Math.max(...rows.map((row) => Math.abs(row.pct)))

  return (
    <ul className="bg-card divide-y rounded-lg border">
      {rows.map((row) => {
        const width = (Math.abs(row.pct) / max) * 50
        return (
          <li
            key={row.id}
            id={row.id}
            className="hover:bg-muted/50 target:bg-muted grid scroll-mt-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_7.5rem] sm:px-5"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-semibold">{row.label}</span>
                <span className="text-muted-foreground bg-foreground/[0.06] rounded-sm px-1.5 text-[11px] leading-5">
                  {region(row.id)}
                </span>
              </span>
              <span className="text-muted-foreground block truncate text-xs">{describe(row.id)}</span>
            </span>

            <span aria-hidden className="relative col-span-2 h-3.5 sm:order-none sm:col-span-1">
              <span className="bg-border absolute inset-y-[-4px] left-1/2 w-px" />
              <span
                className={cn("absolute inset-y-0", markColor(row.pct), row.pct >= 0 ? "rounded-r-[4px]" : "rounded-l-[4px]")}
                style={row.pct >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
              />
            </span>

            <span className="row-start-1 flex flex-col items-end gap-1 sm:row-start-auto">
              <span className="text-sm font-semibold tabular-nums">
                {row.price} <span className="text-muted-foreground text-[11px] font-normal">оноо</span>
              </span>
              <ChangePill pct={row.pct} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Mongolian stock explorer                                            */
/* ------------------------------------------------------------------ */

export function StockExplorer({ rows: input, reportHref }: { rows: CloseRow[]; reportHref: string }) {
  const rows = [...input].sort((a, b) => b.pct - a.pct)
  const [symbol, setSymbol] = useState(rows[0]?.symbol ?? "")
  const { hash } = useLocation()

  // A link such as /markets#lend (from the home-page ticker) opens that stock.
  useEffect(() => {
    const match = input.find((item) => `#${item.symbol.toLowerCase()}` === hash)
    if (match) setSymbol(match.symbol)
  }, [hash, input])
  const index = Math.max(0, rows.findIndex((row) => row.symbol === symbol))
  const row = rows[index]
  if (!row) return null

  const close = parseNumber(row.price)
  const prev = close - parseNumber(row.move)
  const max = Math.max(...rows.map((item) => Math.abs(item.pct)))
  const go = (step: number) => setSymbol(rows[(index + step + rows.length) % rows.length].symbol)

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault()
      go(1)
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault()
      go(-1)
    }
  }

  // Previous close → today, on a scale padded around the two prices.
  const lo = Math.min(prev, close)
  const hi = Math.max(prev, close)
  const pad = (hi - lo) * 0.9 || close * 0.05
  const pos = (value: number) => ((value - (lo - pad)) / (hi - lo + pad * 2)) * 100

  return (
    <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
      {/* Picker */}
      <div
        role="tablist"
        aria-label="Хувьцаа сонгох"
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:rounded-lg lg:border lg:bg-card lg:p-1.5 lg:pb-1.5"
      >
        {rows.map((item) => {
          const selected = item.symbol === row.symbol
          return (
            <button
              key={item.symbol}
              id={item.symbol.toLowerCase()}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setSymbol(item.symbol)}
              className={cn(
                "flex shrink-0 scroll-mt-28 items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors lg:border-transparent",
                selected ? "bg-muted border-foreground/15 lg:border-transparent" : "bg-card hover:bg-muted/60 lg:bg-transparent",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                  selected ? "bg-brand text-brand-foreground" : "bg-muted text-foreground/70",
                )}
              >
                {item.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="text-muted-foreground text-[11px]">{item.symbol}</span>
              </span>
              <span className="hidden text-right sm:block">
                <span className="block text-sm font-semibold tabular-nums">{money(item.price, item.currency)}</span>
                <span className={cn("text-[11px] font-semibold tabular-nums", item.pct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
                  {item.pct >= 0 ? "▲" : "▼"} {signedPct(item.pct).replace("-", "−")}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Detail */}
      <article role="tabpanel" aria-live="polite" className="bg-card rounded-lg border p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="bg-brand text-brand-foreground grid size-14 shrink-0 place-items-center rounded-full text-2xl font-semibold">
              {row.name.slice(0, 1)}
            </span>
            <div>
              <h3 className="text-2xl font-semibold leading-tight sm:text-3xl">{row.name}</h3>
              <p className="text-muted-foreground text-sm">
                {row.symbol} · Монголын хөрөнгийн бирж
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button type="button" aria-label="Өмнөх хувьцаа" onClick={() => go(-1)} className="hover:bg-muted grid size-9 place-items-center rounded-full border">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label="Дараах хувьцаа" onClick={() => go(1)} className="hover:bg-muted grid size-9 place-items-center rounded-full border">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-5xl font-semibold tracking-tight sm:text-6xl">{money(row.price, row.currency)}</p>
          <div className="flex flex-col gap-1">
            <ChangePill pct={row.pct} size="lg" />
            <span className="text-muted-foreground text-xs">
              Өмнөх өдрөөс {row.move.replace("-", "−")}₮
            </span>
          </div>
        </div>

        {/* Previous close → today */}
        <div className="mt-8">
          <p className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">Өмнөх өдрөөс өнөөдөр</p>
          <div className="relative mt-8 h-2">
            <span className="bg-muted absolute inset-0 rounded-full" />
            <span
              className={cn("absolute inset-y-0 rounded-full", markColor(row.pct))}
              style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }}
            />
            <span
              className="border-card bg-foreground/40 absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: `${pos(prev)}%` }}
            />
            <span
              className={cn("border-card absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2", markColor(row.pct))}
              style={{ left: `${pos(close)}%` }}
            />
            <span className="text-muted-foreground absolute -top-6 -translate-x-1/2 text-[11px] whitespace-nowrap" style={{ left: `${pos(prev)}%` }}>
              Өмнөх
            </span>
            <span className="absolute -top-6 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap" style={{ left: `${pos(close)}%` }}>
              Өнөөдөр
            </span>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-3 gap-3">
          {[
            ["Өмнөх хаалт", money(grouped(prev), row.currency)],
            ["Өнөөдрийн хаалт", money(row.price, row.currency)],
            ["Арилжсан ширхэг", row.volume],
          ].map(([label, value]) => (
            <div key={label} className="bg-muted/50 rounded-md p-3">
              <dt className="text-muted-foreground text-[11px]">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Compared with the others; clicking a bar selects that stock */}
        <div className="mt-8">
          <p className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">Бусад хувьцаатай харьцуулбал</p>
          <ul className="mt-3 flex flex-col gap-1">
            {rows.map((item) => {
              const selected = item.symbol === row.symbol
              const width = (Math.abs(item.pct) / max) * 50
              return (
                <li key={item.symbol}>
                  <button
                    type="button"
                    onClick={() => setSymbol(item.symbol)}
                    aria-label={`${item.name} ${signedPct(item.pct)}`}
                    className="hover:bg-muted/60 grid w-full grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md px-1.5 py-1 text-left"
                  >
                    <span className={cn("text-xs", selected ? "font-semibold" : "text-muted-foreground")}>{item.symbol}</span>
                    <span className="relative h-3">
                      <span className="bg-border absolute inset-y-[-3px] left-1/2 w-px" />
                      <span
                        className={cn(
                          "absolute inset-y-0",
                          selected ? markColor(item.pct) : "bg-foreground/20",
                          item.pct >= 0 ? "rounded-r-[4px]" : "rounded-l-[4px]",
                        )}
                        style={item.pct >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                      />
                    </span>
                    <span className={cn("text-right text-xs tabular-nums", selected ? "font-semibold" : "text-muted-foreground")}>
                      {item.pct >= 0 ? "▲" : "▼"} {signedPct(item.pct).replace("-", "−")}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <p className="text-muted-foreground mt-6 text-[11px]">
          Эх сурвалж:{" "}
          <a className="underline" href={reportHref}>
            МХБ-ийн 2026.10.02-ны тайлан
          </a>
          . Өмнөх хаалтыг өнөөдрийн хаалт ба өөрчлөлтөөс тооцов.
        </p>
      </article>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Most traded (one series → one colour)                               */
/* ------------------------------------------------------------------ */

export function ValueBars({ rows }: { rows: { key: string; name: string; value: string; weight: number }[] }) {
  const max = Math.max(...rows.map((row) => row.weight))
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <li key={row.key} className="grid grid-cols-[1.25rem_minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">{index + 1}</span>
          <span className="truncate font-medium">{row.name}</span>
          <span className="h-3">
            <span className="bg-brand block h-full rounded-r-[4px]" style={{ width: `${(row.weight / max) * 100}%` }} />
          </span>
          <span className="font-semibold tabular-nums">{row.value}</span>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* Performance: every market on one diverging axis, three time frames  */
/* ------------------------------------------------------------------ */

export interface PerformanceRow {
  id: string
  label: string
  group: string
  /** % since the previous refresh (2026.10.02). */
  since?: number
  /** % since 1 January. */
  ytd?: number
  /** % over 12 months. */
  year?: number
  /** "10.02: 7,722.72 → 7,765.36" style detail shown on hover / focus. */
  detail?: string
}

type Frame = "since" | "ytd" | "year"

const frames: { key: Frame; label: string; note: string }[] = [
  { key: "since", label: "10.02-оос хойш", note: "Өмнөх шинэчлэлээс (2026.10.02) хойших өөрчлөлт." },
  { key: "ytd", label: "Оны эхнээс", note: "1-р сарын 1-нээс хойш. Эх сурвалж оны эхний тоог нийтэлсэн зах зээлүүд." },
  { key: "year", label: "12 сард", note: "Сүүлийн 12 сарын өөрчлөлт. Эх сурвалж зөвхөн 12 сарын тоо нийтэлсэн зах зээлүүд." },
]

/**
 * Ranked diverging bars. Blue = up, gray = down (the site's chart rule), and
 * every value carries ▲/▼ and a sign, so direction never rests on colour.
 * Each time frame only lists markets whose source publishes that measure:
 * mixing a 12-month change into a year-to-date ranking would be wrong.
 */
export function PerformanceChart({ rows }: { rows: PerformanceRow[] }) {
  const [frame, setFrame] = useState<Frame>("since")
  const [view, setView] = useState<"map" | "list">("map")
  const visible = rows
    .filter((row) => row[frame] !== undefined)
    .map((row) => ({ ...row, value: row[frame] as number }))
    .sort((a, b) => b.value - a.value)
  const max = Math.max(...visible.map((row) => Math.abs(row.value)), 0.01)
  const note = frames.find((item) => item.key === frame)!.note

  return (
    <figure className="bg-card rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div role="group" aria-label="Хугацаа" className="bg-muted inline-flex rounded-full p-1">
          {frames.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={frame === item.key}
              onClick={() => setFrame(item.key)}
              className={cn(
                "ez-hit h-8 rounded-full px-3 text-[13px] font-medium transition-colors",
                frame === item.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden items-center gap-3 text-[11px] sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-[var(--mark-up)]" aria-hidden /> Өссөн
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-[var(--mark-down)]" aria-hidden /> Буурсан
            </span>
          </span>
          <div role="group" aria-label="Харагдац" className="flex rounded-full border p-0.5">
            {(
              [
                ["map", "Дулааны зураг"],
                ["list", "Эрэмбэ"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "ez-hit h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                  view === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "map" ? (
        <ul className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3 sm:p-3 lg:grid-cols-4 xl:grid-cols-6">
          {visible.map((row) => {
            const up = row.value >= 0
            // Shade by size of move, capped at 55% so ink stays readable in both themes.
            const share = 10 + Math.round((Math.abs(row.value) / max) * 45)
            return (
              <li
                key={row.id}
                tabIndex={0}
                aria-label={`${row.label}: ${signedPct(row.value).replace("-", "−")}${row.detail ? `. ${row.detail}` : ""}`}
                title={row.detail}
                className="flex min-h-[5.5rem] flex-col justify-between rounded-md p-3 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:min-h-[6.5rem]"
                style={{ background: `color-mix(in oklch, var(${up ? "--mark-up" : "--mark-down"}) ${share}%, transparent)` }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{row.label}</span>
                  <span className="text-foreground/70 block truncate text-[11px]">{row.group}</span>
                </span>
                <span className="text-lg font-semibold tabular-nums sm:text-xl">
                  {up ? "▲" : "▼"} {signedPct(row.value).replace("-", "−")}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
      <ol className="divide-y">
        {visible.map((row) => {
          const width = (Math.abs(row.value) / max) * 50
          const up = row.value >= 0
          return (
            <li
              key={row.id}
              tabIndex={0}
              aria-label={`${row.label}: ${signedPct(row.value).replace("-", "−")}${row.detail ? `. ${row.detail}` : ""}`}
              className="group hover:bg-muted/50 focus-visible:bg-muted/50 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_4.5rem] items-center gap-3 px-4 py-2.5 outline-none sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_5.5rem] sm:px-5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{row.label}</span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  <span className="group-hover:hidden group-focus-visible:hidden">{row.group}</span>
                  <span className="hidden tabular-nums group-hover:inline group-focus-visible:inline">{row.detail ?? row.group}</span>
                </span>
              </span>
              <span aria-hidden className="relative h-3">
                <span className="bg-border absolute inset-y-[-6px] left-1/2 w-px" />
                <span
                  className={cn("absolute inset-y-0", up ? "rounded-r-[4px] bg-[var(--mark-up)]" : "rounded-l-[4px] bg-[var(--mark-down)]")}
                  style={up ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                />
              </span>
              <span className={cn("text-right text-sm font-semibold tabular-nums", up ? "text-[var(--up)]" : "text-[var(--down)]")}>
                {up ? "▲" : "▼"} {signedPct(row.value).replace("-", "−")}
              </span>
            </li>
          )
        })}
      </ol>
      )}
      <figcaption className="text-muted-foreground border-t px-4 py-3 text-[11px] leading-relaxed sm:px-5">{note}</figcaption>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* US yield curve: one country, one date, one axis                     */
/* ------------------------------------------------------------------ */

export function YieldCurve({ points }: { points: { label: string; yield: number }[] }) {
  const width = 360
  const height = 190
  const pad = { top: 30, right: 36, bottom: 30, left: 40 }
  // Points sit inside the plot, clear of the axis labels.
  const inset = 28
  const lo = Math.floor(Math.min(...points.map((point) => point.yield)) * 2) / 2 - 0.25
  const hi = Math.ceil(Math.max(...points.map((point) => point.yield)) * 2) / 2 + 0.25
  const ticks: number[] = []
  for (let tick = Math.ceil(lo * 2) / 2; tick <= hi + 1e-9; tick += 0.5) ticks.push(tick)
  const x = (index: number) => pad.left + inset + (index * (width - pad.left - pad.right - inset)) / (points.length - 1)
  const y = (value: number) => pad.top + ((hi - value) * (height - pad.top - pad.bottom)) / (hi - lo)
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.yield)}`).join(" ")
  const label = `АНУ-ын засгийн газрын бондын өгөөж: ${points.map((point) => `${point.label} ${point.yield}%`).join(", ")}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label={label}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right / 2} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
          <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
            {tick.toFixed(1)}%
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => (
        <g key={point.label} tabIndex={0} className="outline-none [&:focus-visible>circle:nth-of-type(2)]:stroke-[var(--ring)]">
          <title>{`${point.label}: ${point.yield}%`}</title>
          <circle cx={x(index)} cy={y(point.yield)} r={14} fill="transparent" />
          <circle cx={x(index)} cy={y(point.yield)} r={4.5} fill="var(--brand)" className="stroke-card" strokeWidth={2} />
          <text x={x(index)} y={y(point.yield) - 12} textAnchor="middle" className="fill-foreground text-[11px] font-semibold tabular-nums">
            {point.yield.toFixed(2)}%
          </text>
          <text x={x(index)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Export mix: one 100% bar, four labelled parts                       */
/* ------------------------------------------------------------------ */

/**
 * Categorical colours --cat-1..4 (index.css) were checked with the dataviz
 * validator on this site's light and dark cards. In light mode the aqua and
 * yellow sit under 3:1 against the card, so every part is also named with its
 * value below the bar: colour is never the only key.
 */
export function ExportMix({ parts, total }: { parts: { key: string; label: string; value: number; growth?: number }[]; total: number }) {
  const sum = parts.reduce((acc, part) => acc + part.value, 0)
  return (
    <div>
      <div className="flex h-5 gap-[2px]" role="img" aria-label={parts.map((part) => `${part.label} ${part.value} тэрбум ам.доллар`).join(", ")}>
        {parts.map((part, index) => (
          <span
            key={part.key}
            title={`${part.label}: ${part.value} тэрбум ам.доллар (${Math.round((part.value / sum) * 100)}%)`}
            className={cn("h-full", index === 0 && "rounded-l-[4px]", index === parts.length - 1 && "rounded-r-[4px]")}
            style={{ width: `${(part.value / sum) * 100}%`, background: `var(--cat-${index + 1})` }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {parts.map((part, index) => (
          <div key={part.key} className="min-w-0">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--cat-${index + 1})` }} aria-hidden />
              <span className="truncate">{part.label}</span>
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {part.value} <span className="text-muted-foreground text-xs font-normal">тэрбум $</span>
            </dd>
            <dd className="text-muted-foreground text-[11px] tabular-nums">
              {Math.round((part.value / total) * 100)}%{part.growth !== undefined ? ` · ▲ ${part.growth}% жилээр` : ""}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
