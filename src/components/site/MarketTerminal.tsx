import { useState } from "react"
import { cn } from "cn"
import { ArrowDown, ArrowUp, CandlestickChart, Minus } from "lucide-react"

import { signedPct } from "@/components/site/market-marks"
import { formatValue } from "@/components/site/money"
import { TradingViewChart } from "@/components/site/TradingViewChart"
import { commodities, fx, sessionShort, worldIndices, type Quote } from "@/content/markets"

/*
 * "EZ терминал": the page's one bold element. A fixed-dark panel (studio
 * surface in both themes) with TradingView's chart on the left and a watchlist
 * on the right. The watchlist shows our sourced closes; picking a row loads
 * that market into the chart. Chart prices are TradingView's own feed, so each
 * row also names the TradingView symbol it opens.
 *
 * Up/down text uses the dark-surface pair (#2fae74 ≈ 6.4:1, #f0643f ≈ 5.5:1 on
 * #16181c) and always carries an arrow and a sign.
 */

const STUDIO = "#16181c"
const UP = "text-[#2fae74]"
const DOWN = "text-[#f0643f]"

interface Row {
  label: string
  /** TradingView symbol (checked to render in the free widget). */
  symbol: string
  /** Short code shown under the name. */
  code: string
  /** Our sourced quote, when we have one for this market. */
  quote?: Quote
}

const all = [...worldIndices, ...commodities, ...fx]
const q = (id: string) => all.find((item) => item.id === id)

const groups: { title: string; rows: Row[] }[] = [
  {
    title: "Монголд хамаатай",
    rows: [
      { label: "Зэс", symbol: "OANDA:XCUUSD", code: "XCUUSD", quote: q("copper") },
      { label: "Алт", symbol: "OANDA:XAUUSD", code: "XAUUSD", quote: q("gold") },
      { label: "Брент", symbol: "TVC:UKOIL", code: "UKOIL", quote: q("brent") },
      { label: "WTI", symbol: "TVC:USOIL", code: "USOIL", quote: q("wti") },
      { label: "Ам.доллар/төгрөг", symbol: "FX_IDC:USDMNT", code: "USDMNT", quote: q("mnt") },
      { label: "Ам.доллар/юань", symbol: "FX_IDC:USDCNY", code: "USDCNY", quote: q("cny") },
    ],
  },
  {
    title: "Индекс",
    rows: [
      { label: "S&P 500", symbol: "CAPITALCOM:US500", code: "US500 · CFD", quote: q("spx") },
      { label: "Nasdaq 100", symbol: "CAPITALCOM:US100", code: "US100 · CFD" },
      { label: "Dow", symbol: "CAPITALCOM:US30", code: "US30 · CFD", quote: q("dow") },
      { label: "Nikkei", symbol: "CAPITALCOM:J225", code: "J225 · CFD", quote: q("nikkei") },
      { label: "Hang Seng", symbol: "CAPITALCOM:HK50", code: "HK50 · CFD", quote: q("hsi") },
      { label: "Шанхай", symbol: "SSE:000001", code: "000001", quote: q("shanghai") },
      { label: "DAX", symbol: "XETR:DAX", code: "DAX", quote: q("dax") },
    ],
  },
  {
    title: "Валют, хүү",
    rows: [
      { label: "Евро/ам.доллар", symbol: "FX:EURUSD", code: "EURUSD", quote: q("eur") },
      { label: "Ам.доллар/иен", symbol: "FX:USDJPY", code: "USDJPY", quote: q("jpy") },
      { label: "Долларын индекс", symbol: "CAPITALCOM:DXY", code: "DXY · CFD" },
      { label: "АНУ 10 жил", symbol: "FRED:DGS10", code: "DGS10", quote: q("ust") },
    ],
  },
]

function Change({ pct, moveText }: { pct: number; moveText?: string }) {
  if (pct === 0) {
    return <span className="text-photo-foreground/60 text-[11px]">{moveText && !/\d/.test(moveText) ? "дунд ханш" : moveText || "—"}</span>
  }
  const Icon = Math.abs(pct) < 0.005 ? Minus : pct > 0 ? ArrowUp : ArrowDown
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums", pct > 0 ? UP : DOWN)}>
      <Icon className="size-3" strokeWidth={2.75} />
      {signedPct(pct).replace("-", "−")}
    </span>
  )
}

function priceOf(quote: Quote) {
  return quote.denom.kind === "index" || quote.denom.kind === "percent" ? quote.price : formatValue(quote.price, quote.denom)
}

export function MarketTerminal() {
  const [current, setCurrent] = useState(groups[0].rows[0])
  const [tab, setTab] = useState(0)

  return (
    <section
      id="chart"
      aria-labelledby="terminal-title"
      className="bg-studio text-photo-foreground scroll-mt-28 rounded-xl p-2 sm:p-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pt-1 pb-3 sm:px-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-brand text-brand-foreground grid size-7 place-items-center rounded-md">
            <CandlestickChart className="size-4" strokeWidth={2.25} />
          </span>
          <h2 id="terminal-title" className="font-news text-lg tracking-tight">
            EZ терминал
          </h2>
          <span className="text-photo-foreground/60 hidden font-mono text-[11px] sm:inline">
            {current.label} · {current.code}
          </span>
        </div>
        <p className="text-photo-foreground/60 text-[11px]">Жагсаалт: эх сурвалжийн {sessionShort} · График: TradingView</p>
      </header>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <TradingViewChart
          symbol={current.symbol}
          title={current.label}
          theme="dark"
          background={STUDIO}
          className="h-[460px] rounded-lg border border-white/10 sm:h-[600px]"
        />

        <div className="flex min-h-0 flex-col rounded-lg border border-white/10 xl:h-[600px]">
          {/* Phones and tablets: one group at a time. Desktop: every group in one scrolling list. */}
          <div role="group" aria-label="Бүлэг" className="flex gap-1 border-b border-white/10 p-1.5 xl:hidden">
            {groups.map((group, index) => (
              <button
                key={group.title}
                type="button"
                aria-pressed={tab === index}
                onClick={() => setTab(index)}
                className={cn(
                  "h-9 flex-1 rounded-md px-2 text-[12px] font-medium transition-colors",
                  tab === index ? "bg-white/12 text-photo-foreground" : "text-photo-foreground/60 hover:text-photo-foreground",
                )}
              >
                {group.title}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            {groups.map((group, index) => (
              <div key={group.title} className={cn(index !== tab && "hidden xl:block")}>
                <p className="text-photo-foreground/50 sticky top-0 z-10 hidden border-b border-white/10 bg-[#16181c] px-3 py-2 text-[11px] tracking-[0.14em] uppercase xl:block">
                  {group.title}
                </p>
                <ul>
                  {group.rows.map((row) => {
                    const active = row.symbol === current.symbol
                    return (
                      <li key={row.symbol}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCurrent(row)}
                          className={cn(
                            "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 px-3 py-2.5 text-left transition-colors",
                            active ? "border-brand bg-white/8" : "border-transparent hover:bg-white/5",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-medium">{row.label}</span>
                            <span className="text-photo-foreground/50 block font-mono text-[11px]">{row.code}</span>
                          </span>
                          <span className="flex flex-col items-end gap-0.5">
                            <span className="text-[14px] font-semibold tabular-nums">{row.quote ? priceOf(row.quote) : "—"}</span>
                            {row.quote ? (
                              <Change pct={row.quote.pct} moveText={row.quote.move} />
                            ) : (
                              <span className="text-photo-foreground/50 text-[11px]">зөвхөн график</span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-photo-foreground/50 border-t border-white/10 px-3 py-2 text-[11px] leading-relaxed">
            Мөр сонгоход график солигдоно. График дээрх хайлтаар бусад хөрөнгийг нээнэ.
          </p>
        </div>
      </div>

      <p className="text-photo-foreground/55 px-2 pt-3 pb-1 text-[11px] leading-relaxed sm:px-3">
        Графикийн үнэ TradingView-ийнх (шууд эсвэл хоцрогдолтой), индексийг CFD хэлбэрээр харуулав, жагсаалтын эх сурвалжтай хаалтын
        үнээс бага зэрэг зөрж болно. Ньюкаслын нүүрс TradingView-ийн нээлттэй виджетэд байхгүй. Хөрөнгө оруулалтын зөвлөгөө биш.
      </p>
    </section>
  )
}
