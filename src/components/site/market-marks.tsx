export function toneClass(pct: number) {
  if (pct > 0) return "text-emerald-700 dark:text-emerald-400"
  if (pct < 0) return "text-red-700 dark:text-red-400"
  return "text-muted-foreground"
}

export function signedPct(pct: number) {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`
}

export function DivergeBar({ pct, max }: { pct: number; max: number }) {
  const width = max <= 0 ? 0 : Math.min(50, (Math.abs(pct) / max) * 50)
  const positive = pct > 0
  return (
    <span aria-hidden className="bg-foreground/10 relative block h-2 overflow-hidden rounded-full">
      <span className="bg-foreground/40 absolute inset-y-0 left-1/2 w-px" />
      {width > 0 ? (
        <span
          className={`absolute inset-y-0 ${positive ? "left-1/2 bg-emerald-600" : "right-1/2 bg-red-600"}`}
          style={{ width: `${width}%` }}
        />
      ) : null}
    </span>
  )
}

export function ShareBar({ value, max }: { value: number; max: number }) {
  const width = max <= 0 ? 0 : Math.min(100, (value / max) * 100)
  return (
    <span aria-hidden className="bg-foreground/10 relative block h-2 overflow-hidden rounded-full">
      <span className="absolute inset-y-0 left-0 bg-foreground/70" style={{ width: `${width}%` }} />
    </span>
  )
}
