// EZ news agent: a Supabase Edge Function (Deno).
//
// Once a day (pg_cron, see the end of schema.sql) or when an editor presses
// "Одоо татах" on /admin, it:
//   1. reads world economy, markets, tech and Mongolian RSS feeds (and the
//      section pages of Mongolian sites that have no RSS),
//   2. picks a few stories that matter to Mongolian readers,
//   3. files each one for a person to check,
//   4. copies the story's main image into the covers bucket with a credit,
//   5. inserts it as an unclaimed 'bot' article in review.
// Nothing is published here: a person claims the card, writes the piece, adds
// the EZ take and clears the photo before guard_article() lets it go live.
//
// With no AI key, step 2 is a keyword ranking (rules.ts) and step 3 is a source
// card: the outlet's own excerpt, not a generated article. Set AI_PROVIDER=rules
// to force that. A key switches the same run to a model draft:
//   GEMINI_API_KEY (free tier) or ANTHROPIC_API_KEY.
// Agent Router (the $ credit balance, Opus 5): set ANTHROPIC_API_KEY to the sk- token,
//   ANTHROPIC_BASE_URL=https://agentrouter.org (no /v1), AI_PROVIDER=claude, CLAUDE_MODEL=claude-opus-5.
// Optional: AI_PROVIDER ("rules" | "gemini" | "claude"), CLAUDE_MODEL, GEMINI_MODEL, GEMINI_FALLBACK_MODEL
// (used when GEMINI_MODEL is overloaded or out of quota: a model name, "auto" (default: other Flash models
// the key can use, asked from Google) or "none"), NEWS_PER_RUN (default 3),
// NEWS_TIME_BUDGET_S (default 110: no new draft starts after this many seconds).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. NEWS_CRON_SECRET
// is a password for the morning call, not an AI key. Deploy with --no-verify-jwt:
// the cron call has no user token, so this function checks the cron secret or the editor's token itself.

import { rankByRules, score, sourceCard } from "./rules.ts"
import { EXEMPLARS, STYLE_CARD, STYLE_PAIRS } from "../_shared/style-card.ts"
import { lintStyle } from "../_shared/style-lint.ts"
import { termsFor } from "../_shared/termbase.ts"
import { flashBackups, geminiAsk } from "../_shared/gemini.ts"

import Anthropic from "npm:@anthropic-ai/sdk"
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

// Direct Anthropic defaults to Opus 5.5. Agent Router's Opus 5 id is claude-opus-5, with no /v1 on the base URL.
const ANTHROPIC_BASE = (Deno.env.get("ANTHROPIC_BASE_URL") || "").replace(/\/$/, "")
const ROUTER = /agentrouter\.org/i.test(ANTHROPIC_BASE)
const MODEL = Deno.env.get("CLAUDE_MODEL") || (ROUTER ? "claude-opus-5" : "claude-opus-5-5")
export const PER_RUN = Math.max(1, Math.min(8, Number(Deno.env.get("NEWS_PER_RUN") ?? "3") || 3))
const MAX_AGE_HOURS = 36
const USER_AGENT = "Mozilla/5.0 (compatible; EZNewsAgent/1.0; +https://ediinzasag.mn)"
/** Stories rated below this are only used to fill the daily quota when nothing better exists. */
export const MIN_PRIORITY = Math.max(1, Math.min(10, Number(Deno.env.get("NEWS_MIN_PRIORITY") ?? "5") || 5))

const googleNews = (query: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`

/** Broad Google News searches stay on wire services and major business papers, not content farms. */
const TRUSTED =
  "(site:reuters.com OR site:apnews.com OR site:bloomberg.com OR site:ft.com OR site:cnbc.com OR site:wsj.com OR site:nikkei.com OR site:scmp.com OR site:bbc.com OR site:economist.com)"

interface Feed {
  name: string
  url: string
  /** Mongolia-focused feeds are flagged to the ranker and may be a little older. */
  mongolia?: boolean
  maxAgeHours?: number
  /**
   * For sites with no RSS: `url` is a section page and this matches its article
   * links. The newest few (highest id) are opened for title, excerpt and image.
   */
  articleLinks?: RegExp
}

/** Feeds the agent reads. Add or remove freely; a feed that fails is skipped and reported for that run. */
export const FEEDS: Feed[] = [
  // Mongolia first: the stories readers can't get elsewhere in Mongolian.
  { name: "Google News", url: googleNews("Mongolia economy when:3d"), mongolia: true, maxAgeHours: 72 },
  { name: "Google News", url: googleNews('Mongolia (mining OR copper OR coal OR "Oyu Tolgoi" OR tugrik) when:3d'), mongolia: true, maxAgeHours: 72 },
  { name: "The Guardian", url: "https://www.theguardian.com/world/mongolia/rss", mongolia: true, maxAgeHours: 96 },
  { name: "The Diplomat", url: "https://thediplomat.com/regions/central-asia/feed/", mongolia: true, maxAgeHours: 72 },
  { name: "iKon.mn", url: "https://ikon.mn/rss", mongolia: true },
  { name: "Сонин.мн", url: "https://sonin.mn/rss", mongolia: true },
  { name: "Itoim.mn", url: "https://itoim.mn/rss.xml", mongolia: true, maxAgeHours: 72 },
  // Montsame's Mongolian site turns away server requests; its English edition comes through Google News.
  { name: "Google News", url: googleNews("site:montsame.mn when:2d"), mongolia: true, maxAgeHours: 72 },
  { name: "Google News", url: googleNews(`(China OR Russia) Mongolia ${TRUSTED} when:3d`), mongolia: true, maxAgeHours: 72 },
  // Mongolian sites with no RSS: read the section page instead.
  { name: "Өнөөдөр", url: "https://unuudur.mn/as/economy", mongolia: true, articleLinks: /\/a\/\d+$/ },
  { name: "Medee.mn", url: "https://medee.mn/category/economy", mongolia: true, articleLinks: /\/p\/\d+$/ },
  { name: "Mongolian Mining Journal", url: "https://mongolianminingjournal.com", mongolia: true, articleLinks: /\/a\/\d+$/ },
  { name: "Polit.mn", url: "https://polit.mn", mongolia: true, articleLinks: /\/a\/\d+$/ },
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
  // Tech and trade/sanctions conflicts: they move the markets Mongolia trades with.
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "The Guardian", url: "https://www.theguardian.com/technology/rss" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "Google News", url: googleNews(`(tariff OR "trade war" OR sanctions OR "export controls") ${TRUSTED} when:1d`) },
  { name: "Google News", url: googleNews(`(semiconductor OR "AI chips" OR Nvidia OR TSMC) ${TRUSTED} when:1d`) },
]

/** How many of a section page's newest articles to open per run. */
const SECTION_LIMIT = 6

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

/** A page's <meta> tags (og:title, og:image…), first value wins. */
function metaTags(html: string) {
  const meta = new Map<string, string>()
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (match[0].match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1] ?? "").toLowerCase()
    const content = match[0].match(/\bcontent=["']([^"']*)["']/i)?.[1]
    if (key && content && !meta.has(key)) meta.set(key, decode(content))
  }
  return meta
}

/**
 * A site with no RSS: the newest article links on its section page, each opened
 * for its og: tags. These pages carry no reliable date, so newest = highest id,
 * and the board's source_url check drops what an earlier run already filed.
 */
async function readSection(feed: Feed): Promise<FeedItem[]> {
  const html = await fetchText(feed.url, 10_000)
  const links = new Map<number, string>()
  for (const match of html.matchAll(/href=["']([^"'#?]+)["']/gi)) {
    const link = new URL(decode(match[1]), feed.url).href
    const id = Number(link.match(/(\d+)$/)?.[1])
    if (feed.articleLinks!.test(link) && id) links.set(id, link)
  }
  const newest = [...links].sort((a, b) => b[0] - a[0]).slice(0, SECTION_LIMIT)
  const pages = await Promise.allSettled(
    newest.map(async ([, link]) => {
      const meta = metaTags(await fetchText(link, 10_000))
      return {
        source: feed.name,
        mongolia: Boolean(feed.mongolia),
        title: stripTags(meta.get("og:title") ?? ""),
        link,
        summary: stripTags(meta.get("og:description") ?? meta.get("description") ?? "").slice(0, 500),
        published: Date.parse(meta.get("article:published_time") ?? "") || null,
        image: meta.get("og:image") ?? "",
      }
    }),
  )
  return pages.flatMap((page) => (page.status === "fulfilled" && page.value.title ? [page.value] : []))
}

export async function readFeeds() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => (feed.articleLinks ? readSection(feed) : parseFeed(await fetchText(feed.url, 10_000), feed))),
  )
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
export async function readArticle(url: string) {
  try {
    const html = await fetchText(url, 12_000)
    const meta = metaTags(html)
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
          why: { type: "string", description: "In Mongolian (Cyrillic), one short sentence: why it matters to Mongolian readers" },
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
    title: { type: "string", description: "Mongolian headline, calm and factual, one object and one number when the story has one; no exclamation marks" },
    dek: { type: "string", description: "Mongolian one-sentence summary, 40-200 characters" },
    slug: { type: "string", description: "Short latin slug, lowercase words joined by hyphens" },
    body_html: { type: "string", description: "Mongolian article body as HTML using only <h2>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>" },
    desk: { type: "string", enum: ["world", "mongolia"] },
    tags: { type: "array", items: { type: "string" } },
    cover_alt: { type: "string", description: "Mongolian description of the cover photo's likely subject, under 120 characters" },
    verify_notes: { type: "array", items: { type: "string" }, description: "Mongolian checklist for the human reviewer" },
    claims: {
      type: "array",
      description: "Fact sheet: every figure, date and quote used in body_html, each traced to the source text",
      items: {
        type: "object",
        properties: {
          claim: { type: "string", description: "The claim in Mongolian, as written in the article" },
          figure: { type: "string", description: "The exact figure with unit as the source gives it, or empty for a quote" },
          source: { type: "string", description: "Who said or published it (institution, outlet, person)" },
        },
        required: ["claim", "figure", "source"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "dek", "slug", "body_html", "desk", "tags", "cover_alt", "verify_notes", "claims"],
  additionalProperties: false,
}

const NEWSROOM =
  "You work for EZ Эдийн засаг (ediinzasag.mn), a Mongolian newsroom covering the Mongolian economy and world markets for general readers. " +
  "Its tone is calm and explanatory: understanding, not fear. Mongolia's economy depends on mining exports (copper, coal, gold, iron ore) " +
  "mostly to China, imports nearly all its fuel (mostly from Russia), and is sensitive to commodity prices, Chinese demand, the US dollar, " +
  "interest rates and inflation."

/**
 * "rules" ranks feeds by keyword and files a source card. No model, no key.
 * "gemini" and "claude" write a Mongolian draft. With no AI_PROVIDER, a key
 * selects its model; with neither key, the run uses rules.
 */
export const PROVIDER: "claude" | "gemini" | "rules" = (() => {
  const choice = Deno.env.get("AI_PROVIDER")
  if (choice === "rules") return "rules"
  if (choice === "claude") return "claude"
  if (choice === "gemini") return "gemini"
  if (Deno.env.get("ANTHROPIC_API_KEY")) return "claude"
  if (Deno.env.get("GEMINI_API_KEY")) return "gemini"
  return "rules"
})()
export const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash"
/** An older Flash with a bigger free quota, for when the newest one is overloaded or used up. */
const GEMINI_FALLBACK = (Deno.env.get("GEMINI_FALLBACK_MODEL") || "auto").trim()
/** Which Gemini models actually answered during this run, for the run log. */
const geminiServed = new Set<string>()

/** Supabase stops an edge function at ~150 s; after this budget no new draft is started. */
const TIME_BUDGET_MS = Math.max(30, Number(Deno.env.get("NEWS_TIME_BUDGET_S") ?? "110") || 110) * 1000


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

/** Gemini with patience (see _shared/gemini.ts): GEMINI_MODEL first, then backups when it's busy. */
function askGemini<T>(system: string, prompt: string, schema: object): Promise<T | null> {
  const backups = () => (GEMINI_FALLBACK === "none" ? Promise.resolve([]) : GEMINI_FALLBACK === "auto" ? flashBackups(GEMINI_MODEL) : Promise.resolve([GEMINI_FALLBACK]))
  return geminiAsk<T>({ system, prompt, schema, models: [GEMINI_MODEL], backups, served: geminiServed })
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
  tags?: string[]
  desk?: "mongolia" | "world"
}

/**
 * Picks the day's stories. Mongolia-focused items are always in the list the
 * model sees; the rest are the newest world items. It always returns `count`
 * stories when there are enough: strong ones (priority ≥ MIN_PRIORITY) first,
 * then the best of the rest, so the desk gets its daily briefings.
 */
export async function rank(items: FeedItem[], count: number): Promise<Pick[]> {
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
  claims?: { claim: string; figure: string; source: string }[]
}

export function write(item: FeedItem, text: string, why: string, tags: { slug: string; label: string }[]) {
  const terms = termsFor(`${item.title} ${item.summary} ${text}`)
  const termbase = terms.length
    ? `Termbase (use these Mongolian forms):\n${terms.map((term) => `- ${term.en} → ${term.mn}${term.note ? ` (${term.note})` : ""}`).join("\n")}`
    : ""
  return ask<Briefing>(
    `${NEWSROOM}\n\nYou write briefings in Mongolian (Cyrillic) for ediinzasag.mn from foreign and Mongolian reporting. ` +
      `A human editor checks every fact, adds the newsroom's own analysis and decides whether to publish; your draft must make that easy and must never overstate. ` +
      `It must read as written by a Mongolian journalist, never as a translation or as generic AI prose.\n\n${STYLE_CARD}\n\n${STYLE_PAIRS}\n\n${EXEMPLARS}`,
    `Write a Mongolian briefing from this ${item.source} story.\n\n` +
      `Structure (body_html, 250-450 words, <h2> headings in this order):\n` +
      `- <h2>Юу болов</h2>: lead with the key figure, its unit and who reported it, wire style («${item.source}-ийн мэдээлснээр…» or the institution first). Then the context in one or two paragraphs.\n` +
      `- <h2>Яагаад чухал вэ</h2>: open with the question a Mongolian reader would ask, answer it in one sentence, then walk the mechanism in plain steps («…вэ гэвэл энгийнээр ингэж ойлгоно»). Each number gets a yardstick. Say plainly where the evidence is one-sided.\n` +
      `- <h2>Монголд ямар хамаатай вэ</h2>: a bridge sentence («Нэгэнт … ярьсных энийг Монголтой холбож харах хэрэгтэй.»), then careful, hedged reasoning about the tögrög, prices, exports or household costs. No new facts. End on one calm, complete sentence.\n` +
      `Do not write an opinion or conclusion section; the editor adds "EZ-ийн дүгнэлт" themselves.\n\n` +
      `Fields:\n` +
      `- tags: 1-4 slugs chosen only from this list: ${tags.map((tag) => `${tag.slug} (${tag.label})`).join(", ")}.\n` +
      `- desk: "mongolia" only if the story is mainly about Mongolia, otherwise "world".\n` +
      `- claims: every figure, date and quote you used, traced to the source text. If a figure is not in the source text, do not use it.\n` +
      `- verify_notes: 2-5 concrete things the editor should check (figures against the original, names and titles, a Mongolian primary source to add: Монголбанк, ҮСХ 1212.mn, Гаалийн Ерөнхий Газар, АМГТГ).\n\n` +
      (termbase ? `${termbase}\n\n` : "") +
      `Why it was picked: ${why}\n` +
      `Headline: ${item.title}\nPublished: ${item.published ? new Date(item.published).toISOString() : "unknown"}\nURL: ${item.link}\n` +
      `Feed summary: ${item.summary}\n\nSource text:\n${text || "(Only the feed summary is available. Keep the briefing short and say in verify_notes that the full text must be read.)"}`,
    BRIEFING_SCHEMA,
    "high",
  )
}

/**
 * After the model: apply the style book's mechanical fixes (dashes, иен, ОПЕК,
 * month digits, «quotes»…), then list what is left for the editor, plus any
 * number in the draft that the source text does not contain (style book L08).
 */
export function polish(briefing: Briefing, sourceText: string) {
  let draft = { title: briefing.title, dek: briefing.dek, body: briefing.body_html, take: "" }
  for (const hit of lintStyle(draft)) if (hit.fix) draft = hit.fix(draft)
  const noDash = (value: string) => value.replace(/\s*[—–]\s*/g, ", ")
  const notes = lintStyle(draft).map((hit) => `Хэв маяг (${hit.rule}): ${hit.message}`)
  // Compare numbers without thousands separators: "35,000" and "35 000" both become "35000".
  const flat = (text: string) => text.replace(/(\d)[,\s](?=\d{3}(?!\d))/g, "$1")
  const source = flat(sourceText)
  const numbers = flat(draft.body.replace(/<[^>]+>/g, " ")).match(/\d+(?:[.,]\d+)?/g) ?? []
  // Small numbers (days, ordinals, "2 дахин") are too common to check usefully.
  // Years (1900–2099) are dates, not figures to trace.
  const isYear = (n: string) => /^(19|20)\d\d$/.test(n)
  const unsourced = [...new Set(numbers)].filter((n) => Number(n.replace(",", ".")) > 31 && !isYear(n) && !source.includes(n) && !source.includes(n.replace(".", ",")))
  if (unsourced.length) notes.push(`Эх сурвалжид олдоогүй тоо: ${unsourced.slice(0, 8).join(", ")}. Тооцоолсон бол «ойролцоогоор» гэж тэмдэглэнэ, эс бөгөөс хасна.`)
  return {
    ...briefing,
    title: draft.title,
    dek: draft.dek,
    body_html: draft.body,
    cover_alt: noDash(briefing.cover_alt),
    verify_notes: briefing.verify_notes.map(noDash),
    styleNotes: notes,
  }
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

type Tags = { slug: string; label: string }[]

/**
 * Files one story as an unclaimed bot article in review: a model draft, or the
 * source card in rules mode. `cardIfNoDraft` (a person asked for this story)
 * falls back to the card when the model declines, instead of filing nothing.
 * Resolves with the new article's id, or null when nothing was filed.
 */
async function fileStory(
  db: SupabaseClient,
  pick: { item: FeedItem; why: string; priority: number; tags?: string[]; desk?: "mongolia" | "world" },
  tags: Tags,
  cardIfNoDraft = false,
): Promise<string | null> {
  const { item, why, priority } = pick
  const page = await readArticle(item.link)
  const drafted = PROVIDER === "rules" ? null : await write(item, page.text, why, tags)
  const briefing = drafted ? polish(drafted, `${item.title} ${item.summary} ${page.text}`) : null
  if (!briefing && PROVIDER !== "rules" && !cardIfNoDraft) return null
  const card = briefing ? null : sourceCard({ title: item.title, source: item.source, summary: item.summary, excerpt: page.text, published: item.published })
  const tagSlugs = new Set(tags.map((tag) => tag.slug))
  const slug = `${slugify(briefing?.slug || item.title) || "medee"}-${Date.now().toString(36).slice(-4)}`
  const coverUrl = await copyImage(db, page.image || item.image, slug)
  const { data, error } = await db
    .from("articles")
    .insert({
      slug,
      title: (card?.title || briefing!.title).slice(0, 120),
      dek: card?.dek || briefing!.dek,
      body: (card?.body || briefing!.body_html).replace(ALLOWED_HTML, ""),
      desk: card ? pick.desk || "world" : briefing!.desk === "mongolia" ? "mongolia" : "world",
      tags: (card ? pick.tags ?? [] : briefing!.tags).filter((tag) => tagSlugs.has(tag)).slice(0, 5),
      cover_url: coverUrl,
      cover_alt: coverUrl ? (card ? "Эх сурвалжийн зураг" : briefing!.cover_alt) : "",
      cover_credit: coverUrl ? `Зураг: ${item.source}` : "",
      sources: [{ label: `${item.source}: ${item.title}`, href: item.link }],
      source_url: item.link,
      bot_notes: [
        `${card ? "Дүрмээр сонгосон" : "Агентын үнэлгээ"}: ${priority}/10 · ${why}`,
        ...(card
          ? ["Тоо, нэр, огноог эхтэй тулгана.", "Монголоор дахин бичнэ. EZ-ийн дүгнэлтийг редактор нэмнэ.", "Нүүр зургийн эрхийг шалгана."]
          : [
              ...briefing!.verify_notes.map((note) => note.trim()).filter(Boolean),
              ...briefing!.styleNotes,
              ...(briefing!.claims ?? []).map((claim) => `Баримт: ${claim.claim}${claim.figure ? ` (${claim.figure})` : ""} · ${claim.source}`),
            ]),
      ].join("\n"),
    })
    .select("id")
    .single()
  // 23505: the same story was added by a parallel run.
  if (error && error.code !== "23505") throw error
  if (!data) return null
  await db.from("news_items").update({ status: "filed", article_id: data.id }).eq("link", item.link)
  return data.id as string
}

/** Every fresh story goes to the inbox with its rules score; the inbox keeps two weeks. */
async function saveInbox(db: SupabaseClient, items: FeedItem[], filed: Set<string>) {
  const rows = items.map((item) => ({
    link: item.link,
    source: item.source.slice(0, 120),
    title: item.title.slice(0, 300),
    summary: item.summary,
    image: item.image,
    published_at: item.published ? new Date(item.published).toISOString() : null,
    mongolia: item.mongolia,
    status: filed.has(item.link) ? "filed" : "new",
    ...score(item),
  }))
  for (let start = 0; start < rows.length; start += 500) {
    const { error } = await db.from("news_items").upsert(rows.slice(start, start + 500), { onConflict: "link", ignoreDuplicates: true })
    // An older database without news_items still runs; the inbox just stays empty.
    if (error) return console.warn("inbox skipped:", error.message)
  }
  await db.from("news_items").delete().lt("seen_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
}

/** "Карт болгох" in the inbox: one stored story becomes an article card. */
async function fileFromInbox(db: SupabaseClient, id: number) {
  const { data: row, error } = await db.from("news_items").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  if (!row) throw new Error("Мэдээ олдсонгүй")
  if (row.status === "filed" && row.article_id) return { article_id: row.article_id as string }
  const { data: tagRows } = await db.from("tags").select("slug, label")
  const item: FeedItem = {
    source: row.source,
    title: row.title,
    link: row.link,
    summary: row.summary,
    published: row.published_at ? Date.parse(row.published_at) : null,
    image: row.image,
    mongolia: row.mongolia,
  }
  const articleId = await fileStory(db, { item, why: row.why, priority: row.priority, tags: row.tags, desk: row.desk }, (tagRows ?? []) as Tags, true)
  if (!articleId) {
    // Filed before under the same link (e.g. by the morning run): point the inbox at that article.
    const { data: existing } = await db.from("articles").select("id").eq("source_url", row.link).maybeSingle()
    if (!existing) throw new Error("Карт үүсгэж чадсангүй")
    await db.from("news_items").update({ status: "filed", article_id: existing.id }).eq("id", id)
    return { article_id: existing.id as string }
  }
  return { article_id: articleId }
}

async function run(db: SupabaseClient, trigger: "cron" | "manual") {
  const startedAt = Date.now()
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
    provider: PROVIDER === "rules" ? "rules · эх сурвалж" : PROVIDER === "gemini" ? `gemini · ${GEMINI_MODEL}` : `claude · ${MODEL}`,
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
    await saveInbox(db, fresh, knownUrls)
    if (items.length === 0) {
      const error = feeds.ok === 0 ? "Нэг ч эх сурвалж уншигдсангүй" : ""
      await finish({ scanned: fresh.length, created: 0, error, details })
      return { scanned: fresh.length, created: 0, details }
    }

    const { data: tagRows } = await db.from("tags").select("slug, label")
    const tags = (tagRows ?? []) as Tags
    const picks: Pick[] =
      PROVIDER === "rules"
        ? rankByRules(items, PER_RUN, MIN_PRIORITY).map((pick) => ({
            item: items[pick.index],
            why: pick.why,
            priority: pick.priority,
            tags: pick.tags,
            desk: pick.desk,
          }))
        : await rank(items, PER_RUN)
    details.picked = picks.map(({ item, priority }) => ({ title: item.title.slice(0, 140), source: item.source, priority }))

    // Rules and Claude: all at once. Gemini's free tier: two at a time, to stay under its per-minute limit.
    // Gemini: one at a time, so the free tier's per-minute limit isn't hit in a burst.
    const written = await settleInBatches(picks, PROVIDER === "gemini" ? 1 : picks.length, async (pick) => {
      if (Date.now() - startedAt > TIME_BUDGET_MS) throw new Error("Хугацаа хүрэлцсэнгүй. Мэдээний урсгалаас «Карт болгох»-оор нэмнэ")
      return Boolean(await fileStory(db, pick, tags))
    })
    const created = written.filter((result) => result.status === "fulfilled" && result.value).length
    if (PROVIDER === "gemini" && geminiServed.size) details.provider = `gemini · ${[...geminiServed].join(" + ")}`
    details.failures = written.flatMap((result, index) =>
      result.status === "rejected"
        ? [`${picks[index].item.title.slice(0, 60)}: ${String(result.reason?.message ?? result.reason).slice(0, 160)}`]
        : result.value
          ? []
          : [`${picks[index].item.title.slice(0, 60)}: ${PROVIDER === "rules" ? "хадгалж чадсангүй" : "загвар бичихээс татгалзсан"}`],
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

// NEWS_DRY_RUN: imported by dry-run.ts on a laptop, so no server.
if (!Deno.env.get("NEWS_DRY_RUN")) Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (request.method !== "POST") return json({ error: "POST only" }, 405)

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  })

  // { action: "file", id } turns one inbox story into a card; anything else is a full run.
  const body = await request.json().catch(() => ({})) as { action?: string; id?: number }
  const filing = body.action === "file"

  // The daily cron sends the shared secret. People must be signed in: any team member
  // may file an inbox story, only editors and admins start a run.
  const cronSecret = Deno.env.get("NEWS_CRON_SECRET")
  let trigger: "cron" | "manual" = "manual"
  if (!filing && cronSecret && request.headers.get("x-cron-secret") === cronSecret) {
    trigger = "cron"
  } else {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
    const { data } = await db.auth.getUser(token)
    if (!data.user) return json({ error: "Нэвтэрнэ үү" }, 401)
    const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
    if (!profile?.role) return json({ error: "Редакцын гишүүд л ашиглана" }, 403)
    if (!filing && profile.role !== "editor" && profile.role !== "admin") return json({ error: "Редактор, админ л ажиллуулна" }, 403)
  }

  if (PROVIDER === "claude" && !Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "ANTHROPIC_API_KEY тохируулаагүй байна (ADMIN.md)" }, 500)
  if (PROVIDER === "gemini" && !Deno.env.get("GEMINI_API_KEY")) {
    return json({ error: "GEMINI_API_KEY тохируулаагүй байна. Түлхүүргүй бол AI_PROVIDER=rules (ADMIN.md)" }, 500)
  }

  try {
    if (filing) {
      if (!Number.isInteger(body.id)) return json({ error: "id хэрэгтэй" }, 400)
      return json(await fileFromInbox(db, body.id!))
    }
    return json(await run(db, trigger))
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : "Агент ажиллаж чадсангүй" }, 500)
  }
})
