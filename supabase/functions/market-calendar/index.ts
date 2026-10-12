// EZ market calendar: a Supabase Edge Function (Deno) behind Markets → Календарь.
//
//   { "part": "econ" }      this week's economic events (Forex Factory, High and
//                           Medium impact), plus a Mongolian name and short
//                           explanation for every indicator not seen before.
//   { "part": "earnings" }  next report date, estimates and analyst targets
//                           (Yahoo Finance) for the large caps in
//                           _shared/large-caps.ts, plus a short Mongolian
//                           summary for reports in the next three weeks.
//   { "part": "all" }       both (default).
//
// Runs from pg_cron (econ every 6 hours, earnings daily; see schema.sql) with
// the x-cron-secret header (NEWS_CRON_SECRET), or for a signed-in editor/admin.
// Gemini: CALENDAR_GEMINI_MODEL if set, else the cheapest Flash-Lite the key
// can call (_shared/gemini.ts). Deploy with --no-verify-jwt, like news-agent.
// CALENDAR_DRY_RUN=1 reads the sources and prints what it found: no database, no Gemini.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

import { cheapestLite, geminiAsk } from "../_shared/gemini.ts"
import { CURRENCIES, LARGE_CAPS } from "../_shared/large-caps.ts"
import { lintStyle } from "../_shared/style-lint.ts"

const DRY = Boolean(Deno.env.get("CALENDAR_DRY_RUN"))
const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

const served = new Set<string>()
function ask<T>(system: string, prompt: string, schema: object) {
  const chosen = Deno.env.get("CALENDAR_GEMINI_MODEL")?.trim()
  return geminiAsk<T>({ system, prompt, schema, models: chosen ? [chosen] : [], backups: () => cheapestLite(), served })
}

/** House style for every Mongolian line the calendar shows (the style book, condensed for short texts). */
const STYLE =
  "You write short Mongolian (Cyrillic) texts for EZ Эдийн засаг, a Mongolian economics newsroom, for general readers. " +
  "Write as a Mongolian economics journalist, never as a translation: natural word order, Mongolian terms (ДНБ, инфляц, бодлогын хүү, ажилгүйдлийн түвшин, ам.доллар). " +
  "Address readers as «та» if at all, never «чи». Calm and factual; hedge interpretations («…гэж үздэг», «…байж болно»), never the facts. " +
  "Digits for numbers. No em or en dashes (— –) anywhere; use a comma or «буюу». Quotes in «…». Never give investment advice."

/** Mechanical style fixes (dashes, quotes, иен…) on a short text. */
function tidy(text: string) {
  let draft = { title: "", dek: "", take: "", body: text }
  for (const hit of lintStyle(draft)) if (hit.fix) draft = hit.fix(draft)
  return draft.body.trim()
}

/* ------------------------------------------------------------------ */
/* Economic calendar                                                    */
/* ------------------------------------------------------------------ */

interface FFEvent {
  title: string
  country: string
  date: string
  impact: string
  forecast?: string
  previous?: string
  actual?: string
}

const GLOSSARY_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "The English title exactly as given" },
          currency: { type: "string", description: "The currency code exactly as given" },
          mn_title: { type: "string", description: "Short Mongolian name of the indicator with the country, e.g. «АНУ-ын инфляц (CPI), сараар»" },
          mn_summary: { type: "string", description: "1-2 Mongolian sentences, max 220 characters: what it measures and why markets watch it" },
        },
        required: ["title", "currency", "mn_title", "mn_summary"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
}

async function econ(db: SupabaseClient | null) {
  const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", { headers: { "User-Agent": BROWSER }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Forex Factory: HTTP ${response.status}`)
  const all = (await response.json()) as FFEvent[]
  const events = all
    .filter((event) => (event.impact === "High" || event.impact === "Medium") && CURRENCIES[event.country])
    .map((event) => ({
      id: `${event.date}|${event.country}|${event.title}`,
      starts_at: new Date(event.date).toISOString(),
      currency: event.country,
      title: event.title.trim(),
      impact: event.impact,
      forecast: event.forecast ?? "",
      previous: event.previous ?? "",
      actual: event.actual ?? "",
      updated_at: new Date().toISOString(),
    }))
  if (!db) return { events: events.length, sample: events.slice(0, 5).map((e) => `${e.starts_at} ${e.currency} ${e.impact} ${e.title} f:${e.forecast} p:${e.previous}`) }

  const { error } = await db.from("econ_events").upsert(events, { onConflict: "id" })
  if (error) throw error
  await db.from("econ_events").delete().lt("starts_at", new Date(Date.now() - 21 * 86_400_000).toISOString())

  // Mongolian for indicators we have not explained before (the same ones come back every week).
  const { data: known } = await db.from("econ_glossary").select("title, currency")
  const have = new Set((known ?? []).map((row: { title: string; currency: string }) => `${row.title}|${row.currency}`))
  const missing = [...new Map(events.filter((e) => !have.has(`${e.title}|${e.currency}`)).map((e) => [`${e.title}|${e.currency}`, e])).values()]
  let explained = 0
  const failures: string[] = []
  for (let start = 0; start < missing.length; start += 30) {
    const batch = missing.slice(start, start + 30)
    try {
      const answer = await ask<{ items: { title: string; currency: string; mn_title: string; mn_summary: string }[] }>(
        STYLE,
        "Give each economic calendar indicator below a short Mongolian name (with the country or region) and a one or two sentence " +
          "Mongolian explanation for ordinary readers: what it measures and why markets watch it. Do not mention this week's numbers. " +
          "Return the title and currency exactly as given.\n\n" +
          batch.map((e) => `- title: ${e.title} | currency: ${e.currency} (${CURRENCIES[e.currency].mn})`).join("\n"),
        GLOSSARY_SCHEMA,
      )
      const valid = new Set(batch.map((e) => `${e.title}|${e.currency}`))
      const rows = (answer?.items ?? [])
        .filter((item) => valid.has(`${item.title}|${item.currency}`) && item.mn_title.trim() && item.mn_summary.trim())
        .map((item) => ({ title: item.title, currency: item.currency, mn_title: tidy(item.mn_title), mn_summary: tidy(item.mn_summary), model: [...served].join(" + ") }))
      if (rows.length) {
        const { error: glossaryError } = await db.from("econ_glossary").upsert(rows, { onConflict: "title,currency" })
        if (glossaryError) throw glossaryError
      }
      explained += rows.length
    } catch (error) {
      failures.push(error instanceof Error ? error.message.slice(0, 200) : String(error))
    }
  }
  return { events: events.length, newIndicators: missing.length, explained, failures }
}

/* ------------------------------------------------------------------ */
/* Earnings calendar                                                    */
/* ------------------------------------------------------------------ */

/** Yahoo's quote API wants a session cookie and a matching "crumb". */
async function yahooSession() {
  const first = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": BROWSER }, redirect: "manual", signal: AbortSignal.timeout(15_000) })
  await first.body?.cancel()
  const cookie = first.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ")
  const crumb = await (await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": BROWSER, Cookie: cookie }, signal: AbortSignal.timeout(15_000) })).text()
  if (!crumb || crumb.length > 40 || crumb.includes("<")) throw new Error("Yahoo: session (crumb) авч чадсангүй")
  return { cookie, crumb }
}

type Raw = { raw?: number; fmt?: string } | undefined
const num = (value: Raw) => (typeof value?.raw === "number" && Number.isFinite(value.raw) ? value.raw : null)

async function quote(symbol: string, session: { cookie: string; crumb: string }) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,calendarEvents,financialData&crumb=${encodeURIComponent(session.crumb)}`
  const response = await fetch(url, { headers: { "User-Agent": BROWSER, Cookie: session.cookie }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${symbol}: HTTP ${response.status}`)
  const result = (await response.json())?.quoteSummary?.result?.[0]
  if (!result) throw new Error(`${symbol}: өгөгдөл алга`)
  const earnings = result.calendarEvents?.earnings ?? {}
  const date = num(earnings.earningsDate?.[0])
  const fin = result.financialData ?? {}
  return {
    name: result.price?.shortName || result.price?.longName || symbol,
    currency: result.price?.currency ?? "",
    report_date: date ? new Date(date * 1000).toISOString().slice(0, 10) : null,
    eps_estimate: num(earnings.earningsAverage),
    revenue_estimate: num(earnings.revenueAverage),
    price: num(fin.currentPrice) ?? num(result.price?.regularMarketPrice),
    target_mean: num(fin.targetMeanPrice),
    target_low: num(fin.targetLowPrice),
    target_high: num(fin.targetHighPrice),
    analysts: num(fin.numberOfAnalystOpinions),
    recommendation: fin.recommendationKey && fin.recommendationKey !== "none" ? String(fin.recommendationKey) : "",
  }
}

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          mn_summary: { type: "string", description: "2 Mongolian sentences, max 260 characters" },
        },
        required: ["symbol", "mn_summary"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
}

const compact = (n: number) =>
  Math.abs(n) >= 1e12 ? `${(n / 1e12).toFixed(2)} их наяд` : Math.abs(n) >= 1e9 ? `${(n / 1e9).toFixed(1)} тэрбум` : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(0)} сая` : String(n)

async function earnings(db: SupabaseClient | null, deadline: number) {
  const session = await yahooSession()
  const rows: Record<string, unknown>[] = []
  const failures: string[] = []
  for (let start = 0; start < LARGE_CAPS.length; start += 6) {
    const batch = LARGE_CAPS.slice(start, start + 6)
    const results = await Promise.allSettled(batch.map((company) => quote(company.symbol, session)))
    results.forEach((result, index) => {
      if (result.status === "fulfilled") rows.push({ symbol: batch[index].symbol, country: batch[index].country, ...result.value, updated_at: new Date().toISOString() })
      else failures.push(String(result.reason?.message ?? result.reason).slice(0, 120))
    })
  }
  if (!db) return { companies: rows.length, failures, sample: rows.slice(0, 5) }

  const { error } = await db.from("earnings_events").upsert(rows, { onConflict: "symbol" })
  if (error) throw error

  // Mongolian summaries for reports in the next three weeks that don't have one for this date yet.
  const today = new Date().toISOString().slice(0, 10)
  const soon = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10)
  const { data: due } = await db
    .from("earnings_events")
    .select("*")
    .gte("report_date", today)
    .lte("report_date", soon)
    .order("report_date")
  const todo = (due ?? []).filter((row) => row.summary_for !== row.report_date && (row.eps_estimate !== null || row.target_mean !== null))
  let summarized = 0
  for (let start = 0; start < todo.length && Date.now() < deadline; start += 10) {
    const batch = todo.slice(start, start + 10)
    const lines = batch.map((row) => {
      const upside = row.price && row.target_mean ? ((row.target_mean / row.price - 1) * 100).toFixed(1) : null
      return [
        `- symbol: ${row.symbol} | company: ${row.name} | reports: ${row.report_date} | currency: ${row.currency}`,
        row.eps_estimate !== null ? `EPS estimate ${row.eps_estimate}` : "",
        row.revenue_estimate !== null ? `revenue estimate ${compact(row.revenue_estimate)} ${row.currency}` : "",
        row.price !== null ? `price ${row.price}` : "",
        row.target_mean !== null ? `analyst target mean ${row.target_mean} (low ${row.target_low}, high ${row.target_high}), ${upside}% from price` : "",
        row.analysts ? `${row.analysts} analysts` : "",
        row.recommendation ? `consensus: ${row.recommendation}` : "",
      ].filter(Boolean).join(" | ")
    })
    try {
      const answer = await ask<{ items: { symbol: string; mn_summary: string }[] }>(
        STYLE,
        "For each company report below, write two short Mongolian sentences for readers: what analysts expect this quarter " +
          "(earnings per share, revenue if given) and where their average target price stands against the current price " +
          "(say the % gap and the consensus in Mongolian: худалдаж авах, хадгалах, зарах). Use only the numbers given; " +
          "the company name may stay in Latin. Return the symbol exactly as given.\n\n" + lines.join("\n"),
        SUMMARY_SCHEMA,
      )
      const bySymbol = new Map((answer?.items ?? []).map((item) => [item.symbol, tidy(item.mn_summary)]))
      for (const row of batch) {
        const summary = bySymbol.get(row.symbol)
        if (!summary) continue
        const { error: updateError } = await db.from("earnings_events").update({ mn_summary: summary, summary_for: row.report_date }).eq("symbol", row.symbol)
        if (!updateError) summarized += 1
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message.slice(0, 200) : String(error))
    }
  }
  return { companies: rows.length, due: todo.length, summarized, failures }
}

/* ------------------------------------------------------------------ */
/* Entry                                                                */
/* ------------------------------------------------------------------ */

async function runParts(db: SupabaseClient | null, part: string) {
  // Supabase stops an edge function at ~150 s; summaries stop starting after 110 s.
  const deadline = Date.now() + 110_000
  const result: Record<string, unknown> = {}
  if (part === "econ" || part === "all") result.econ = await econ(db).catch((error) => ({ error: String(error?.message ?? error) }))
  if (part === "earnings" || part === "all") result.earnings = await earnings(db, deadline).catch((error) => ({ error: String(error?.message ?? error) }))
  result.models = [...served]
  return result
}

if (DRY) {
  console.log(JSON.stringify(await runParts(null, Deno.args[0] ?? "all"), null, 1))
} else {
  Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS })
    if (request.method !== "POST") return json({ error: "POST only" }, 405)
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
    const body = (await request.json().catch(() => ({}))) as { part?: string }
    const part = body.part === "econ" || body.part === "earnings" ? body.part : "all"

    const cronSecret = Deno.env.get("NEWS_CRON_SECRET")
    if (!(cronSecret && request.headers.get("x-cron-secret") === cronSecret)) {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
      const { data } = await db.auth.getUser(token)
      if (!data.user) return json({ error: "Нэвтэрнэ үү" }, 401)
      const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
      if (profile?.role !== "editor" && profile?.role !== "admin") return json({ error: "Редактор, админ л ажиллуулна" }, 403)
    }
    if (!Deno.env.get("GEMINI_API_KEY")) return json({ error: "GEMINI_API_KEY тохируулаагүй байна" }, 500)
    return json(await runParts(db, part))
  })
}
