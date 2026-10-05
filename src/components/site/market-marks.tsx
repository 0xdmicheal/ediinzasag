export function toneClass(pct: number) {
  if (pct > 0) return "text-[var(--up)]"
  if (pct < 0) return "text-[var(--down)]"
  return "text-muted-foreground"
}

export function signedPct(pct: number) {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`
}
