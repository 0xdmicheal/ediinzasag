import { hasSupabase } from "@/lib/supabase-env"

/*
 * Markets hero: what supabase/functions/market-quotes stores in
 * public.market_quotes every 15 minutes. Without Supabase, or before the first
 * run, the page falls back to the hand-written closes in content/markets.ts.
 */

export interface LiveQuote {
  id: string
  price: number
  pct: number
  monthPct: number | null
  yearPct: number | null
  /** Recent daily closes, oldest first; the last point is the latest price. */
  spark: number[]
  asOf: string
  source: string
  href: string
  updatedAt: string
}

interface Row {
  id: string
  price: number | string
  pct: number | string
  month_pct: number | string | null
  year_pct: number | string | null
  spark: (number | string)[] | null
  as_of: string
  source: string
  href: string
  updated_at: string
}

const num = (value: number | string | null) => (value === null ? null : Number(value))

export async function loadLiveQuotes(): Promise<LiveQuote[]> {
  if (!hasSupabase) return []
  const { supabaseClient } = await import("@/lib/supabase")
  const { data, error } = await supabaseClient().from("market_quotes").select("*")
  if (error) throw error
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    price: Number(row.price),
    pct: Number(row.pct),
    monthPct: num(row.month_pct),
    yearPct: num(row.year_pct),
    spark: (row.spark ?? []).map(Number),
    asOf: row.as_of,
    source: row.source,
    href: row.href,
    updatedAt: row.updated_at,
  }))
}
