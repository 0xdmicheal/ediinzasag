// Ranks RSS items and builds a source card with no model and no API key.
// A person still translates the story and writes the EZ take before it can publish.

export interface RuleItem {
  source: string
  title: string
  summary: string
  published: number | null
  mongolia: boolean
}

export interface RulePick {
  index: number
  priority: number
  why: string
  tags: string[]
  desk: "mongolia" | "world"
}

const word = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "iu")

/** Points are additive. A Mongolia hit outranks a general market headline. */
const TOPICS: { test: RegExp; points: number; why: string; tag?: string; mongolia?: boolean }[] = [
  { test: word("монгол|mongolia|ulaanbaatar|улаанбаатар|монголбанк"), points: 6, why: "Монголын тухай", mongolia: true },
  { test: word("oyu tolgoi|оюу толгой"), points: 5, why: "Оюу толгой", tag: "mining", mongolia: true },
  { test: word("copper|зэс|coal|нүүрс|coking|gold|алт|iron ore|төмрийн хүдэр"), points: 4, why: "экспортын түүхий эд", tag: "mining" },
  { test: word("tugrik|tögrög|togrog|төгрөг|mnt"), points: 4, why: "төгрөг", mongolia: true },
  { test: word("crude|brent|wti|газрын тос|diesel|шатахуун|petroleum"), points: 3, why: "шатахуун", tag: "fuel" },
  { test: word("inflation|инфляц|interest rate|policy rate|бодлогын хүү|central bank"), points: 3, why: "үнэ ба хүү", tag: "policy" },
  { test: word("imf|world bank|нөөц|foreign reserves|reserves"), points: 3, why: "нөөц" },
  { test: word("china|chinese|хятад|beijing|pboc"), points: 2, why: "Хятад", tag: "china" },
  { test: word("export|import|гааль|trade surplus|budget|төсөв"), points: 2, why: "худалдаа, төсөв" },
  { test: word("federal reserve|fed|treasury yield|bond yield|nasdaq|s&p|wall street"), points: 2, why: "дэлхийн зах зээл", tag: "markets" },
  { test: word("eurozone|ecb|европ"), points: 1, why: "Европ", tag: "europe" },
  { test: word("united states|америк|trump|white house"), points: 1, why: "АНУ", tag: "us" },
  { test: word("tariff|тариф|trade war|худалдааны дайн|sanction|хориг арга хэмжээ|export control"), points: 3, why: "худалдааны дайн", tag: "geopolitics" },
  { test: word("war|дайн|ukraine|украин|taiwan|тайвань|missile|military|цэрэг"), points: 2, why: "геополитик", tag: "geopolitics" },
  { test: word("semiconductor|chip|чип|nvidia|tsmc|artificial intelligence|хиймэл оюун|ai"), points: 2, why: "технологи", tag: "tech" },
  { test: word("startup|стартап|fintech|финтек|crypto|крипто|bitcoin|биткойн"), points: 1, why: "технологи", tag: "tech" },
]

/** Opinion, video and listicles lose to a straight news report. */
const SKIP = word("opinion|podcast|video|newsletter|quiz|live blog")

function tokens(title: string) {
  return new Set(title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((part) => part.length > 3))
}

function sameEvent(a: Set<string>, b: Set<string>) {
  let shared = 0
  for (const part of a) if (b.has(part)) shared += 1
  const smaller = Math.min(a.size, b.size)
  return smaller >= 2 && shared / smaller >= 0.6
}

function score(item: RuleItem) {
  const text = `${item.title} ${item.summary}`
  if (SKIP.test(item.title)) return { priority: 0, why: "тойм, подкаст эсвэл бичлэг", tags: [] as string[], desk: "world" as const }
  let topic = 0
  const whys: string[] = []
  const tags: string[] = []
  let mongolia = item.mongolia
  for (const rule of TOPICS) {
    if (!rule.test.test(text)) continue
    topic += rule.points
    whys.push(rule.why)
    if (rule.tag && !tags.includes(rule.tag)) tags.push(rule.tag)
    if (rule.mongolia) mongolia = true
  }
  if (item.mongolia && !whys.includes("Монголын тухай")) whys.unshift("Монголын эх сурвалж")
  let recency = 0
  if (item.published) {
    const hours = (Date.now() - item.published) / 3_600_000
    if (hours >= 0 && hours <= 12) recency = 2
    else if (hours <= 24) recency = 1
  }
  const bonus = item.mongolia ? 2 : 0
  // A headline with no topic match stays a filler (1), so it only fills an empty quota.
  const priority = topic === 0 && !item.mongolia ? (recency > 0 ? 1 : 0) : Math.min(10, topic + recency + bonus)
  return {
    priority,
    why: whys.join(", ") || "шинэ мэдээ",
    tags,
    desk: mongolia ? ("mongolia" as const) : ("world" as const),
  }
}

/**
 * Chooses `count` stories. Strong scores come first. One source cannot fill
 * the list, and a second headline about the same event is dropped.
 */
export function rankByRules(items: RuleItem[], count: number, minPriority = 5): RulePick[] {
  const perSource = new Map<string, number>()
  const ranked = items
    .map((item, index) => ({ index, item, ...score(item) }))
    .filter((row) => row.priority > 0)
    .sort((a, b) => b.priority - a.priority || (b.item.published ?? 0) - (a.item.published ?? 0))

  const chosen: typeof ranked = []
  const seen = chosen.map((row) => tokens(row.item.title))
  const take = (row: (typeof ranked)[number]) => {
    const used = perSource.get(row.item.source) ?? 0
    if (used >= 2) return false
    const words = tokens(row.item.title)
    if (seen.some((other) => sameEvent(words, other))) return false
    perSource.set(row.item.source, used + 1)
    seen.push(words)
    chosen.push(row)
    return true
  }

  for (const row of ranked) {
    if (chosen.length >= count) break
    if (row.priority >= minPriority) take(row)
  }
  for (const row of ranked) {
    if (chosen.length >= count) break
    if (row.priority < minPriority) take(row)
  }

  return chosen.map((row) => ({
    index: row.index,
    priority: row.priority,
    why: row.why,
    tags: row.tags,
    desk: row.desk,
  }))
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`
}

/** A review card: the source's own words, plus empty sections for the editor. */
export function sourceCard(input: { title: string; source: string; summary: string; excerpt: string; published: number | null }) {
  const when = input.published ? new Date(input.published).toISOString().slice(0, 10).replace(/-/g, ".") : "огноо тодорхойгүй"
  const quoted = clip(input.excerpt || input.summary, 700)
  const quote = quoted
    ? `<blockquote>${escapeHtml(quoted)}</blockquote><p>Дээрх хэсэг ${escapeHtml(input.source)}-ийн өөрийн үг. Орчуулж, тоог эхтэй тулгаад эндээс дахин бичнэ.</p>`
    : `<p>Эх сурвалж дээрээс ишлэл ирсэнгүй. Холбоосыг нээгээд эхээс нь бичнэ.</p>`
  return {
    title: clip(input.title, 120),
    dek: clip(input.summary || `${input.source}, ${when}`, 200),
    body: [
      `<h2>Эх сурвалж</h2>`,
      `<p><strong>${escapeHtml(input.source)}</strong>, ${when}.</p>`,
      `<h2>Юу болов</h2>`,
      `<p>${escapeHtml(input.title)}</p>`,
      quote,
      `<h2>Яагаад чухал вэ</h2>`,
      `<p>Редактор бичнэ.</p>`,
      `<h2>Монголд ямар хамаатай вэ</h2>`,
      `<p>Редактор бичнэ. Эхэд байхгүй тоо бүү нэм.</p>`,
    ].join(""),
  }
}
