// EZ news agent: a Supabase Edge Function (Deno).
//
// Once a day (pg_cron, see the end of schema.sql) or when an editor presses
// "Одоо татах" on /admin, it:
//   1. reads world economy and markets RSS feeds,
//   2. asks an AI model which few stories matter most to Mongolian readers,
//   3. has it write each one as a Mongolian briefing (translated, attributed,
//      with "what to verify" notes for the reviewer),
//   4. copies the story's main image into the covers bucket with a credit,
//   5. inserts it as an unclaimed 'bot' article in review.
// Nothing is published here: a person claims the briefing, checks it, adds the
// EZ take and clears the photo before guard_article() lets it go live.
//
// Secrets (supabase secrets set ...): NEWS_CRON_SECRET, and one AI key:
//   GEMINI_API_KEY (free tier) or ANTHROPIC_API_KEY.
// Agent Router (the $ credit balance, Opus 5): set ANTHROPIC_API_KEY to the sk- token,
//   ANTHROPIC_BASE_URL=https://agentrouter.org (no /v1), AI_PROVIDER=claude, CLAUDE_MODEL=claude-opus-5.
// Optional: AI_PROVIDER ("gemini" | "claude"), CLAUDE_MODEL, GEMINI_MODEL, NEWS_PER_RUN (default 3). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are provided by Supabase. Deploy with --no-verify-jwt: the cron call has no
// user token, so this function checks the cron secret or the editor's token itself.

import Anthropic from "npm:@anthropic-ai/sdk"
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

// Direct Anthropic defaults to Opus 5.5. Agent Router's Opus 5 id is claude-opus-5, with no /v1 on the base URL.
const ANTHROPIC_BASE = (Deno.env.get("ANTHROPIC_BASE_URL") || "").replace(/\/$/, "")
const ROUTER = /agentrouter\.org/i.test(ANTHROPIC_BASE)
const MODEL = Deno.env.get("CLAUDE_MODEL") || (ROUTER ? "claude-opus-5" : "claude-opus-5-5")
const PER_RUN = Math.max(1, Math.min(8, Number(Deno.env.get("NEWS_PER_RUN") ?? "3") || 3))
const MAX_AGE_HOURS = 36
const USER_AGENT = "Mozilla/5.0 (compatible; EZNewsAgent/1.0; +https://ediinzasag.mn)"
/** Stories rated below this are only used to fill the daily quota when nothing better exists. */
const MIN_PRIORITY = Math.max(1, Math.min(10, Number(Deno.env.get("NEWS_MIN_PRIORITY") ?? "5") || 5))

const googleNews = (query: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`

interface Feed {
  name: string
  url: string
  /** Mongolia-focused feeds are flagged to the ranker and may be a little older. */
  mongolia?: boolean
  maxAgeHours?: number
}

/** Feeds the agent reads. Add or remove freely; a feed that fails is skipped and reported for that run. */
const FEEDS: Feed[] = [
  // Mongolia first: the stories readers can't get elsewhere in Mongolian.
  { name: "Google News", url: googleNews("Mongolia economy when:3d"), mongolia: true, maxAgeHours: 72 },
  { name: "Google News", url: googleNews('Mongolia (mining OR copper OR coal OR "Oyu Tolgoi" OR tugrik) when:3d'), mongolia: true, maxAgeHours: 72 },
  { name: "The Guardian", url: "https://www.theguardian.com/world/mongolia/rss", mongolia: true, maxAgeHours: 96 },
  { name: "The Diplomat", url: "https://thediplomat.com/regions/central-asia/feed/", mongolia: true, maxAgeHours: 72 },
  { name: "iKon.mn", url: "https://ikon.mn/rss", mongolia: true },
  // World economy and markets.
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { name: "Bloomberg", url: "https://feeds.bloomberg.com/markets/news.rss" },
  { name: "Bloomberg", url: "https://feeds.bloomberg.com/economics/news.rss" },
  { name: "The Guardian", url: "https://www.theguardian.com/business/economics/rss" },
  { name: "The Economist", url: "https://www.economist.com/finance-and-economics/rss.xml" },
  { name: "CNBC", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" },
  { name: "CNBC", url: "https://www.cnbc.com/id/100727362/device/rss/rss.html" },
  { name: "CNBC", url: "https://www.cnbc.com/id/15839069/device/rss/rss.html" },
  { name: "Financial Times", url: "https://www.ft.com/global-economy?format=rss" },
  { name: "Financial Times", url: "https://www.ft.com/commodities?format=rss" },
  { name: "Financial Times", url: "https://www.ft.com/emerging-markets?format=rss" },
  { name: "Nikkei Asia", url: "https://asia.nikkei.com/rss/feed/nar" },
  { name: "South China Morning Post", url: "https://www.scmp.com/rss/92/feed" },
  { name: "DW", url: "https://rss.dw.com/rdf/rss-en-bus" },
  { name: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  { name: "Investing.com", url: "https://www.investing.com/rss/news_14.rss" },
  // Mining, energy and commodities, Mongolia's main exports and imports.
  { name: "MINING.COM", url: "https://www.mining.com/feed/" },
  { name: "Mining Technology", url: "https://www.mining-technology.com/feed/" },
  { name: "OilPrice.com", url: "https://oilprice.com/rss/main" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
]

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

interface FeedItem {
  source: string
  title: string
  link: string
  summary: string
  published: number | null
  image: string
  mongolia: boolean
}

/** What happened in one run, saved to news_runs.details and shown on the board. */
interface RunDetails {
  provider: string
  feeds_ok: number
  feeds_total: number
  feeds_failed: string[]
  fresh: number
  new: number
  picked: { title: string; source: string; priority: number }[]
  failures: string[]
}

/* ------------------------------------------------------------------ */
/* Feeds                                                               */
/* ------------------------------------------------------------------ */

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

function decode(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match)
}

const stripTags = (html: string) => decode(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))
    if (match) return decode(match[1]).trim()
  }
  return ""
}

function attr(block: string, element: string, attribute: string) {
  const match = block.match(new RegExp(`<${element}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "i"))
  return match ? decode(match[1]) : ""
}

function parseFeed(xml: string, feed: Feed): FeedItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? []
  return blocks.map((block) => {
    const link = tag(block, ["link"]) || attr(block, "link", "href")
    const date = tag(block, ["pubDate", "dc:date", "updated", "published"])
    const parsed = date ? Date.parse(date) : NaN
    const enclosureType = attr(block, "enclosure", "type")
    const publisher = feed.name === "Google News" ? stripTags(tag(block, ["source"])) : ""
    let title = stripTags(tag(block, ["title"]))
    if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -publisher.length - 3)
    return {
      source: publisher || feed.name,
      mongolia: Boolean(feed.mongolia),
      title,
      link: link.trim(),
      summary: stripTags(tag(block, ["description", "summary", "content:encoded", "content"])).slice(0, 500),
      published: Number.isFinite(parsed) ? parsed : null,
      image:
        attr(block, "media:content", "url") ||
        attr(block, "media:thumbnail", "url") ||
        (enclosureType.startsWith("image/") ? attr(block, "enclosure", "url") : ""),
    }
  })
}

async function fetchText(url: string, timeoutMs: number) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.text()
}

async function readFeeds() {
  const results = await Promise.allSettled(FEEDS.map(async (feed) => parseFeed(await fetchText(feed.url, 10_000), feed)))
  const seenLinks = new Set<string>()
  const seenTitles = new Set<string>()
  const items: FeedItem[] = []
  const failed: string[] = []
  results.forEach((result, index) => {
    const feed = FEEDS[index]
    if (result.status !== "fulfilled") {
      const reason = result.reason instanceof Error ? result.reason.message.split(" ")[0] : "error"
      failed.push(`${feed.name} (${reason})`)
      return
    }
    const cutoff = Date.now() - (feed.maxAgeHours ?? MAX_AGE_HOURS) * 3_600_000
    for (const item of result.value) {
      // Unicode-aware, so Cyrillic headlines are compared too.
      const titleKey = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
      if (!titleKey || !/^https?:\/\//.test(item.link)) continue
      if (item.published !== null && item.published < cutoff) continue
      if (seenLinks.has(item.link) || seenTitles.has(titleKey)) continue
      seenLinks.add(item.link)
      seenTitles.add(titleKey)
      items.push(item)
    }
  })
  items.sort((a, b) => (b.published ?? 0) - (a.published ?? 0))
  return { items, ok: FEEDS.length - failed.length, failed }
}

/** The article page's main image (og:image) and readable paragraphs. */
async function readArticle(url: string) {
  try {
    const html = await fetchText(url, 12_000)
    const meta = new Map<string, string>()
    for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
      const key = (match[0].match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1] ?? "").toLowerCase()
      const content = match[0].match(/\bcontent=["']([^"']*)["']/i)?.[1]
      if (key && content && !meta.has(key)) meta.set(key, decode(content))
    }
    const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => stripTags(match[1]))
      .filter((text) => text.length > 60)
    return {
      image: meta.get("og:image") || meta.get("twitter:image") || "",
      text: paragraphs.join("\n\n").slice(0, 14_000),
    }
  } catch (error) {
    console.warn("article page skipped:", error instanceof Error ? error.message : error)
    return { image: "", text: "" }
  }
}

/* ------------------------------------------------------------------ */
/* AI model (Claude or Gemini)                                         */
/* ------------------------------------------------------------------ */

// Created on first use, so a Gemini-only setup never needs an Anthropic key.
let anthropic: Anthropic | null = null

const RANK_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          priority: { type: "integer", description: "1-10, how much this matters to Mongolian readers today" },
          why: { type: "string" },
        },
        required: ["index", "priority", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["picks"],
  additionalProperties: false,
}

const BRIEFING_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Mongolian headline, 10-70 characters, calm and factual" },
    dek: { type: "string", description: "Mongolian one-sentence summary, 40-200 characters" },
    slug: { type: "string", description: "Short latin slug, lowercase words joined by hyphens" },
    body_html: { type: "string", description: "Mongolian article body as HTML using only <h2>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>" },
    desk: { type: "string", enum: ["world", "mongolia"] },
    tags: { type: "array", items: { type: "string" } },
    cover_alt: { type: "string", description: "Mongolian description of the cover photo's likely subject, under 120 characters" },
    verify_notes: { type: "array", items: { type: "string" }, description: "Mongolian checklist for the human reviewer" },
  },
  required: ["title", "dek", "slug", "body_html", "desk", "tags", "cover_alt", "verify_notes"],
  additionalProperties: false,
}

const NEWSROOM =
  "You work for EZ Эдийн засаг (ediinzasag.mn), a Mongolian newsroom covering the Mongolian economy and world markets for general readers. " +
  "Its tone is calm and explanatory: understanding, not fear. Mongolia's economy depends on mining exports (copper, coal, gold, iron ore) " +
  "mostly to China, imports nearly all its fuel (mostly from Russia), and is sensitive to commodity prices, Chinese demand, the US dollar, " +
  "interest rates and inflation."

/**
 * Which model writes the briefings. "gemini" uses Google's free tier (fine for
 * a demo: about 4 requests per run); "claude" is the paid, higher-quality
 * option. Without AI_PROVIDER, whichever key is set wins (Claude first).
 */
const PROVIDER: "claude" | "gemini" =
  Deno.env.get("AI_PROVIDER") === "gemini" || (Deno.env.get("AI_PROVIDER") !== "claude" && !Deno.env.get("ANTHROPIC_API_KEY"))
    ? "gemini"
    : "claude"
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash"

/** One structured JSON call; returns null when the model declines. Retries brief overloads (free tiers hit these often). */
async function ask<T>(system: string, prompt: string, schema: object, effort: "low" | "medium" | "high"): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return PROVIDER === "gemini" ? await askGemini<T>(system, prompt, schema) : await askClaude<T>(system, prompt, schema, effort)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryable = /429|503|overloaded|unavailable|хязгаар|RESOURCE_EXHAUSTED|JSON/i.test(message)
      if (!retryable || attempt >= 2) throw error
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 8_000))
    }
  }
}

/** Gemini's response schema is an OpenAPI subset: no additionalProperties. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema)
  if (!schema || typeof schema !== "object") return schema
  return Object.fromEntries(
    Object.entries(schema as Record<string, unknown>)
      .filter(([key]) => key !== "additionalProperties")
      .map(([key, value]) => [key, toGeminiSchema(value)]),
  )
}

async function askGemini<T>(system: string, prompt: string, schema: object): Promise<T | null> {
  const key = Deno.env.get("GEMINI_API_KEY")
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key ?? "" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema), temperature: 0.3 },
    }),
    signal: AbortSignal.timeout(110_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.error?.message ?? `HTTP ${response.status}`
    // 429 = the free tier's per-minute or per-day limit.
    throw new Error(response.status === 429 ? `Gemini үнэгүй хязгаарт хүрлээ: ${message}` : `Gemini: ${message}`)
  }
  const candidate = data?.candidates?.[0]
  if (!candidate || candidate.finishReason === "SAFETY" || candidate.finishReason === "PROHIBITED_CONTENT") {
    console.warn("declined:", candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? "no candidate")
    return null
  }
  if (candidate.finishReason === "MAX_TOKENS") throw new Error("Gemini хариу тасарсан (MAX_TOKENS)")
  const text = (candidate.content?.parts ?? []).map((part: { text?: string }) => part.text ?? "").join("")
  return JSON.parse(text) as T
}

function parseModelJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = (fenced?.[1] ?? text).trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  const snippet = raw.replace(/\s+/g, " ").slice(0, 220)
  if (start < 0 || end < start) throw new Error(`JSON биш хариу: ${snippet || "(хоосон)"}`)
  const parsed = JSON.parse(raw.slice(start, end + 1))
  // A relay can answer 200 with an upstream error object as the text.
  if (parsed?.type === "error" || parsed?.error) throw new Error(`Дээд үйлчилгээний алдаа: ${snippet}`)
  return parsed as T
}

/** Agent Router speaks plain /v1/messages. It rejects Anthropic's beta JSON-schema and fallback headers. */
async function askRouter<T>(system: string, prompt: string, schema: object): Promise<T | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? ""
  const response = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      Authorization: `Bearer ${key}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{
        role: "user",
        content: `${prompt}\n\nReply with one JSON object and nothing else. No markdown. Shape:\n${JSON.stringify(schema)}`,
      }],
    }),
    signal: AbortSignal.timeout(110_000),
  })
  // Read the body once as text: relays differ (JSON, server-sent events, or OpenAI-style).
  const raw = await response.text()
  const type = response.headers.get("content-type") ?? ""
  const where = `Agent Router (${ANTHROPIC_BASE}, ${MODEL})`
  let data: RouterReply | null = null
  try {
    data = JSON.parse(raw) as RouterReply
  } catch {
    data = null
  }
  if (!response.ok) {
    const message = data?.error?.message ?? data?.error ?? (raw.slice(0, 200) || `HTTP ${response.status}`)
    throw new Error(`${where} ${response.status}: ${typeof message === "string" ? message : JSON.stringify(message)}`)
  }
  if (data?.stop_reason === "refusal") return null
  if (data?.stop_reason === "max_tokens") throw new Error("Claude хариу тасарсан (max_tokens)")

  const text = routerText(data, raw)
  if (!text.trim()) {
    // Nothing usable: say exactly what came back so the cause is visible on the board.
    const blocks = (data?.content ?? []).map((block) => block.type ?? "?").join(",") || "none"
    throw new Error(
      `${where}: хоосон хариу (content-type: ${type || "?"}, stop: ${data?.stop_reason ?? "?"}, blocks: ${blocks}, body: ${raw.replace(/\s+/g, " ").slice(0, 160) || "(хоосон)"})`,
    )
  }
  return parseModelJson<T>(text)
}

interface RouterReply {
  content?: { type?: string; text?: string }[]
  stop_reason?: string
  error?: { message?: string } | string
  choices?: { message?: { content?: string } }[]
}

/** The answer text from an Anthropic reply, an event stream, or an OpenAI-style reply. */
function routerText(data: RouterReply | null, raw: string) {
  const anthropic = (data?.content ?? []).flatMap((block) => (block.type === "text" ? [block.text ?? ""] : [])).join("")
  if (anthropic) return anthropic
  const openai = data?.choices?.[0]?.message?.content
  if (openai) return openai
  if (raw.includes("data:")) {
    // Server-sent events: join the text deltas.
    let out = ""
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue
      try {
        const event = JSON.parse(line.slice(5).trim())
        out += event?.delta?.text ?? event?.choices?.[0]?.delta?.content ?? ""
      } catch {
        // Not JSON ("[DONE]" and the like).
      }
    }
    return out
  }
  return ""
}

async function askClaude<T>(system: string, prompt: string, schema: object, effort: "low" | "medium" | "high"): Promise<T | null> {
  if (ROUTER) return askRouter<T>(system, prompt, schema)
  // Direct to Anthropic (baseURL pinned, so a stray ANTHROPIC_BASE_URL can't half-apply).
  anthropic ??= new Anthropic({ baseURL: "https://api.anthropic.com", timeout: 110_000, maxRetries: 1 })
  const response = await anthropic.beta.messages
    .create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // On a policy decline, Anthropic retries on a suitable fallback model inside the same call.
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort, format: { type: "json_schema", schema } },
  } as Parameters<Anthropic["beta"]["messages"]["create"]>[0])
    .catch((error: unknown) => {
      throw new Error(`Anthropic шууд (${MODEL}): ${error instanceof Error ? error.message : String(error)}`)
    })
  if (response.stop_reason === "refusal") {
    console.warn("declined:", response.stop_details?.category ?? "unknown")
    return null
  }
  if (response.stop_reason === "max_tokens") throw new Error("Claude хариу тасарсан (max_tokens)")
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("")
  return JSON.parse(text) as T
}

interface Pick {
  item: FeedItem
  why: string
  priority: number
}

/**
 * Picks the day's stories. Mongolia-focused items are always in the list the
 * model sees; the rest are the newest world items. It always returns `count`
 * stories when there are enough: strong ones (priority ≥ MIN_PRIORITY) first,
 * then the best of the rest, so the desk gets its daily briefings.
 */
async function rank(items: FeedItem[], count: number): Promise<Pick[]> {
  // Cap each source so busy feeds (iKon.mn, Nikkei) don't crowd out the rest.
  const capped = (list: FeedItem[], perSource: number) => {
    const counts = new Map<string, number>()
    return list.filter((item) => {
      const n = (counts.get(item.source) ?? 0) + 1
      counts.set(item.source, n)
      return n <= perSource
    })
  }
  const mongolia = capped(items.filter((item) => item.mongolia), 10).slice(0, 40)
  const world = capped(items.filter((item) => !item.mongolia), 10).slice(0, 110 - mongolia.length)
  const pool = [...mongolia, ...world]
  const list = pool
    .map((item, index) => `[${index}]${item.mongolia ? " [MN]" : ""} (${item.source}) ${item.title}${item.summary ? ` — ${item.summary.slice(0, 200)}` : ""}`)
    .join("\n")
  const result = await ask<{ picks: { index: number; priority: number; why: string }[] }>(
    NEWSROOM,
    `Here are today's headlines (economy, markets, commodities, Asia, and items marked [MN] that are about Mongolia; some [MN] items are in Mongolian). ` +
      `Rank the ${count * 2} stories that matter most to Mongolian readers, best first: direct Mongolia news, ` +
      `effects on Mongolia's exports (copper, coal, gold), fuel, prices, the tögrög, China's demand, investment, or major global economic turning points. ` +
      `Prefer hard news with clear facts over opinion, live blogs, videos, podcasts or listicles. Never pick two stories about the same event. ` +
      `priority: 10 = must cover today, 5 = useful context, 1 = barely relevant.\n\n${list}`,
    RANK_SCHEMA,
    "medium",
  )
  const seen = new Set<number>()
  const ranked = (result?.picks ?? [])
    .filter((pick) => pool[pick.index] && !seen.has(pick.index) && seen.add(pick.index))
    .sort((a, b) => b.priority - a.priority)
  const strong = ranked.filter((pick) => pick.priority >= MIN_PRIORITY)
  const chosen = (strong.length >= count ? strong : [...strong, ...ranked.filter((pick) => pick.priority < MIN_PRIORITY)]).slice(0, count)
  if (chosen.length > 0) return chosen.map((pick) => ({ item: pool[pick.index], why: pick.why, priority: pick.priority }))
  // The model returned nothing usable: fall back to the newest Mongolia items, then world ones.
  return pool.slice(0, count).map((item) => ({ item, why: "Хамгийн сүүлийн мэдээ (агент эрэмбэлж чадсангүй)", priority: 0 }))
}

interface Briefing {
  title: string
  dek: string
  slug: string
  body_html: string
  desk: "world" | "mongolia"
  tags: string[]
  cover_alt: string
  verify_notes: string[]
}

function write(item: FeedItem, text: string, why: string, tags: { slug: string; label: string }[]) {
  return ask<Briefing>(
    `${NEWSROOM}\n\nYou draft briefings in Mongolian (Cyrillic) from foreign reporting. A human editor will check every fact, ` +
      `add the newsroom's own analysis and decide whether to publish; your draft must make that easy and must never overstate.`,
    `Write a Mongolian briefing from this ${item.source} story.\n\n` +
      `Rules:\n` +
      `- If the source is already in Mongolian, rewrite it in your own words (never copy sentences); otherwise translate.\n` +
      `- Condense faithfully. Use only facts present in the source text below; never invent numbers, quotes or dates.\n` +
      `- Attribute: say what ${item.source} reported and who said what ("${item.source} мэдээлснээр…").\n` +
      `- 250-450 words. Sections with <h2>: "Юу болов", "Яагаад чухал вэ", and "Монголд ямар хамаатай вэ" (careful, clearly hedged reasoning about possible effects on Mongolia; no new facts).\n` +
      `- Calm headline: no "ШОК", "ЯАРАЛТАЙ", "ОДОО Л", no exclamation marks.\n` +
      `- Do not write an opinion or conclusion section; the editor adds "EZ-ийн дүгнэлт" themselves.\n` +
      `- tags: 1-4 slugs chosen only from this list: ${tags.map((tag) => `${tag.slug} (${tag.label})`).join(", ")}.\n` +
      `- desk: "mongolia" only if the story is mainly about Mongolia, otherwise "world".\n` +
      `- verify_notes: 2-5 concrete things the editor should check against the original or Mongolian sources (figures, names, dates, local data to add).\n\n` +
      `Why it was picked: ${why}\n` +
      `Headline: ${item.title}\nPublished: ${item.published ? new Date(item.published).toISOString() : "unknown"}\nURL: ${item.link}\n` +
      `Feed summary: ${item.summary}\n\nSource text:\n${text || "(Only the feed summary is available. Keep the briefing short and say in verify_notes that the full text must be read.)"}`,
    BRIEFING_SCHEMA,
    "high",
  )
}

/* ------------------------------------------------------------------ */
/* Storage and database                                                */
/* ------------------------------------------------------------------ */

const ALLOWED_HTML = /<(?!\/?(?:h2|h3|p|ul|ol|li|strong|em|b|i|blockquote|br)\b)[^>]*>/gi

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

async function copyImage(db: SupabaseClient, url: string, slug: string) {
  if (!/^https?:\/\//.test(url)) return ""
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(12_000) })
    const type = response.headers.get("content-type")?.split(";")[0] ?? ""
    if (!response.ok || !type.startsWith("image/")) return ""
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > 6_000_000 || bytes.byteLength < 2_000) return ""
    const extension = type.split("/")[1].replace("jpeg", "jpg").replace(/[^a-z]/g, "") || "jpg"
    const path = `agent/${new Date().toISOString().slice(0, 10)}/${slug}.${extension}`
    const { error } = await db.storage.from("covers").upload(path, bytes, { contentType: type, upsert: true })
    if (error) throw error
    return db.storage.from("covers").getPublicUrl(path).data.publicUrl
  } catch (error) {
    console.warn("image skipped:", error instanceof Error ? error.message : error)
    return ""
  }
}

async function run(db: SupabaseClient, trigger: "cron" | "manual") {
  const { data: runRow } = await db.from("news_runs").insert({ trigger }).select("id").single()
  const finish = async (patch: Record<string, unknown>) => {
    if (!runRow) return
    const row = { finished_at: new Date().toISOString(), ...patch }
    const { error } = await db.from("news_runs").update(row).eq("id", runRow.id)
    // Databases set up before news_runs.details existed: save the rest.
    if (error && "details" in row) {
      const { details: _details, ...rest } = row
      await db.from("news_runs").update(rest).eq("id", runRow.id)
    }
  }

  const details: RunDetails = {
    provider: PROVIDER === "gemini" ? `gemini · ${GEMINI_MODEL}` : `claude · ${MODEL}`,
    feeds_ok: 0,
    feeds_total: FEEDS.length,
    feeds_failed: [],
    fresh: 0,
    new: 0,
    picked: [],
    failures: [],
  }

  try {
    const feeds = await readFeeds()
    const fresh = feeds.items
    details.feeds_ok = feeds.ok
    details.feeds_failed = feeds.failed
    details.fresh = fresh.length
    // Skip stories already on the board (feeds only carry the last day or two, so a week back is enough).
    const { data: known } = await db
      .from("articles")
      .select("source_url")
      .not("source_url", "is", null)
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    const knownUrls = new Set((known ?? []).map((row: { source_url: string }) => row.source_url))
    const items = fresh.filter((item) => !knownUrls.has(item.link))
    details.new = items.length
    if (items.length === 0) {
      const error = feeds.ok === 0 ? "Нэг ч эх сурвалж уншигдсангүй" : ""
      await finish({ scanned: fresh.length, created: 0, error, details })
      return { scanned: fresh.length, created: 0, details }
    }

    const { data: tagRows } = await db.from("tags").select("slug, label")
    const tags = (tagRows ?? []) as { slug: string; label: string }[]
    const tagSlugs = new Set(tags.map((tag) => tag.slug))
    const picks = await rank(items, PER_RUN)
    details.picked = picks.map(({ item, priority }) => ({ title: item.title.slice(0, 140), source: item.source, priority }))

    // Claude: all at once. Gemini's free tier: two at a time, to stay under its per-minute limit.
    const written = await settleInBatches(
      picks,
      PROVIDER === "gemini" ? 2 : picks.length,
      async ({ item, why, priority }) => {
        const page = await readArticle(item.link)
        const briefing = await write(item, page.text, why, tags)
        if (!briefing) return false
        const slug = `${slugify(briefing.slug || item.title) || "medee"}-${Date.now().toString(36).slice(-4)}`
        const coverUrl = await copyImage(db, page.image || item.image, slug)
        const { error } = await db.from("articles").insert({
          slug,
          title: briefing.title.slice(0, 120),
          dek: briefing.dek,
          body: briefing.body_html.replace(ALLOWED_HTML, ""),
          desk: briefing.desk === "mongolia" ? "mongolia" : "world",
          tags: briefing.tags.filter((tag) => tagSlugs.has(tag)).slice(0, 5),
          cover_url: coverUrl,
          cover_alt: coverUrl ? briefing.cover_alt : "",
          cover_credit: coverUrl ? `Зураг: ${item.source}` : "",
          sources: [{ label: `${item.source}: ${item.title}`, href: item.link }],
          source_url: item.link,
          bot_notes: [
            `Агентын үнэлгээ: ${priority}/10 — ${why}`,
            ...briefing.verify_notes.map((note) => note.trim()).filter(Boolean),
          ].join("\n"),
        })
        // 23505: the same story was added by a parallel run.
        if (error && error.code !== "23505") throw error
        return !error
      },
    )
    const created = written.filter((result) => result.status === "fulfilled" && result.value).length
    details.failures = written.flatMap((result, index) =>
      result.status === "rejected"
        ? [`${picks[index].item.title.slice(0, 60)}: ${String(result.reason?.message ?? result.reason).slice(0, 160)}`]
        : result.value
          ? []
          : [`${picks[index].item.title.slice(0, 60)}: загвар бичихээс татгалзсан`],
    )
    const error = details.failures.length ? `${details.failures.length}/${picks.length} бичиж чадсангүй: ${details.failures[0]}` : ""
    await finish({ scanned: fresh.length, created, error: error.slice(0, 300), details })
    return { scanned: fresh.length, created, details }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finish({ error: message.slice(0, 300), details })
    throw error
  }
}

/** Runs `task` over `list`, `size` at a time, keeping every result like Promise.allSettled. */
async function settleInBatches<T, R>(list: T[], size: number, task: (value: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = []
  for (let start = 0; start < list.length; start += Math.max(1, size)) {
    results.push(...(await Promise.allSettled(list.slice(start, start + Math.max(1, size)).map(task))))
  }
  return results
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (request.method !== "POST") return json({ error: "POST only" }, 405)

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  })

  // The daily cron sends the shared secret; people must be signed-in editors or admins.
  const cronSecret = Deno.env.get("NEWS_CRON_SECRET")
  let trigger: "cron" | "manual" = "manual"
  if (cronSecret && request.headers.get("x-cron-secret") === cronSecret) {
    trigger = "cron"
  } else {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
    const { data } = await db.auth.getUser(token)
    if (!data.user) return json({ error: "Нэвтэрнэ үү" }, 401)
    const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
    if (profile?.role !== "editor" && profile?.role !== "admin") return json({ error: "Редактор, админ л ажиллуулна" }, 403)
  }

  if (PROVIDER === "claude" && !Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "ANTHROPIC_API_KEY тохируулаагүй байна (ADMIN.md)" }, 500)
  if (PROVIDER === "gemini" && !Deno.env.get("GEMINI_API_KEY")) {
    return json({ error: "AI түлхүүр алга: GEMINI_API_KEY (үнэгүй) эсвэл ANTHROPIC_API_KEY тохируулна уу (ADMIN.md)" }, 500)
  }

  try {
    return json(await run(db, trigger))
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : "Агент ажиллаж чадсангүй" }, 500)
  }
})
