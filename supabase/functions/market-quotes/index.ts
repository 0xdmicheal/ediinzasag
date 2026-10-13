// EZ market quotes: a Supabase Edge Function (Deno) behind the Markets hero.
//
// Saves the six "today" numbers to public.market_quotes, each with its daily
// move and a sparkline of recent closes:
//   Yahoo Finance chart API: ам.доллар/төгрөг (MNT=X), copper (HG=F), gold
//                            (GC=F), Brent (BZ=F). Price, daily %, 1-month closes.
//   Trading Economics:       MSE TOP-20 and Newcastle coal, which Yahoo doesn't
//                            carry. Read from the page's own summary sentence;
//                            the sparkline is built up from our earlier runs.
//
// Runs from pg_cron every 15 minutes (see schema.sql) with the x-cron-secret
// header (NEWS_CRON_SECRET), or for a signed-in editor/admin. No Gemini.
// Deploy with --no-verify-jwt, like market-calendar.
// QUOTES_DRY_RUN=1 reads the sources and prints what it found, without the database.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

const DRY = Boolean(Deno.env.get("QUOTES_DRY_RUN"))
const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
const SPARK_POINTS = 30
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

interface Row {
  id: string
  price: number
  pct: number
  month_pct: number | null
  year_pct: number | null
  spark: number[]
  as_of: string
  source: string
  href: string
  updated_at: string
}

const YAHOO: Record<string, string> = { mnt: "MNT=X", copper: "HG=F", gold: "GC=F", brent: "BZ=F" }
const TRADING_ECONOMICS: Record<string, string> = {
  top20: "https://tradingeconomics.com/mongolia/stock-market",
  coal: "https://tradingeconomics.com/commodity/coal",
}

const round = (n: number, digits = 4) => Number(n.toFixed(digits))

/** One sparkline point per day from our own runs: replace today's point, add a new day's. */
function grow(before: Row | undefined, asOf: string, price: number) {
  const history = before?.spark ?? []
  const sameDay = before?.as_of?.slice(0, 10) === asOf.slice(0, 10)
  return [...(sameDay ? history.slice(0, -1) : history), round(price)].slice(-SPARK_POINTS)
}

async function yahoo(id: string, symbol: string, before: Row | undefined): Promise<Row> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`
  const response = await fetch(url, { headers: { "User-Agent": BROWSER }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${symbol}: Yahoo ${response.status}`)
  const result = (await response.json())?.chart?.result?.[0]
  const meta = result?.meta
  const price = Number(meta?.regularMarketPrice)
  if (!Number.isFinite(price)) throw new Error(`${symbol}: no price`)
  const closes = ((result?.indicators?.quote?.[0]?.close ?? []) as (number | null)[]).filter((n): n is number => typeof n === "number")
  const asOf = new Date(Number(meta.regularMarketTime) * 1000).toISOString()
  // The last daily bar is today's, still moving: end the line on the live price.
  // Yahoo keeps almost no daily history for MNT=X, so there the line is built up from our earlier runs.
  const spark = closes.length >= 5 ? [...closes.slice(0, -1), price].slice(-SPARK_POINTS).map((n) => round(n)) : grow(before, asOf, price)
  const first = closes.length >= 5 ? closes[0] : null
  const pct = Number(meta.regularMarketChangePercent ?? (meta.chartPreviousClose ? (price / meta.chartPreviousClose - 1) * 100 : 0))
  return {
    id,
    price: round(price),
    pct: round(pct, 3),
    month_pct: first ? round((price / first - 1) * 100, 2) : null,
    year_pct: null,
    spark,
    as_of: asOf,
    source: "Yahoo Finance",
    href: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    updated_at: new Date().toISOString(),
  }
}

const DOWN = /\b(fell|fall|fallen|falling|down|loss|losing|lost|decreas\w*|declin\w*|drop\w*|shed\w*|slid|slipp\w*|lower\w*|eas\w*)\b/i

/** A signed % from a phrase like "gaining 0.59%" or "has fallen 1.2%". */
function signed(phrase: string | undefined) {
  if (!phrase) return null
  const number = phrase.match(/(-?\d+(?:\.\d+)?)%/)
  if (!number) return null
  return round(Number(number[1]) * (DOWN.test(phrase) ? -1 : 1), 2)
}

/**
 * Trading Economics opens every market page with one sentence, e.g. "…the MSE 20,
 * rose to 67087 points on October 13, 2026, gaining 0.59% from the previous
 * session. Over the past month, the index has climbed 5.50% and is up 36.40%
 * compared to the same time last year…". That sentence is what we read.
 */
async function tradingEconomics(id: string, url: string, before: Row | undefined): Promise<Row> {
  const response = await fetch(url, { headers: { "User-Agent": BROWSER, "Accept-Language": "en" }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`${id}: Trading Economics ${response.status}`)
  const html = await response.text()
  const text = (html.match(/<meta id="metaDesc" name="description" content="([^"]+)"/)?.[1] ?? "").replace(/&#39;/g, "'")
  const price = Number(text.match(/ to ([\d,]+(?:\.\d+)?)/)?.[1]?.replace(/,/g, "") ?? html.match(/"last":([\d.]+)/)?.[1])
  if (!Number.isFinite(price) || price <= 0) throw new Error(`${id}: no price on the page`)
  const date = text.match(/ on ([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1]
  const day = date ? new Date(`${date} 12:00 UTC`) : new Date()
  const pct = signed(text.match(/,\s*([^,.]*?\d+(?:\.\d+)?% from the previous)/)?.[1]) ?? 0
  const month = signed(text.match(/past month,([^.]*?\d+(?:\.\d+)?%)/)?.[1])
  const year = signed(text.match(/((?:up|down)\s+\d+(?:\.\d+)?%) compared to the same time last year/)?.[1])

  const asOf = day.toISOString()
  const spark = grow(before, asOf, price)
  return { id, price: round(price), pct, month_pct: month, year_pct: year, spark, as_of: asOf, source: "Trading Economics", href: url, updated_at: new Date().toISOString() }
}

async function run(db: SupabaseClient | null) {
  const before = new Map<string, Row>()
  if (db) {
    const { data } = await db.from("market_quotes").select("*")
    for (const row of (data ?? []) as Row[]) before.set(row.id, row)
  }
  const jobs = [
    ...Object.entries(YAHOO).map(([id, symbol]) => yahoo(id, symbol, before.get(id))),
    ...Object.entries(TRADING_ECONOMICS).map(([id, url]) => tradingEconomics(id, url, before.get(id))),
  ]
  const results = await Promise.allSettled(jobs)
  const rows = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
  const failures = results.flatMap((result) => (result.status === "rejected" ? [String(result.reason?.message ?? result.reason).slice(0, 160)] : []))
  if (!db) return { rows, failures }
  if (rows.length) {
    const { error } = await db.from("market_quotes").upsert(rows, { onConflict: "id" })
    if (error) throw error
  }
  return { saved: rows.map((row) => row.id), failures }
}

if (DRY) {
  console.log(JSON.stringify(await run(null), null, 1))
} else {
  Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS })
    if (request.method !== "POST") return json({ error: "POST only" }, 405)
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

    const cronSecret = Deno.env.get("NEWS_CRON_SECRET")
    if (!(cronSecret && request.headers.get("x-cron-secret") === cronSecret)) {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
      const { data } = await db.auth.getUser(token)
      if (!data.user) return json({ error: "Нэвтэрнэ үү" }, 401)
      const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
      if (profile?.role !== "editor" && profile?.role !== "admin") return json({ error: "Редактор, админ л ажиллуулна" }, 403)
    }
    try {
      return json(await run(db))
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500)
    }
  })
}
