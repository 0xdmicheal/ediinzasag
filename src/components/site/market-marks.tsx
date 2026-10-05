export function toneClass(pct: number) {
  if (pct > 0) return "text-emerald-700 dark:text-emerald-400"
  if (pct < 0) return "text-red-700 dark:text-red-400"
  return "text-muted-foreground"
}

export function signedPct(pct: number) {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`
}
