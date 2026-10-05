import { Link } from "react-router-dom"

import { signedPct, toneClass } from "@/components/site/market-marks"
import { formatMove, formatValue, money, moneyMove } from "@/components/site/money"

import {
  commodities,
  fridayCloses,
  miners,
  mongoliaIndices,
  top20,
  worldIndices,
} from "@/content/markets"

interface Tick {
  id: string
  label: string
  price: string
  move: string
  pct: number
}

const ticks: Tick[] = [
  { id: "top20", label: "ТОП-20", price: top20.price, move: signedPct(top20.pct), pct: top20.pct },
  ...mongoliaIndices.filter((quote) => quote.id !== "cap").map((quote) => ({
    id: quote.id,
    label: quote.label,
    price: formatValue(quote.price, quote.denom),
    move: quote.move,
    pct: quote.pct,
  })),
  ...fridayCloses.map((row) => ({
    id: row.symbol.toLowerCase(),
    label: row.symbol,
    price: money(row.price, row.currency),
    move: moneyMove(row.move, row.currency),
    pct: row.pct,
  })),
  ...worldIndices.map((quote) => ({
    id: quote.id,
    label: quote.label,
    price: quote.price,
    move: quote.move,
    pct: quote.pct,
  })),
  ...commodities.map((quote) => ({
    id: quote.id,
    label: quote.label,
    price: formatValue(quote.price, quote.denom),
    move: formatMove(quote.move, quote.denom),
    pct: quote.pct,
  })),
  ...miners.map((row) => ({
    id: row.symbol.toLowerCase(),
    label: row.symbol,
    price: money(row.price, row.currency),
    move: moneyMove(row.move, row.currency),
    pct: row.pct,
  })),
]

export function MarketStrip() {
  const loop = [...ticks, ...ticks]

  return (
    <section aria-label="Ханшийн зурвас" className="border-y">
      <div className="flex h-8 items-stretch">
        <Link
          to="/markets"
          className="bg-background hidden shrink-0 items-center border-r px-3 text-[11px] font-medium tracking-wide uppercase sm:flex"
        >
          Ханш
        </Link>
        <div className="price-ticker relative min-w-0 flex-1">
          <div className="price-ticker-track flex h-8 w-max items-center">
            {loop.map((item, index) => (
              <Link
                key={`${item.id}-${index}`}
                to={`/markets#${item.id}`}
                className="hover:bg-muted flex h-8 items-center gap-2 px-4 text-xs"
              >
                <span className="text-muted-foreground tracking-wide uppercase">{item.label}</span>
                <span className="font-news text-sm leading-none">{item.price}</span>
                <span className={toneClass(item.pct)}>{item.move}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
