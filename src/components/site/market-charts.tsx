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
        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
        : "bg-red-500/12 text-red-700 dark:text-red-400"
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

const markColor = (pct: number) => (pct >= 0 ? "bg-[var(--up)]" : "bg-[var(--down)]")

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
            <span className="text-muted-foreground w-12 shrink-0 pr-2 text-right text-[10px] tabular-nums">
              {tick === 0 ? "0" : `${tick / 1000}k`}
            </span>
            <span className="bg-border h-px flex-1" />
          </div>
        ))}

        {/* All-time high reference */}
        <div className="absolute right-0 left-12 flex items-center" style={{ bottom: `${y(high)}%` }}>
          <span className="bg-brand h-px flex-1" />
          <span className="bg-card text-brand-strong absolute -top-5 left-0 px-1 text-[11px] font-medium tabular-nums">
            Түүхэн дээд {grouped(high)}
          </span>
        </div>

        {/* Columns */}
        <div className="absolute inset-y-0 right-0 left-12 flex items-end justify-around">
          {points.map((point, index) => {
            const last = index === points.length - 1
            return (
              <div key={point.label} className="group relative flex h-full flex-col items-center justify-end">
                <span
                  className={cn(
                    "mb-1.5 text-xs font-semibold whitespace-nowrap tabular-nums",
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
      <div className="ml-12 flex justify-around border-t pt-2">
        {points.map((point, index) => (
          <span
            key={point.label}
            className={cn(
              "w-20 text-center text-[11px] leading-tight",
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
                <span className="text-muted-foreground bg-foreground/[0.06] rounded-sm px-1.5 text-[10px] leading-5">
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
                <span className={cn("text-[11px] font-semibold tabular-nums", item.pct >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
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
