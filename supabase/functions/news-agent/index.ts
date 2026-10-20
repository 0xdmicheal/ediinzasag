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
// NEWS_MIN_PRIORITY (default 5). Runs rank and queue; { action: "next" } (cron, every two minutes) drafts one queued story.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. NEWS_CRON_SECRET
// is a password for the morning call, not an AI key. Deploy with --no-verify-jwt:
// the cron call has no user token, so this function checks the cron secret or the editor's token itself.

import { rankByRules, score, sourceCard } from "./rules.ts"
import { EXEMPLARS, STYLE_CARD, STYLE_PAIRS } from "../_shared/style-card.ts"
import { lintStyle } from "../_shared/style-lint.ts"
import { termLine, termsFor } from "../_shared/termbase.ts"
import { flashBackups, geminiAsk } from "../_shared/gemini.ts"
import { TWO_STEP_REQUIRED, verifiedTwoStep } from "../_shared/assurance.ts"
import { BEATS, EVENTS, SKELETONS, drawPlan, planBrief, planNote, recentFrom, type Classification, type Recent } from "../_shared/skeletons.ts"

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
  /** Drafts that never became a card; draftNext() adds to it after the run. */
  failures: string[]
  /** Set when the model couldn't rank and the rules did. */
  ranking?: string
  /** Picks put in the draft queue. */
  queued?: number
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
    // Scripts and styles can hold "<p" in strings; drop them so no page code reaches the card.
    const html = (await fetchText(url, 12_000)).replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
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
    title: { type: "string", description: "Mongolian headline, at most 14 words, a past or present verb, a number when the news is a number; states the news, not the topic; no exclamation marks" },
    dek: { type: "string", description: "One Mongolian sentence of 15-30 words with the second most important fact; never the headline's figure" },
    slug: { type: "string", description: "Short latin slug, lowercase words joined by hyphens" },
    body_html: { type: "string", description: "Mongolian article body as HTML using only <h2>, <p>, <ul>, <li>, <strong>, <em>, <blockquote> and <a href> for the one inline source link" },
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

/** The planner's read of the story (guide v2.1, Parts 4, 5 and 7): what the skeleton draw needs. */
const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    beat: { type: "string", enum: Object.keys(BEATS) },
    event_type: { type: "string", enum: Object.keys(EVENTS) },
    format: { type: "string", enum: ["medee", "medee_tailbar"], description: "Мэдээ (200-350 words) for a clean fact with little to explain; Мэдээ ба тайлбар (500-900 words) when the source supports the fact plus why and what it means" },
    mongolia_level: { type: "string", enum: ["direct", "channel", "none"], description: "The Mongolia relevance test; when in doubt, none" },
    mongolia_reason: { type: "string", description: "One line: why this level (for direct or channel, the channel and the figure)" },
    fillable: { type: "array", items: { type: "string", enum: SKELETONS.map((s) => s.code) }, description: "Every skeleton whose needs the source text can fill" },
    has_household_figure: { type: "boolean", description: "The source gives a price, rate or wage a household pays or earns" },
    has_dated_precedent: { type: "boolean", description: "The source names an earlier dated event this one repeats or beats" },
    has_named_quote: { type: "boolean", description: "The source quotes a named, on-record speaker" },
    has_contrast: { type: "boolean", description: "Two sourced facts in it really pull apart" },
    has_forecast: { type: "boolean", description: "The source gives a named forecast, target or stated condition" },
  },
  required: ["beat", "event_type", "format", "mongolia_level", "mongolia_reason", "fillable", "has_household_figure", "has_dated_precedent", "has_named_quote", "has_contrast", "has_forecast"],
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

/**
 * Supabase stops an edge function at ~150 s, and one draft (classify + write) takes 40-110 s,
 * so a run never writes: it ranks and queues its picks, and each draft gets a call of its own
 * ({ action: "next" }, pg_cron every two minutes). A draft still unfinished this long after its
 * call began is dropped, so the queue row is saved before Supabase stops the function.
 */
const DRAFT_DEADLINE_MS = 125_000
/**
 * The model's ranking gets this long; past it (or on an error) the run ranks by rules instead.
 * Reading the feeds takes ~10 s, so this leaves room inside the 150 s and covers a busy-wait and retry.
 */
const RANK_BUDGET_MS = 100_000
/** A queued story is tried this many times (Gemini busy, too slow), then goes back to the inbox. */
const QUEUE_ATTEMPTS = 3
/** A draft call that died without saving (Supabase stopped it) frees its story after this. */
const DRAFTING_STALE_MS = 5 * 60_000

class DraftTimeout extends Error {}

/** `task`, or a DraftTimeout once `deadline` (epoch ms) passes; a late answer is ignored. */
function beforeDeadline<T>(task: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DraftTimeout("Загвар цагтаа бичиж амжсангүй")), Math.max(0, deadline - Date.now()))
  })
  return Promise.race([task, timeout]).finally(() => clearTimeout(timer))
}


/** One structured JSON call; returns null when the model declines. Retries brief overloads (free tiers hit these often). */
async function ask<T>(system: string, prompt: string, schema: object, effort: "low" | "medium" | "high"): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return PROVIDER === "gemini" ? await askGemini<T>(system, prompt, schema, effort) : await askClaude<T>(system, prompt, schema, effort)
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
function askGemini<T>(system: string, prompt: string, schema: object, thinking: "low" | "medium" | "high"): Promise<T | null> {
  const backups = () => (GEMINI_FALLBACK === "none" ? Promise.resolve([]) : GEMINI_FALLBACK === "auto" ? flashBackups(GEMINI_MODEL) : Promise.resolve([GEMINI_FALLBACK]))
  return geminiAsk<T>({ system, prompt, schema, models: [GEMINI_MODEL], backups, served: geminiServed, thinking })
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
  // 80 headlines: 110 at "medium" thinking ran past Gemini's 90 s limit (12-18 Oct, "Signal timed out").
  const mongolia = capped(items.filter((item) => item.mongolia), 8).slice(0, 30)
  const world = capped(items.filter((item) => !item.mongolia), 8).slice(0, 80 - mongolia.length)
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
      `This is an economics desk: never pick sport, crime, culture, courtesy visits or personnel appointments, even about Mongolia, unless the story itself is about money (a budget, prices, a deal, a loan). ` +
      `priority: 10 = must cover today, 5 = useful context, 1 = barely relevant.\n\n${list}`,
    RANK_SCHEMA,
    "low",
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

interface Draft {
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

type Briefing = Draft & {
  format: "medee" | "medee_tailbar"
  mongolia_level: "direct" | "channel" | "none"
  mongolia_reason: string
  /** The structure line for the editor's notes (planNote). */
  structure: string
}

/** Step 1 of a draft: beat, event type, format, Mongolia level and the skeletons the source can fill. */
function classify(item: FeedItem, text: string) {
  return ask<Classification & { mongolia_reason: string }>(
    `${NEWSROOM}\n\nYou are the planning editor at ediinzasag.mn. You do not write the article; you read the source and route it, following the EZ Writing System v2.1.`,
    `Source story from ${item.source}.\nHeadline: ${item.title}\nFeed summary: ${item.summary}\n\nSource text:\n${(text || "(only the feed summary)").slice(0, 12_000)}\n\n` +
      `Beats: ${Object.entries(BEATS).map(([key, beat]) => `${key} (${beat.label})`).join(", ")}.\n` +
      `Event types: ${Object.entries(EVENTS).map(([key, event]) => `${key} (${event.label})`).join(", ")}.\n` +
      `Skeletons (code, use when, what the source must hold):\n${SKELETONS.map((s) => `${s.code} ${s.name}: ${s.use}; needs ${s.needs}`).join("\n")}\n\n` +
      `Route this story. Pick one beat and one event type. Pick the format the source can carry; if it cannot support 500 words, medee. ` +
      `Set mongolia_level: direct if the subject is Mongolian; channel only if the source itself names the channel and gives a measured, material Mongolian exposure (5 percent or more of exports, the budget, reserves or a household cost) from the last 12 months; otherwise none. When in doubt, none. ` +
      `List in fillable every skeleton whose needs this source text actually holds, not those that would need facts from elsewhere. Answer the yes/no fields from the source text only.`,
    CLASSIFY_SCHEMA,
    "low",
  )
}

/**
 * Routes the story, draws its structure (skeleton, lede, ending, headline pattern)
 * against the last drafts so pieces in a row differ (guide v2.1, Parts 5 and 6),
 * then writes it to that plan. `recent` comes from recentFrom(), newest first.
 */
export async function write(item: FeedItem, text: string, why: string, tags: { slug: string; label: string }[], recent: Recent[] = []): Promise<Briefing | null> {
  const routed = await classify(item, text).catch((error) => {
    console.warn("classify skipped:", error instanceof Error ? error.message : error)
    return null
  })
  // No routing: a Мэдээ in the brief-news order, with nothing about Mongolia.
  const story = routed ?? {
    beat: "mongolia_macro", event_type: "follow_up", format: "medee", mongolia_level: "none", mongolia_reason: "", fillable: ["S18"],
    has_household_figure: false, has_dated_precedent: false, has_named_quote: false, has_contrast: false, has_forecast: false,
  } satisfies Classification & { mongolia_reason: string }
  const plan = drawPlan(story, recent)
  const draft = await writeToPlan(item, text, why, tags, story, planBrief(plan, story.mongolia_level))
  if (!draft) return null
  return { ...draft, format: plan.format, mongolia_level: story.mongolia_level, mongolia_reason: story.mongolia_reason, structure: planNote(plan, story) }
}

function writeToPlan(item: FeedItem, text: string, why: string, tags: { slug: string; label: string }[], story: Classification, brief: string) {
  const formatLine =
    story.format === "medee"
      ? `Format: Мэдээ, 200-350 words, no subheads. Meet the range; never pad.`
      : `Format: Мэдээ ба тайлбар, 500-900 words, 0-2 subheads, at least six distinct figures spread through the text. Meet the range; never pad.`
  const mongoliaLine = {
    direct: `Mongolia level: direct. Mongolia is the story; the context runs through the piece. No separate Mongolia section.`,
    channel: `Mongolia level: channel. One paragraph with the sourced exposure figure, no subhead, where it fits the logic, usually after the mechanism.`,
    none: `Mongolia level: none. Nothing about Mongolia: no paragraph, no closing line, no hint.`,
  }[story.mongolia_level]
  const terms = termsFor(`${item.title} ${item.summary} ${text}`)
  const termbase = terms.length ? `Termbase (use these renderings; gloss as the policy says):\n${terms.map(termLine).join("\n")}` : ""
  return ask<Draft>(
    `${NEWSROOM}\n\nYou are a senior writer at ediinzasag.mn. You write in Mongolian (Cyrillic) for educated general readers, to the standard of the Financial Times, Reuters and Bloomberg: precise, calm, specific. ` +
      `A human editor checks every fact and decides whether to publish. ` +
      `It must read as written by a Mongolian journalist, never as a translation or as generic AI prose.\n\n${STYLE_CARD}\n\n${STYLE_PAIRS}\n\n${EXEMPLARS}`,
    // Gemini 3 drops constraints placed early in a long prompt (guide v2.1, 15.2): data first, then the task, then the rules.
    `Source story from ${item.source}.\n` +
      `Headline: ${item.title}\nPublished: ${item.published ? new Date(item.published).toISOString() : "unknown"}\nURL: ${item.link}\n` +
      `Feed summary: ${item.summary}\n\nSource text:\n${text || "(Only the feed summary is available. Write a short Мэдээ and say in verify_notes that the full text must be read.)"}\n\n` +
      (termbase ? `${termbase}\n\n` : "") +
      `Why it was picked: ${why}\n\n` +
      `Based on the source above, write one ediinzasag.mn article in Mongolian. The source text is the only source of facts; it overrides anything you remember, including dates, office holders and prices. Combine, compare and explain its facts freely.\n` +
      `The planning editor has set the format, the Mongolia level and the structure. Follow them; do not choose your own.\n${formatLine}\n${mongoliaLine}\n${brief}\n\n` +
      `1. Lede: the news in one or two sentences with who, what, how much and an absolute date, in the lede type above.\n` +
      `2. By paragraph two to four, state why it matters as a statement with a figure, never announced.\n` +
      `3. Then the skeleton's moves, in order. A move the source cannot fill is dropped, never padded or confessed.\n` +
      `4. Body (body_html): <p> paragraphs of three to five sentences, each with a number, name, date or document. Explain the mechanism plainly. Give every figure its base and period; compare like with like. Subheads (<h2>) only in medee_tailbar, each stating its section's point, each section two or more paragraphs and 100 words.\n` +
      `5. In medee_tailbar, include the strongest opposing reading named in the source. If the source names none, leave it out and say so in verify_notes.\n` +
      `6. End with the ending type above: a forward-looking fact from the source. Never a summary, a moral or a slogan.\n` +
      `7. Link the source once, inline, on its name or on the words that carry the fact: <a href="${item.link}">…</a>.\n` +
      `8. If you compute anything (a share, a difference, a per-day figure), label it once with «Тооцооллоор» and write the arithmetic in verify_notes so the editor can check it.\n\n` +
      `Fields:\n` +
      `- tags: 1-4 slugs chosen only from this list: ${tags.map((tag) => `${tag.slug} (${tag.label})`).join(", ")}.\n` +
      `- desk: "mongolia" only if the story is mainly about Mongolia, otherwise "world".\n` +
      `- claims: every figure, date and quote you used, traced to the source text. If a figure is not in the source text, do not use it.\n` +
      `- verify_notes: 2-5 concrete things for the editor: figures to check against the original, names and titles, the primary (T1) document to find and link (the release, filing or table: Монголбанк, ҮСХ 1212.mn, Гаалийн ерөнхий газар, the company's own report), and any point you dropped because the source lacked it. This is the only place to mention what you could not verify; it never appears on the site.\n\n` +
      `Constraints, applied last and strictly:\n` +
      `- Numbers inside full sentences, at most three per sentence. «хувь» in prose; % only in the headline. «нэгж хувь» for rate changes. No + or − signs in prose. No em or en dashes. Quotes in «». No exclamation marks.\n` +
      `- No source list, no «Эх сурвалж» heading, no bare URLs, no disclaimer («зөвлөгөө биш»), no AI or tool label, no «EZ-ийн дүгнэлт» or summary block.\n` +
      `- Never write label headings: «Юу болов», «Яагаад чухал вэ», «Монголд ямар хамаатай вэ», «Юуг ажиглах вэ», «Дүгнэлт».\n` +
      `- Never mention in the article that a source lacked data; leave the point out.\n` +
      `- Vary paragraph openers; the same content word at most three times per 300 words; the same reporting verb at most twice.\n` +
      `- Never use the banned phrases and patterns A to P in the style card.`,
    BRIEFING_SCHEMA,
    // "high" ran past Gemini's 90 s limit on every draft (19 Oct); the plan above carries the structure.
    "medium",
  )
}

/**
 * After the model: apply the style book's mechanical fixes (dashes, иен, ОПЕК,
 * month digits, «quotes»…), then list what is left for the editor, plus any
 * number in the draft that the source text does not contain (a light form of the guide's W03).
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
  if (unsourced.length) notes.push(`Эх сурвалжид олдоогүй тоо: ${unsourced.slice(0, 8).join(", ")}. Өөрсдөө тооцоолсон бол «Тооцооллоор» гэж нэг удаа тэмдэглэж, тооцоог шалгана, эс бөгөөс хасна.`)
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

const ALLOWED_HTML = /<(?!\/?(?:h2|h3|p|ul|ol|li|strong|em|b|i|blockquote|br|a)\b)[^>]*>/gi

/** Sources are inline links (guide v2.1, Part 10): keep an http(s) href and nothing else on <a>. */
function cleanBody(html: string) {
  return html
    .replace(ALLOWED_HTML, "")
    .replace(/<a\b[^>]*?\bhref="(https?:\/\/[^"]+)"[^>]*>/gi, '<a href="$1">')
    .replace(/<a\b(?![^>]*href="https?:)[^>]*>([\s\S]*?)<\/a>/gi, "$1")
}

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

/** The structures of the last 20 agent drafts, newest first, read back from their bot notes. */
async function recentStructures(db: SupabaseClient): Promise<Recent[]> {
  const { data } = await db
    .from("articles")
    .select("bot_notes")
    .like("bot_notes", "%Бүтэц: S%")
    .order("created_at", { ascending: false })
    .limit(20)
  return recentFrom((data ?? []).map((row: { bot_notes: string }) => row.bot_notes))
}

/**
 * Files one story as an unclaimed bot article in review: a model draft, or the
 * source card in rules mode. `cardIfNoDraft` (a person asked for this story)
 * falls back to the card when the model declines, fails or runs past `deadline`,
 * instead of filing nothing. Resolves with the new article's id, or null when nothing was filed.
 */
async function fileStory(
  db: SupabaseClient,
  pick: { item: FeedItem; why: string; priority: number; tags?: string[]; desk?: "mongolia" | "world" },
  tags: Tags,
  deadline: number,
  cardIfNoDraft = false,
): Promise<string | null> {
  const { item, why, priority } = pick
  const page = await readArticle(item.link)
  let missed = ""
  const draftStart = Date.now()
  const drafted =
    PROVIDER === "rules"
      ? null
      : await beforeDeadline(recentStructures(db).then((recent) => write(item, page.text, why, tags, recent)), deadline).catch((error) => {
          if (!cardIfNoDraft) throw error
          missed = error instanceof Error ? error.message : String(error)
          console.warn("draft skipped, filing the source card:", missed)
          return null
        })
  const briefing = drafted ? polish(drafted, `${item.title} ${item.summary} ${page.text}`) : null
  if (!briefing && PROVIDER !== "rules" && !cardIfNoDraft) return null
  const card = briefing ? null : sourceCard({ title: item.title, source: item.source, summary: item.summary, excerpt: page.text, published: item.published, link: item.link })
  const tagSlugs = new Set(tags.map((tag) => tag.slug))
  const slug = `${slugify(briefing?.slug || item.title) || "medee"}-${Date.now().toString(36).slice(-4)}`
  const coverUrl = await copyImage(db, page.image || item.image, slug)
  const { data, error } = await db
    .from("articles")
    .insert({
      slug,
      title: (card?.title || briefing!.title).slice(0, 120),
      dek: card?.dek || briefing!.dek,
      body: cleanBody(card?.body || briefing!.body_html),
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
          ? [
              ...(PROVIDER === "rules" ? [] : [`Агент ноорог бичээгүй (${missed.slice(0, 160) || "загвар татгалзсан"}). Эх сурвалжийн картаас бичнэ.`]),
              "Тоо, нэр, огноог эхтэй тулгана.", "Монголоор дахин бичнэ (EZ Writing System v2.1): эх сурвалжийг нэр дээр нь холбоосоор, жагсаалтгүй.", "Нүүр зургийн эрхийг шалгана."]
          : [
              `Формат: ${briefing!.format === "medee" ? "Мэдээ" : "Мэдээ ба тайлбар"} · Монгол: ${{ direct: "шууд", channel: "суваг", none: "хамааралгүй" }[briefing!.mongolia_level] ?? briefing!.mongolia_level}${briefing!.mongolia_reason ? ` (${briefing!.mongolia_reason})` : ""}`,
              briefing!.structure,
              `Ноорог ${Math.round((Date.now() - draftStart) / 1000)} секундэд бичигдсэн.`,
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

/**
 * "Устгах" in the inbox: deletes the card a story became and parks the story in «Хаасан»,
 * which also keeps the morning run from filing it again. Editors may delete until it is
 * published; admins always.
 */
async function deleteCard(db: SupabaseClient, id: number, role: string) {
  const { data: row, error } = await db.from("news_items").select("id, article_id").eq("id", id).maybeSingle()
  if (error) throw error
  if (!row) throw new Error("Мэдээ олдсонгүй")
  if (row.article_id) {
    const { data: article } = await db.from("articles").select("status").eq("id", row.article_id).maybeSingle()
    if (article?.status === "published" && role !== "admin") throw new Error("Нийтлэгдсэн картыг админ л устгана")
    const { error: removeError } = await db.from("articles").delete().eq("id", row.article_id)
    if (removeError) throw removeError
  }
  await db.from("news_items").update({ status: "dismissed", article_id: null }).eq("id", id)
  return { deleted: true }
}

/** "Карт болгох" in the inbox: one stored story becomes an article card. */
async function fileFromInbox(db: SupabaseClient, id: number, deadline: number) {
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
  const articleId = await fileStory(db, { item, why: row.why, priority: row.priority, tags: row.tags, desk: row.desk }, (tagRows ?? []) as Tags, deadline, true)
  if (!articleId) {
    // Filed before under the same link (e.g. by the morning run): point the inbox at that article.
    const { data: existing } = await db.from("articles").select("id").eq("source_url", row.link).maybeSingle()
    if (!existing) throw new Error("Карт үүсгэж чадсангүй")
    await db.from("news_items").update({ status: "filed", article_id: existing.id }).eq("id", id)
    return { article_id: existing.id as string }
  }
  return { article_id: articleId }
}

interface QueueRow {
  id: number
  link: string
  source: string
  title: string
  summary: string
  image: string
  published_at: string | null
  mongolia: boolean
  priority: number
  why: string
  tags: string[]
  desk: "mongolia" | "world"
  status: "queued" | "drafting"
  attempts: number
  run_id: number | null
}

/** Adds to the run that queued a story: one more card, or a failure line for the board. */
async function noteOnRun(db: SupabaseClient, runId: number | null, outcome: { created: true } | { failure: string }) {
  if (!runId) return
  const { data: row } = await db.from("news_runs").select("created, error, details").eq("id", runId).maybeSingle()
  if (!row) return
  if ("created" in outcome) {
    await db.from("news_runs").update({ created: (row.created ?? 0) + 1 }).eq("id", runId)
    return
  }
  const details = { ...(row.details ?? {}), failures: [...(row.details?.failures ?? []), outcome.failure] }
  await db.from("news_runs").update({ details, error: (row.error || outcome.failure).slice(0, 300) }).eq("id", runId)
}

/**
 * { action: "next" } from pg_cron: drafts the best queued story, one per call, so every draft
 * has the whole function time to itself. A busy or slow model puts the story back for the next
 * call; after QUEUE_ATTEMPTS tries it returns to the inbox («Шинэ») for «Карт болгох».
 */
async function draftNext(db: SupabaseClient, deadline: number) {
  const stale = new Date(Date.now() - DRAFTING_STALE_MS).toISOString()
  const { data: rows, error } = await db
    .from("news_items")
    .select("id, link, source, title, summary, image, published_at, mongolia, priority, why, tags, desk, status, attempts, run_id")
    .or(`status.eq.queued,and(status.eq.drafting,queued_at.lt.${stale})`)
    .order("run_id", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
    .limit(1)
  if (error) throw error
  const row = (rows as QueueRow[] | null)?.[0]
  if (!row) return { idle: true }
  const title = row.title.slice(0, 60)
  if (row.attempts >= QUEUE_ATTEMPTS) {
    await db.from("news_items").update({ status: "new" }).eq("id", row.id).eq("status", row.status)
    await noteOnRun(db, row.run_id, { failure: `${title}: ${QUEUE_ATTEMPTS} удаа оролдоод бичиж чадсангүй. Мэдээний урсгалаас «Карт болгох»-оор нэмнэ` })
    return { gave_up: row.id }
  }
  // Claim it; a parallel call that got here first wins and this one stops.
  const { data: claimed } = await db
    .from("news_items")
    .update({ status: "drafting", attempts: row.attempts + 1, queued_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", row.status)
    .eq("attempts", row.attempts)
    .select("id")
    .maybeSingle()
  if (!claimed) return { idle: true }

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
  try {
    const articleId = await fileStory(db, { item, why: row.why, priority: row.priority, tags: row.tags, desk: row.desk }, (tagRows ?? []) as Tags, deadline)
    if (articleId) {
      await noteOnRun(db, row.run_id, { created: true })
      return { article_id: articleId }
    }
    // The model declined the story: back to the inbox, where a person can still make a card.
    await db.from("news_items").update({ status: "new" }).eq("id", row.id)
    await noteOnRun(db, row.run_id, { failure: `${title}: загвар бичихээс татгалзсан` })
    return { declined: row.id }
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure)
    const last = row.attempts + 1 >= QUEUE_ATTEMPTS
    await db.from("news_items").update({ status: last ? "new" : "queued" }).eq("id", row.id)
    if (last) await noteOnRun(db, row.run_id, { failure: `${title}: ${message.slice(0, 160)}` })
    return { retry: !last, error: message.slice(0, 200) }
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
    // Stories someone closed or whose card was deleted stay out of the picks.
    const { data: closed } = await db.from("news_items").select("link").eq("status", "dismissed")
    const closedUrls = new Set((closed ?? []).map((row: { link: string }) => row.link))
    // Stories already waiting in the queue aren't picked twice.
    const { data: waiting } = await db.from("news_items").select("link").in("status", ["queued", "drafting"])
    const waitingUrls = new Set((waiting ?? []).map((row: { link: string }) => row.link))
    const items = fresh.filter((item) => !knownUrls.has(item.link) && !closedUrls.has(item.link) && !waitingUrls.has(item.link))
    details.new = items.length
    await saveInbox(db, fresh, knownUrls)
    if (items.length === 0) {
      const error = feeds.ok === 0 ? "Нэг ч эх сурвалж уншигдсангүй" : ""
      await finish({ scanned: fresh.length, created: 0, error, details })
      return { scanned: fresh.length, created: 0, queued: 0, details }
    }

    const byRules = () =>
      rankByRules(items, PER_RUN, MIN_PRIORITY).map((pick) => ({ item: items[pick.index], why: pick.why, priority: pick.priority, tags: pick.tags, desk: pick.desk }))
    // A busy or slow model no longer ends the run (12-20 Oct): the rules pick instead, and the drafts still go to the model.
    const picks: Pick[] =
      PROVIDER === "rules"
        ? byRules()
        : await beforeDeadline(rank(items, PER_RUN), Date.now() + RANK_BUDGET_MS).catch((error) => {
            details.ranking = `Дүрмээр эрэмбэлсэн (AI: ${(error instanceof Error ? error.message : String(error)).slice(0, 120)})`
            return byRules()
          })
    details.picked = picks.map(({ item, priority }) => ({ title: item.title.slice(0, 140), source: item.source, priority }))
    if (PROVIDER === "gemini" && geminiServed.size) details.provider = `gemini · ${[...geminiServed].join(" + ")}`

    // Queue the picks with their reasons; draftNext() writes them one call at a time.
    let queued = 0
    for (const pick of picks) {
      const { data } = await db
        .from("news_items")
        .update({ status: "queued", attempts: 0, queued_at: new Date().toISOString(), run_id: runRow?.id ?? null, why: pick.why.slice(0, 300), priority: Math.round(pick.priority) })
        .eq("link", pick.item.link)
        .eq("status", "new")
        .select("id")
      queued += data?.length ?? 0
    }
    details.queued = queued
    await finish({ scanned: fresh.length, created: 0, error: "", details })
    return { scanned: fresh.length, created: 0, queued, details }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finish({ error: message.slice(0, 300), details })
    throw error
  }
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

// NEWS_DRY_RUN: imported by dry-run.ts on a laptop, so no server.
if (!Deno.env.get("NEWS_DRY_RUN")) Deno.serve(async (request) => {
  const received = Date.now()
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (request.method !== "POST") return json({ error: "POST only" }, 405)

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  })

  // { action: "file", id } turns one inbox story into a card, { action: "delete", id } removes
  // that card again, { action: "next" } (cron only) drafts one queued story; anything else is a run.
  const body = await request.json().catch(() => ({})) as { action?: string; id?: number }
  const filing = body.action === "file"
  const deleting = body.action === "delete"
  const drafting = body.action === "next"

  // The cron jobs send the shared secret. People must be signed in: any team member
  // may file an inbox story, only editors and admins start a run.
  const cronSecret = Deno.env.get("NEWS_CRON_SECRET")
  let trigger: "cron" | "manual" = "manual"
  let role = ""
  if (!filing && !deleting && cronSecret && request.headers.get("x-cron-secret") === cronSecret) {
    trigger = "cron"
  } else if (drafting) {
    return json({ error: "Зөвхөн автомат ажил" }, 403)
  } else {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
    const { data } = await db.auth.getUser(token)
    if (!data.user) return json({ error: "Нэвтэрнэ үү" }, 401)
    if (!verifiedTwoStep(token)) return json({ error: TWO_STEP_REQUIRED }, 403)
    const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
    if (!profile?.role) return json({ error: "Редакцын гишүүд л ашиглана" }, 403)
    role = profile.role
    if (!filing && role !== "editor" && role !== "admin") return json({ error: deleting ? "Редактор, админ л устгана" : "Редактор, админ л ажиллуулна" }, 403)
  }

  if (deleting) {
    if (!Number.isInteger(body.id)) return json({ error: "id хэрэгтэй" }, 400)
    try {
      return json(await deleteCard(db, body.id!, role))
    } catch (error) {
      console.error(error)
      return json({ error: error instanceof Error ? error.message : "Карт устгаж чадсангүй" }, 500)
    }
  }

  if (PROVIDER === "claude" && !Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "ANTHROPIC_API_KEY тохируулаагүй байна (ADMIN.md)" }, 500)
  if (PROVIDER === "gemini" && !Deno.env.get("GEMINI_API_KEY")) {
    return json({ error: "GEMINI_API_KEY тохируулаагүй байна. Түлхүүргүй бол AI_PROVIDER=rules (ADMIN.md)" }, 500)
  }

  try {
    if (filing) {
      if (!Number.isInteger(body.id)) return json({ error: "id хэрэгтэй" }, 400)
      return json(await fileFromInbox(db, body.id!, received + DRAFT_DEADLINE_MS))
    }
    if (drafting) return json(await draftNext(db, received + DRAFT_DEADLINE_MS))
    return json(await run(db, trigger))
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : "Агент ажиллаж чадсангүй" }, 500)
  }
})
