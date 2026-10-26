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

/**
 * Mongolian nouns take case endings («Шатахууны», «толгойн», «хүүг»), so a Cyrillic
 * keyword also matches with one of them. Only real endings: «хүү» must not match «хүүхэд».
 */
const ENDINGS =
  "(?:ы|ий|н|ын|ийн|ны|ний|ыг|ийг|г|д|т|нд|аас|ээс|оос|өөс|наас|нээс|ноос|нөөс|аар|ээр|оор|өөр|гаар|гээр|гоор|гөөр|тай|тэй|той|ууд|үүд|нууд|нүүд)?"

const word = (body: string) => {
  const alternatives = body.split("|").map((part) => (/[Ѐ-ӿ]/.test(part) && !part.includes("\\p{L}") ? `${part}${ENDINGS}` : part))
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "iu")
}

/** Points are additive. A Mongolia hit outranks a general market headline. */
const TOPICS: { test: RegExp; points: number; why: string; tag?: string; mongolia?: boolean }[] = [
  { test: word("монгол|mongolia|ulaanbaatar|улаанбаатар|монголбанк"), points: 6, why: "Монголын тухай", mongolia: true },
  { test: word("oyu tolgoi|оюу толгой"), points: 5, why: "Оюу толгой", tag: "mining", mongolia: true },
  { test: word("copper|зэс|coal|нүүрс|coking|gold|алт|iron ore|төмрийн хүдэр"), points: 4, why: "экспортын түүхий эд", tag: "mining" },
  { test: word("tugrik|tögrög|togrog|төгрөг|mnt"), points: 4, why: "төгрөг", mongolia: true },
  { test: word("crude|brent|wti|oil|opec|опек|газрын тос|diesel|дизель|бензин|шатахуун|petroleum"), points: 3, why: "шатахуун", tag: "fuel" },
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
const SKIP = word(
  "opinion|podcast|video|newsletter|quiz|live blog|sponsored|" +
    // Mongolian sites' columns, interviews and paid posts («…тэмдэглэл #01», «нийтлэлч»).
    "тэмдэглэл|нийтлэлч|ярилцлага|байр суурь|сурталчилгаа|ивээн тэтгэ\\p{L}*|PR|подкаст|видео",
)
/** A headline shouting a word in capitals («…бол НӨӨЦЛӨХ») is a column, not a report. */
const SHOUT = /(?<![\p{L}])\p{Lu}{4,}(?![\p{L}])/u
/** Short all-caps names that aren't shouting. */
const ACRONYMS = new Set(["IMF", "OPEC", "NASDAQ", "ОУВС", "ОПЕК", "АНУ", "УИХ", "ДНБ", "ҮСХ", "ХБНГУ", "ОХУ", "БНХАУ", "ЕХ", "НҮБ", "МХБ", "ТББ", "ХХААХҮЯ", "ЗГ", "MSCI", "COVID"])

/**
 * Mongolian feeds (Itoim, Montsame…) carry everything: sport, crime, appointments.
 * Being about Mongolia only counts when the story is also about money; this is that test.
 */
const ECONOMY = word(
  "эдийн засаг\\p{L}*|үнэ\\p{L}*|төсөв\\p{L}*|татвар\\p{L}*|зээл\\p{L}*|хүү|банк\\p{L}*|валют\\p{L}*|ханш\\p{L}*|инфляц\\p{L}*|" +
    "экспорт\\p{L}*|импорт\\p{L}*|худалдаа\\p{L}*|хөрөнгө\\p{L}*|бирж\\p{L}*|хувьцаа\\p{L}*|компани\\p{L}*|үйлдвэр\\p{L}*|уул уурхай\\p{L}*|" +
    "орлого\\p{L}*|цалин\\p{L}*|тэтгэвэр\\p{L}*|өр|бонд\\p{L}*|тэрбум|их наяд|ам\\.?доллар\\p{L}*|төсв\\p{L}*|үнийн|төгрөг\\p{L}*|түлш\\p{L}*|шатахуун\\p{L}*|" +
    "эрчим хүч\\p{L}*|тариф\\p{L}*|гааль\\p{L}*|ДНБ|ажилгүй\\p{L}*|" +
    "econom\\p{L}*|price\\p{L}*|budget|tax\\p{L}*|loan\\p{L}*|bank\\p{L}*|invest\\p{L}*|export\\p{L}*|import\\p{L}*|trade|mining|mine|" +
    "copper|coal|gold|fuel|oil|bond\\p{L}*|debt|gdp|inflation|currency|tugrik|revenue|stock\\p{L}*|market\\p{L}*|billion|million",
)

/** Off-desk news that Mongolian feeds mix in. */
const OFF_DESK = word(
  "спорт\\p{L}*|тамирчин\\p{L}*|наадам\\p{L}*|тэмцээн\\p{L}*|медаль\\p{L}*|аварга\\p{L}*|шигшээ\\p{L}*|бөх|хөлбөмбөг\\p{L}*|" +
    "осол\\p{L}*|гэмт хэрэг\\p{L}*|цагдаа\\p{L}*|хулгай\\p{L}*|дуучин|жүжигчин|кино|концерт\\p{L}*|олимп\\p{L}*|" +
    "томилогдсон|томилогдлоо|томиллоо|чөлөөлөгдлөө|sport\\p{L}*|football|olympic\\p{L}*|medal\\p{L}*|concert",
)

function tokens(title: string) {
  return new Set(title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((part) => part.length > 3))
}

function sameEvent(a: Set<string>, b: Set<string>) {
  let shared = 0
  for (const part of a) if (b.has(part)) shared += 1
  const smaller = Math.min(a.size, b.size)
  return smaller >= 2 && shared / smaller >= 0.6
}

/** The relevance score of one story: 0–10, why, topic tags and desk. */
export function score(item: RuleItem) {
  const text = `${item.title} ${item.summary}`
  const shouted = [...item.title.matchAll(new RegExp(SHOUT, "gu"))].some((match) => !ACRONYMS.has(match[0]))
  if (SKIP.test(item.title) || shouted) return { priority: 0, why: "тойм, нийтлэл, ярилцлага эсвэл сурталчилгаа", tags: [] as string[], desk: "world" as const }
  let topic = 0
  const whys: string[] = []
  const tags: string[] = []
  let mongolia = item.mongolia
  const economic = ECONOMY.test(text)
  // Sport, crime, culture, appointments: in the inbox, but never picked on Mongolia alone.
  if (OFF_DESK.test(item.title) && !economic) return { priority: 1, why: "эдийн засгийн бус мэдээ", tags: [] as string[], desk: item.mongolia ? ("mongolia" as const) : ("world" as const) }
  for (const rule of TOPICS) {
    if (!rule.test.test(text)) continue
    // "Монгол" alone is no reason to pick a story; it has to be about the economy too.
    if (rule.why === "Монголын тухай" && !economic) continue
    topic += rule.points
    whys.push(rule.why)
    if (rule.tag && !tags.includes(rule.tag)) tags.push(rule.tag)
    if (rule.mongolia) mongolia = true
  }
  // A Mongolian source on prices, budgets or companies is the desk's core, even with no keyword above.
  if (item.mongolia && economic && topic === 0) {
    topic = 4
    whys.push("Монголын эдийн засаг")
  }
  if (item.mongolia && !whys.includes("Монголын тухай")) whys.unshift("Монголын эх сурвалж")
  let recency = 0
  if (item.published) {
    const hours = (Date.now() - item.published) / 3_600_000
    if (hours >= 0 && hours <= 12) recency = 2
    else if (hours <= 24) recency = 1
  }
  const bonus = item.mongolia && economic ? 2 : 0
  // A headline with no topic match stays a filler (1), so it only fills an empty quota.
  const priority = topic === 0 ? (recency > 0 || item.mongolia ? 1 : 0) : Math.min(10, topic + recency + bonus)
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

/**
 * A review card: the source's own words and the steps of the EZ Writing System
 * v2.1, for the editor to replace with the article. No label headings: the
 * guide retired them, and a subhead must state its section's point.
 */
export function sourceCard(input: { title: string; source: string; summary: string; excerpt: string; published: number | null; link?: string; fromBrief?: boolean }) {
  const when = input.published ? new Date(input.published).toISOString().slice(0, 10).replace(/-/g, ".") : "огноо тодорхойгүй"
  const quoted = clip(input.excerpt || input.summary, input.fromBrief ? 2000 : 700)
  const source = input.link ? `<a href="${escapeHtml(input.link)}">${escapeHtml(input.source)}</a>` : `<strong>${escapeHtml(input.source)}</strong>`
  // A brief holds a team member's notes on a paywalled story, not the outlet's words.
  const quote = input.fromBrief
    ? `<blockquote>${escapeHtml(quoted)}</blockquote><p>Дээрх нь редакцын товчлол. Бусад эх сурвалж, анхны баримт бичигтэй тулгаад өөрийн өнцгөөр бичнэ.</p>`
    : quoted
      ? `<blockquote>${escapeHtml(quoted)}</blockquote><p>Дээрх хэсэг ${escapeHtml(input.source)}-ийн өөрийн үг. Орчуулж, тоог эхтэй тулгаад эндээс дахин бичнэ.</p>`
      : `<p>Эх сурвалж дээрээс ишлэл ирсэнгүй. Холбоосыг нээгээд эхээс нь бичнэ.</p>`
  return {
    title: clip(input.title, 120),
    dek: clip(input.summary || `${input.source}, ${when}`, 200),
    body: [
      `<p>${source}, ${when}: ${escapeHtml(input.title)}</p>`,
      quote,
      `<p>Редактор бичнэ. Эхний догол мөр мэдээг хэн, юу, хэр хэмжээ, хэзээ гэдгээр нь хэлнэ; хоёроос дөрөв дэх догол мөрөнд яагаад чухлыг тоотой нь. Анхны баримт бичгийг (тайлан, хүснэгт, мэдэгдэл) олж, эх сурвалжийг нэр дээр нь холбоосоор оруулна.</p>`,
      `<p>Монголтой зөвхөн суваг нь нэрлэгдэж, тоогоор хэмжигдэж, материаллаг бол холбоно. Эхэд байхгүй тоо бүү нэм. Төгсгөл дараагийн огноо, шийдвэр эсвэл төсөөллөөр дуусна.</p>`,
    ].join(""),
  }
}
