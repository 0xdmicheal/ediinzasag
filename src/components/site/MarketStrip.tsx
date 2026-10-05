import { useCallback, useEffect, useRef } from "react"
import { Link } from "react-router-dom"

import { signedPct } from "@/components/site/market-marks"
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

const SLOW_RATE = 0.25

/**
 * Eases the ticker's CSS animation between full speed and a slow crawl, so
 * hovering (or tapping, or focusing a price) slows it down instead of stopping it.
 */
function useEasedSpeed() {
  const track = useRef<HTMLDivElement>(null)
  const target = useRef(1)
  const frame = useRef(0)

  const ease = useCallback(function step() {
    const animation = track.current?.getAnimations()[0]
    if (!animation) return
    const next = animation.playbackRate + (target.current - animation.playbackRate) * 0.08
    const done = Math.abs(next - target.current) < 0.01
    animation.playbackRate = done ? target.current : next
    if (!done) frame.current = requestAnimationFrame(step)
  }, [])

  const setSpeed = useCallback(
    (rate: number) => {
      target.current = rate
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(ease)
    },
    [ease],
  )

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return {
    track,
    handlers: {
      onPointerEnter: () => setSpeed(SLOW_RATE),
      onPointerLeave: () => setSpeed(1),
      onFocus: () => setSpeed(SLOW_RATE),
      onBlur: () => setSpeed(1),
    },
  }
}

export function MarketStrip() {
  const loop = [...ticks, ...ticks]
  const { track, handlers } = useEasedSpeed()

  return (
    // A glass band on the page background: light in day mode, dark in night mode.
    <section aria-label="Ханшийн зурвас" className="bg-card border-y font-mono">
      <div className="price-ticker relative" {...handlers}>
        <div ref={track} className="price-ticker-track flex h-10 w-max items-center sm:h-11">
          {loop.map((item, index) => (
            <Link
              key={`${item.id}-${index}`}
              to={`/markets#${item.id}`}
              tabIndex={index < ticks.length ? 0 : -1}
              className="hover:bg-foreground/5 flex h-full items-center gap-2 px-3.5 text-[12px] sm:px-4 sm:text-[13px]"
            >
              <span className="text-muted-foreground uppercase">{item.label}</span>
              <span className="text-foreground">{item.price}</span>
              <span className={item.pct > 0 ? "text-[var(--up)]" : item.pct < 0 ? "text-[var(--down)]" : "text-muted-foreground"}>
                {item.pct > 0 ? "▲" : item.pct < 0 ? "▼" : ""}
                {item.move.replace(/^[+\-−]/, "")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
