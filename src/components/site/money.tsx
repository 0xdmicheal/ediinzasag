import type { Currency, Denomination } from "@/content/markets"

/**
 * One place that decides how a value is labelled, so ₮ and $ are never ambiguous:
 * tugrik is written after the number (176.39₮), dollars before it ($102.25),
 * and anything that is not money (index points, exchange rates, yields) says so.
 */

const currencyName: Record<Currency, string> = {
  MNT: "төгрөг",
  USD: "ам.доллар",
}

export function money(value: string, currency: Currency) {
  return currency === "USD" ? `$${value}` : `${value}₮`
}

/** "+11.08" → "+11.08₮" / "+$11.08". Percent moves and words are left as they are. */
export function moneyMove(move: string, currency: Currency) {
  if (move.endsWith("%") || !/^[+\-−]?\d/.test(move)) return move
  const sign = /^[+\-−]/.test(move) ? move[0] : ""
  const rest = sign ? move.slice(1) : move
  return currency === "USD" ? `${sign}$${rest}` : `${sign}${rest}₮`
}

const fxSide: Record<string, (value: string) => string> = {
  USD: (value) => `$${value}`,
  EUR: (value) => `${value} €`,
  JPY: (value) => `${value} иен`,
  CNY: (value) => `${value} юань`,
}

/** EUR/USD 1.1255 → "1 € = $1.1255". */
export function fxSentence(price: string, base: string, quote: string) {
  const one = base === "USD" ? "$1" : fxSide[base]?.("1") ?? `1 ${base}`
  const rate = fxSide[quote]?.(price) ?? `${price} ${quote}`
  return `${one} = ${rate}`
}

/** The main value for any quote, already labelled. */
export function formatValue(price: string, denom: Denomination) {
  switch (denom.kind) {
    case "money":
      return denom.scale ? `${price} ${denom.scale} ${denom.currency === "USD" ? "$" : "₮"}` : money(price, denom.currency)
    case "fx":
      return fxSentence(price, denom.base, denom.quote)
    case "percent":
      return price.endsWith("%") ? price : `${price}%`
    case "index":
      return price
  }
}

export function formatMove(move: string, denom: Denomination) {
  return denom.kind === "money" ? moneyMove(move, denom.currency) : move
}

const chipBase =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-[11px] leading-none font-semibold tracking-wide whitespace-nowrap"

/**
 * Colour-coded tag: cobalt tint for tugrik, outlined for dollars, neutral for points / rates / %.
 * `onInk` is for the inverted --ink surface, which is dark in light mode and light in dark mode.
 */
export function UnitChip({ denom, onInk = false }: { denom: Denomination; onInk?: boolean }) {
  if (denom.kind === "money") {
    return denom.currency === "MNT" ? (
      <span className={`${chipBase} bg-brand-soft text-brand-strong`} title={currencyName.MNT}>
        ₮ MNT
      </span>
    ) : (
      <span
        className={`${chipBase} border ${onInk ? "border-ink-foreground/30 text-ink-foreground" : "border-foreground/25 text-foreground"}`}
        title={currencyName.USD}
      >
        $ USD
      </span>
    )
  }
  const label = denom.kind === "index" ? "Оноо" : denom.kind === "fx" ? "Ханш" : "%"
  const title = denom.kind === "index" ? "Индексийн оноо, валют биш" : denom.kind === "fx" ? "Валютын ханш" : "Хувь"
  return (
    <span className={`${chipBase} ${onInk ? "bg-ink-foreground/10 text-ink-foreground/70" : "bg-foreground/[0.07] text-muted-foreground"}`} title={title}>
      {label}
    </span>
  )
}

/** Key shown at the top of the markets page. */
export function UnitLegend() {
  const items: [Denomination, string][] = [
    [{ kind: "money", currency: "MNT" }, "төгрөг"],
    [{ kind: "money", currency: "USD" }, "ам.доллар"],
    [{ kind: "index" }, "индексийн оноо, валют биш"],
    [{ kind: "fx", base: "USD", quote: "MNT" }, "валютын ханш"],
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      {items.map(([denom, text]) => (
        <li key={text} className="text-muted-foreground flex items-center gap-1.5">
          <UnitChip denom={denom} />
          {text}
        </li>
      ))}
    </ul>
  )
}
