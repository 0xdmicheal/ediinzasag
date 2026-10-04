import { Link } from "react-router-dom"

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
  { id: "top20", label: "ТОП-20", price: top20.price, move: "+0.49%", pct: top20.pct },
  ...mongoliaIndices.filter((quote) => quote.id !== "cap").map((quote) => ({
    id: quote.id,
    label: quote.label,
    price: quote.price,
    move: quote.move,
    pct: quote.pct,
  })),
  ...fridayCloses.map((row) => ({
    id: row.symbol.toLowerCase(),
    label: row.symbol,
    price: row.price,
    move: row.move,
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
    price: quote.price,
    move: quote.move,
    pct: quote.pct,
  })),
  ...miners.map((row) => ({
    id: row.symbol.toLowerCase(),
    label: row.symbol,
    price: row.price,
    move: row.move,
    pct: row.pct,
  })),
]

function tone(pct: number) {
  if (pct > 0) return "text-emerald-700 dark:text-emerald-400"
  if (pct < 0) return "text-red-700 dark:text-red-400"
  return "text-muted-foreground"
}

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
                <span className={tone(item.pct)}>{item.move}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
