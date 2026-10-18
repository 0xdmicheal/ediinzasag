/*
 * House style checks from the EZ Writing System Complete Guide v2.1 (16 Oct
 * 2026), which replaces the Article Bot Writing Guide v1.0: the banned
 * categories A to P (Part 9), the structure and language rules W01 to W20 that
 * need no claim ledger (Parts 4, 7, 8 and 10), plus the house spelling
 * decisions of 2026-10-12 (SP). Shared by the admin editor
 * (src/admin/style-lint.ts re-exports this) and the news agent (Deno), so it
 * imports nothing.
 *
 * Nothing here blocks publishing: errors are the guide's hard blocks (A, B, E,
 * F, G, H, P and the punctuation rules), warnings its soft blocks; the editor
 * panel shows both. Where the fix is mechanical, `fix` rewrites the draft: only
 * text is touched, never HTML tags or attributes.
 *
 * Not here, because they need the claim ledger, the publish memory or a typed
 * format the site doesn't store yet: figures not in the ledger, word ranges and
 * figure minimums per format, opener and phrase fatigue across pieces, the
 * rubric score. The news agent does a lighter number check itself.
 */

/** The text fields every check reads; ArticleDraft and the agent's briefing both fit. */
export interface StyleDraft {
  title: string
  dek: string
  body: string
  /** The «Цаасан дээр бодвол» box (stored in the old «EZ-ийн дүгнэлт» field). */
  take: string
}

export type StyleSeverity = "error" | "warning"

export interface StyleHit {
  /** Guide rule ID: a Part 9 category letter (A–P), W01–W20, or SP for house spelling. */
  rule: string
  severity: StyleSeverity
  /** What is wrong, in Mongolian. */
  message: string
  /** The offending text, shortened. */
  sample?: string
  /** Mechanical fix for every occurrence, when one exists. */
  fix?: <T extends StyleDraft>(draft: T) => T
  fixLabel?: string
}

const FIELDS: (keyof StyleDraft)[] = ["title", "dek", "body", "take"]

/** Applies `replace` to the text between HTML tags only. */
function mapText(html: string, replace: (text: string) => string) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith("<") ? part : replace(part)))
    .join("")
}

const plain = (html: string) =>
  html
    .replace(/<\/(p|h2|h3|li|blockquote)>/gi, "$&\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .trim()

/** The body's paragraphs as plain text, one per <p> or <li>. */
const paragraphsOf = (html: string) =>
  [...html.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => plain(match[2])).filter(Boolean)

/** Subheads and the paragraphs under each, in order. */
function sectionsOf(html: string) {
  const parts = html.split(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i)
  const sections: { heading: string; paragraphs: string[] }[] = []
  for (let index = 1; index < parts.length; index += 2) sections.push({ heading: plain(parts[index]), paragraphs: paragraphsOf(parts[index + 1] ?? "") })
  return sections
}

function fixAll(replace: (text: string) => string) {
  return <T extends StyleDraft>(draft: T): T => {
    const next = { ...draft }
    for (const field of FIELDS) next[field] = field === "body" ? mapText(draft.body, replace) : replace(draft[field])
    return next
  }
}

/** First match in the article's text, with some context, for display. */
function sampleOf(text: string, pattern: RegExp) {
  pattern.lastIndex = 0
  const match = pattern.exec(text)
  pattern.lastIndex = 0
  if (!match) return undefined
  const start = Math.max(0, match.index - 25)
  return `${start > 0 ? "…" : ""}${text.slice(start, match.index + match[0].length + 25).replace(/\s+/g, " ").trim()}…`
}

/** Whole-word pattern (JS \b doesn't see Cyrillic letters). */
const word = (body: string, flags = "giu") => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, flags)

const has = (text: string, pattern: RegExp) => {
  pattern.lastIndex = 0
  const found = pattern.test(text)
  pattern.lastIndex = 0
  return found
}

const count = (text: string, pattern: RegExp) => {
  pattern.lastIndex = 0
  const found = text.match(pattern)?.length ?? 0
  pattern.lastIndex = 0
  return found
}

/** Text outside «…» quotations, so a quoted speaker may say what the house voice may not. */
const outsideQuotes = (text: string) => text.replace(/«[^»]*»/g, " ")

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

const wordsIn = (text: string) => text.match(/[\p{L}\p{N}-]+/gu)?.length ?? 0

/** The box's arithmetic line («114,000 ÷ 92 ≈ 1,240») may use %, ×, ÷ and signs: it is a formula, not prose. */
const ARITHMETIC = /[÷×≈=]/
const prose = (text: string) =>
  text
    .split("\n")
    .filter((line) => !ARITHMETIC.test(line))
    .join("\n")

/* Limits from the guide (Parts 4, 6, 7 and 8). */
const HEADLINE_MAX_WORDS = 14
const DEK_WORDS = [15, 30] as const
const SENTENCE_MAX_WORDS = 35
const PARAGRAPH_MAX_SENTENCES = 5
const SHORT_PARAGRAPHS_MAX = 2
const SECTION_MIN_PARAGRAPHS = 2
const SECTION_MIN_WORDS = 100
const SUBHEAD_WORDS = [3, 8] as const
const FIGURES_PER_SENTENCE = 3
const VERB_REPEAT_MAX = 2
const BODY_MIN_WORDS = 200

/*
 * The banned list (Part 9), matched on stems so «шударгаар хэлбэл» is caught
 * with «шударгаар хэлэхэд». Hard categories are errors, soft ones warnings.
 * A named speaker inside «» is exempt.
 */
type Banned = { id: string; find: RegExp; severity: StyleSeverity; message: string; fix?: (text: string) => string; fixLabel?: string }

/** Deletes every sentence that contains `pattern`, for blocks the guide removes outright. */
const dropSentence = (pattern: string) => (text: string) => text.replace(new RegExp(`(^|[.!?»]\\s*)[^.!?«»]*${pattern}[^.!?]*[.!?]\\s*`, "giu"), "$1")

const BANNED: Banned[] = [
  // A · spoken particles and tics
  { id: "A", find: /байна\s+л\s+даа/giu, severity: "error", message: "«байна л даа» ярианы хэллэг. Энгийн «байна» гэж бичнэ." },
  { id: "A", find: word("л\\s+(?:даа|дээ)"), severity: "error", message: "Ярианы сул үг «л даа / л дээ» нийтлэлд орохгүй. Хасна." },
  { id: "A", find: word("шүү\\s+дээ|биз\\s+ээ|биз\\s+дээ|биз(?=\\s*[?.!,])|дөө"), severity: "error", message: "Ярианы сул үг «шүү дээ», «биз», «дөө» нийтлэлд орохгүй. Хасна." },
  { id: "A", find: /(?:^|[.!?])\s*(?:Аан|За|Тэгэхээр|Юу\s+вэ\s+гэвэл)\s*,/gmu, severity: "error", message: "Өгүүлбэрийг «За,», «Аан,», «Тэгэхээр,», «Юу вэ гэвэл,»-ээр эхлүүлэхгүй. Өгүүлэгдэхүүнээс эхэлнэ." },
  // B · addressing the reader or the audience
  { id: "B", find: word("та\\s+бүхэн(?:ий|д|ээ)?|танд\\s+(?:сануулъя|хэлье)"), severity: "error", message: "Уншигчид «та бүхэн» гэж хандахгүй. Баримтаа хэлнэ, сонирхолтой эсэхийг уншигч шийднэ." },
  { id: "B", find: word("чи|чиний|чамд|чамайг|чамаас|чамтай|чамаар|чамдаа"), severity: "error", message: "«Чи» гэж хандахгүй. Хувь хүнгүйгээр бичнэ." },
  { id: "B", find: /\p{L}+(?:цгаая|цгооё|цгээе)(?![\p{L}\p{N}])/giu, severity: "error", message: "«-цгаая / -цгооё» (харцгаая, орцгооё) нь видеоны хэллэг. Дараагийн санаагаа шууд эхэлнэ." },
  { id: "B", find: /(?:яг\s+энэ\s+хэсгийг\s+)?(?:анхааралтай\s+)?сайн\s+(?:анзаар|хар)аарай|анзаараарай/giu, severity: "error", message: "«Сайн анзаараарай / сайн хараарай» хэрэглэхгүй. Гол санааг догол мөрийн эхний өгүүлбэр болгоно." },
  // C · announcing instead of saying
  {
    id: "C",
    find: /уг\s+механизмыг\s+тайлбарлавал|энгийнээр\s+ингэж\s+ойлго|гэвэл\s+энгийнээр|товчхоноор\s+хэлбэл|дараах\s+зүйлийг\s+анхаарах|энд\s+сонирхолтой\s+нь|гол\s+асуулт\s+бол/giu,
    severity: "warning",
    message: "Тайлбарлана гэж зарлаж байна. Зарлалгүйгээр тайлбараа шууд эхэлнэ.",
  },
  // D · hedge stacks («гэж ойлгож болно» more than once is checked below)
  { id: "D", find: /гэж\s+хэлж\s+болох\s+юм|байж\s+магадгүй\s+байх|байх\s+боломжтой\s+юм\s+шиг/giu, severity: "warning", message: "Давхар таамаг. Баталгаатай баримтыг шууд хэлнэ, жинхэнэ тодорхойгүй бол нэг л таамаг үг эх сурвалжтайгаа." },
  // E · performed sincerity
  {
    id: "E",
    find: /шударгаар\s+хэл(?:эх|бэл)|шударга\s+байя|үнэнийг\s+хэл(?:эх|бэл)|нуух\s+юу\s+байхав|ил\s+тод\s+хэл(?:эх|бэл)|(?:^|[.!?])\s*Мэдээж(?![\p{L}])/gimu,
    severity: "error",
    message: "«Шударгаар хэлэхэд», «Үнэнийг хэлэхэд», эхэнд нь «Мэдээж» гэж үнэнч байдлаа зарлахгүй. Хасахад өгүүлбэр бүтэн хэвээр үлдэнэ.",
  },
  // F · confessing source limits
  {
    id: "F",
    find: /эх\s+сурвалж(?:ид|уудад|ууд)?\s+(?:зөвхөн|дурдаагүй|тодорхой\s+заагаагүй)|мэдээлэл\s+(?:алга|байхгүй\s+байна)|бид\s+мэдэхгүй|баталгаажуулах\s+боломжгүй|тоо\s+гараагүй\s+байна/giu,
    severity: "error",
    message: "Эх сурвалжид юу дутсаныг нийтлэлд хэлэхгүй. Анхны баримт бичгээс хайна; олдохгүй бол тэр санааг хасаад редакторт тэмдэглэнэ.",
  },
  { id: "F", find: word("тодорхой\\s+бус"), severity: "warning", message: "«Тодорхой бус» нь өөрсдийн судалгааны дутууг хэлж байгаа бол хасна. Эх сурвалж өөрөө задлаагүй нь мэдээ бол түүнийг нэрлэнэ: «Rio Tinto зардлын дүнг задлаагүй»." },
  // G · forced Mongolia bridges (a «Монголд ямар хамаатай вэ» heading is W12)
  {
    id: "G",
    find: /нэгэнт[^.!?]{0,80}ярьсных|монголтой\s+холбох\s+хэрэгтэй|монголд\s+нөлөөлөх\s+суваг|монгол\s+уул\s+уурхай,?\s+экспортоороо\s+ялгагдана/giu,
    severity: "error",
    message: "Албадан Монголтой холбож байна. Суваг нь нэрлэгдэж, сүүлийн 12 сарын тоогоор хэмжигдэж, материаллаг (экспорт, төсөв, нөөцийн 5+ хувь) байвал л нэг догол мөр. Үгүй бол Монголын тухай юу ч бичихгүй.",
  },
  // H · disclaimers and tool labels
  {
    id: "H",
    find: /(?:санхүүгийн|хөрөнгө\s+оруулалтын)\s+зөвлөгөө\s+биш/giu,
    severity: "error",
    message: "Зөвлөгөө биш гэсэн анхааруулга нийтлэлд бичихгүй. Нийтлэл худалдан ав, зар, хадгал гэж зөвлөдөггүй тул хэрэггүй.",
    fix: dropSentence("зөвлөгөө\\s+биш"),
    fixLabel: "Өгүүлбэрийг хасах",
  },
  {
    id: "H",
    find: /нийтийн\s+мэдэгдэл,?\s+тоймыг\s+нэгтгэсэн|(?:AI|хиймэл\s+оюун)[\p{L}\s-]{0,20}(?:бичсэн|бэлтгэсэн|үүсгэсэн)/giu,
    severity: "error",
    message: "Нэгтгэсэн, хиймэл оюунаар бичсэн гэх тэмдэглэл нийтлэлд орохгүй. Нийтлэл «EZ редакц» нэрээр гарна.",
  },
  // I · reader-question setups
  {
    id: "I",
    find: /энэ\s+яагаад\s+чухал\s+вэ\s*\?|тэгвэл\s+яах\s+вэ\s*\?|харин\s+одоо\s+юу\s+болох\s+вэ\s*\?/giu,
    severity: "warning",
    message: "Асуулт тавьж хариулах нь видеоны арга. Хариултыг өгүүлбэрээр шууд хэлнэ.",
  },
  // J · aphorisms, morals and triplets
  { id: "J", find: /Энэ\s+бол\s+[^.?!]{1,80}\s+биш\.\s+Энэ\s+бол/giu, severity: "warning", message: "«Энэ бол X биш. Энэ бол Y.» хэлбэр. Санаагаа тоотой, нэг тодорхой өгүүлбэрээр хэлнэ." },
  { id: "J", find: /өрхийн\s+хувьд[^]{0,300}төсвийн\s+хувьд[^]{0,300}бодлогын\s+хувьд/giu, severity: "warning", message: "«Өрхийн хувьд… Төсвийн хувьд… Бодлогын хувьд…» гурвал. Нэг тодорхой нөлөөг тоотой нь хэлнэ." },
  // K · calques and clichés
  {
    id: "K",
    find: word("зүй\\s+тогтолтой\\s+холбоотой|томоохон\\s+алхам|түүхэн\\s+шийдвэр|эргэлтийн\\s+цэг|анхаарлын\\s+төвд\\s+(?:байна|байгаа)|чухал\\s+ач\\s+холбогдолтой"),
    severity: "warning",
    message: "Хоосон эсвэл англиас орчуулсан хэллэг. Юу болсон, хэр том болохыг тоо, эх сурвалжтай нь хэлнэ.",
  },
  // L · vague comparisons and relative dates
  { id: "L", find: word("өнөөдөр|өчигдөр|маргааш|энэ\\s+долоо\\s+хоногт|энэ\\s+сард|саяхан|сүүлийн\\s+үед"), severity: "warning", message: "Харьцангуй огноо. Нийтлэл олон жил онлайн байх тул «2026 оны 10-р сарын 13-нд» гэж тодорхой бичнэ." },
  // M · self-referential bases
  { id: "M", find: /бидний\s+бичсэн|өмнөх\s+нийтлэлдээ|өмнө\s+бичсэнчлэн/giu, severity: "warning", message: "Өөрийн нийтлэлийг суурь болгохгүй. Зах зээлийн өмнөх хаалт эсвэл албан ёсны өмнөх тоог огноотой нь өгнө." },
]

/** Hype words (Part 7 headline rule and category K): show the size with the number. */
const HYPE = word("гайхалтай|цочирдмоор|шоконд оруулсан|түүхэн мөч|тэсрэлт|цунами|нураав|дэлбэрэв|шок")
/** Vague size words (category L) are fine only beside a figure. */
const VAGUE = word("ихээхэн|нэлээд|огцом")
/** Hearsay particles (Part 8): name the source instead. «аж» only as a sentence-final particle, never «аж үйлдвэр». */
const HEARSAY = /(?<![\p{L}\p{N}])(?:гэнэ|аж)(?=\s*[.!?,])|»\s*гэх(?![\p{L}])/giu
/** Retired label headings (Part 4) and the blocks they introduced (G, P). */
const LABEL_HEADING = /^(?:юу\s+болов|яагаад\s+чухал\s+вэ|монголд\s+ямар\s+хамаатай\s+вэ|юуг\s+ажиглах\s+вэ|ez-ийн\s+дүгнэлт|дүгнэлт|тойм|товчхон|эх\s+сурвалж(?:ууд)?)\??$/iu
/** Reporting verbs to rotate (Part 8), by stem. */
const VERBS: [string, RegExp][] = [
  ["мэдээлэв", word("мэдээл(?:эв|лээ|жээ|сэн)")],
  ["нийтэллээ", word("нийтэл(?:лээ|жээ|эв|сэн)")],
  ["тооцжээ", word("тооц(?:жээ|ов|лоо|сон)")],
  ["төсөөлсөн", word("төсөөл(?:сөн|жээ|лөө|өв)")],
  ["анхааруулжээ", word("анхааруул(?:жээ|лаа|ав|сан)")],
  ["мэдэгдэв", word("мэдэгд(?:эв|лээ|жээ|сэн)")],
  ["зарлав", word("зарл(?:ав|лаа|жээ|сан)")],
  ["гэв", word("гэв|гэлээ|гэжээ")],
]
/** Latin tokens that need no gloss (style/latin_allowlist.txt, plus names readers know). */
const LATIN_OK = new Set(["brent", "wti", "opec", "fed", "qe", "etf", "gdp", "imf", "oecd", "usd", "eur", "jpy", "cny", "mnt", "ai", "it", "nvidia", "tsmc", "reuters", "bloomberg", "goldman", "sachs", "covid", "rio", "tinto", "comex", "lme"])

/** Digit figures, ignoring years, АИ-92 style codes and «5-р сарын 7» dates. */
function figuresOf(text: string) {
  const cleaned = text
    .replace(/[\p{L}]+-\d+/gu, " ")
    .replace(/(?<!\d)(?:19|20)\d{2}(?!\d)/g, " ")
    .replace(/\d{1,2}-р\s+сар(?:ын)?(?:\s+\d{1,2})?(?:-[\p{L}]+)?/gu, " ")
  return (cleaned.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []).map((figure) => figure.replace(/,/g, ""))
}

export function lintStyle(draft: StyleDraft): StyleHit[] {
  const hits: StyleHit[] = []
  const body = plain(draft.body)
  const box = prose(draft.take)
  const all = [draft.title, draft.dek, body, draft.take].join("\n")
  const voice = outsideQuotes([draft.title, draft.dek, body, box].join("\n"))
  const running = outsideQuotes([draft.dek, body, box].join("\n"))
  const sentences = sentencesOf(outsideQuotes(body))

  // W01 · no em or en dash, anywhere (Part 8).
  if (/[—–]/.test(all)) {
    hits.push({
      rule: "W01",
      severity: "error",
      message: "Урт зураас (— –) хэрэглэхгүй. Таслал, хоёр цэг эсвэл шинэ өгүүлбэр ашиглана.",
      sample: sampleOf(all, /[—–]/g),
      fix: fixAll((text) => text.replace(/\s*[—–]\s*(\d)/g, "-$1").replace(/\s*[—–]\s*/g, ", ")),
      fixLabel: "Таслалаар солих",
    })
  }

  // A to M · the banned list. A quoted speaker may still say these.
  for (const rule of BANNED) {
    if (!has(voice, rule.find)) continue
    hits.push({
      rule: rule.id,
      severity: rule.severity,
      message: rule.message,
      sample: sampleOf(voice, rule.find),
      ...(rule.fix ? { fix: fixAll(rule.fix), fixLabel: rule.fixLabel } : {}),
    })
  }

  // D · «гэж ойлгож болно» at most once per piece.
  const understood = /гэж\s+ойлгож\s+болно/giu
  if (count(voice, understood) > 1) {
    hits.push({ rule: "D", severity: "warning", message: "«гэж ойлгож болно» нэг нийтлэлд нэгээс илүүгүй. Баримтыг шууд хэлнэ: «… холбоотой.»", sample: sampleOf(voice, understood) })
  }

  // K · hype words.
  if (has(voice, HYPE)) {
    hits.push({ rule: "K", severity: "warning", message: "Хэт хөөрөгдсөн үг. Хэмжээг тоо, харьцуулалтаар харуулна.", sample: sampleOf(voice, HYPE) })
  }

  // L · «ихээхэн», «нэлээд», «огцом» in a sentence with no figure.
  const vague = sentences.find((sentence) => has(sentence, VAGUE) && !/\d/.test(sentence))
  if (vague) {
    hits.push({ rule: "L", severity: "warning", message: "«Ихээхэн», «нэлээд», «огцом» тоогүйгээр бичигдсэн. Тэмдэг нэрийг тоогоор солино: «гурван сард 27 хувиар өссөн».", sample: `${vague.slice(0, 90)}…` })
  }

  // N · «хувь» in running text; % only in headlines and tables (and the box's arithmetic line).
  if (/\d\s*%/.test(running)) {
    hits.push({
      rule: "N",
      severity: "warning",
      message: "Үндсэн текстэд «%» биш «хувь» гэж бичнэ. Хүүгийн өөрчлөлтийг «нэгж хувь» гэнэ.",
      sample: sampleOf(running, /\d\s*%/g),
      fix: <T extends StyleDraft>(d: T): T => {
        const swap = (t: string) => t.replace(/(\d)\s*%/g, "$1 хувь")
        const swapProse = (t: string) => t.split("\n").map((line) => (ARITHMETIC.test(line) ? line : swap(line))).join("\n")
        return { ...d, dek: swap(d.dek), body: mapText(d.body, swap), take: swapProse(d.take) }
      },
      fixLabel: "«хувь» болгох",
    })
  }

  // N · no + or − signs in prose: «27 хувиар өсөв», «29 хувиар буурсан».
  const signs = /(?:^|[\s(])[+−-]\d/gmu
  if (has(running, signs)) {
    hits.push({ rule: "N", severity: "error", message: "Үндсэн текстэд + − тэмдэг бичихгүй. «27 хувиар өсөв», «29 хувиар буурсан» гэж үйл үгээр бичнэ.", sample: sampleOf(running, signs) })
  }

  // N · a figure with no verb around it is a fragment, not a sentence («Ажилгүйдэл 4.2 хувь.»).
  const fragment = sentences.find((sentence) => /\d/.test(sentence) && wordsIn(sentence) <= 4)
  if (fragment) {
    hits.push({ rule: "N", severity: "warning", message: "Тоо үйл үггүй, хэсэг өгүүлбэрт байна. Тоог бүтэн өгүүлбэрт оруулна.", sample: fragment })
  }

  // W19 · at most three figures per sentence.
  const crowdedNumbers = sentences.find((sentence) => figuresOf(sentence).length > FIGURES_PER_SENTENCE)
  if (crowdedNumbers) {
    hits.push({ rule: "W19", severity: "warning", message: `Нэг өгүүлбэрт ${FIGURES_PER_SENTENCE}-аас олон тоо. Хоёр өгүүлбэрт хуваана.`, sample: `${crowdedNumbers.slice(0, 90)}…` })
  }

  // W02 · headline: no «!», no all-caps word, at most 14 words, a figure must repeat in the dek or body.
  const title = draft.title.trim()
  if (title.includes("!")) {
    hits.push({ rule: "W02", severity: "error", message: "Гарчигт анхаарлын тэмдэг (!) тавихгүй.", sample: title, fix: <T extends StyleDraft>(d: T): T => ({ ...d, title: d.title.replace(/\s*!+/g, "") }), fixLabel: "! хасах" })
  } else if (/[А-ЯӨҮЁ]{7,}/u.test(title)) {
    hits.push({ rule: "W02", severity: "error", message: "Гарчигт бүхэлдээ том үсгээр бичсэн үг оруулахгүй.", sample: title })
  } else {
    const rest = figuresOf(`${draft.dek} ${body}`)
    const missing = figuresOf(title).filter((figure) => !rest.includes(figure))
    if (missing.length) {
      hits.push({ rule: "W02", severity: "error", message: `Гарчиг дахь тоо (${missing.join(", ")}) үндсэн текстэд давтагдах ёстой.`, sample: title })
    } else if (wordsIn(title) > HEADLINE_MAX_WORDS) {
      hits.push({ rule: "W02", severity: "warning", message: `Гарчиг ${wordsIn(title)} үгтэй. ${HEADLINE_MAX_WORDS}-өөс хэтрүүлэхгүй.`, sample: title })
    }
  }

  // W03 · the dek is one sentence of 15 to 30 words and never repeats the headline's figure.
  const dek = draft.dek.trim()
  if (dek) {
    const dekWords = wordsIn(dek)
    const repeated = figuresOf(title).filter((figure) => figuresOf(dek).includes(figure))
    if (dekWords < DEK_WORDS[0] || dekWords > DEK_WORDS[1]) {
      hits.push({ rule: "W03", severity: "warning", message: `Товч тайлбар ${dekWords} үгтэй. ${DEK_WORDS[0]}-${DEK_WORDS[1]} үгтэй нэг өгүүлбэр байна.`, sample: dek })
    } else if (repeated.length) {
      hits.push({ rule: "W03", severity: "warning", message: `Товч тайлбар гарчгийн тоог (${repeated.join(", ")}) давтаж байна. Хоёр дахь чухал баримтаа өгнө.`, sample: dek })
    }
  }

  // W04 · Mongolian quotes are «guillemets».
  if (/"[^"]+"/.test(all) || /[“”„]/.test(all)) {
    hits.push({
      rule: "W04",
      severity: "warning",
      message: "Ишлэл, бүтээлийн нэрийг «…» хашилтаар бичнэ.",
      sample: sampleOf(all, /"[^"]+"|[“”„][^“”„]*[“”„]/g),
      fix: fixAll((t) => t.replace(/"([^"]+)"/g, "«$1»").replace(/[“„]([^“”„]*)”/g, "«$1»")),
      fixLabel: "«…» болгох",
    })
  }

  // W05 · no exclamation marks, ellipsis or emoji in the body (Part 8 punctuation).
  const marks = /[!…]|\.{3}|\p{Extended_Pictographic}/gu
  if (has(running, marks)) {
    hits.push({ rule: "W05", severity: "error", message: "Үндсэн текстэд анхаарлын тэмдэг, гурван цэг, эможи хэрэглэхгүй.", sample: sampleOf(running, marks) })
  }

  // W06 · hearsay particles: name the source instead.
  const quoted = [draft.dek, body, box].join("\n")
  if (has(quoted, HEARSAY)) {
    hits.push({ rule: "W06", severity: "warning", message: "«гэнэ», «аж», «… гэх» гэж дам яриа болгохгүй. Хэн мэдээлснийг нэрлэнэ.", sample: sampleOf(quoted, HEARSAY) })
  }

  // W07 · a Latin term comes after its Mongolian term, in brackets, at first use: «бодит хүү (real yield)».
  const unglossed = new Set<string>()
  const seen = new Set<string>()
  for (const sentence of sentences) {
    for (const match of sentence.matchAll(/(?<![A-Za-z./@])[A-Za-z][A-Za-z-]{3,}(?![A-Za-z]|\.[a-z])/g)) {
      const term = match[0].replace(/-+$/, "")
      const key = term.toLowerCase()
      if (seen.has(key) || LATIN_OK.has(key) || /https?|www/.test(key)) continue
      seen.add(key)
      if (!new RegExp(`\\([^)]*${term}[^)]*\\)`).test(sentence) && !new RegExp(`${term}-`).test(sentence)) unglossed.add(term)
    }
  }
  if (unglossed.size) {
    hits.push({ rule: "W07", severity: "warning", message: `Латин нэр томьёог анх гарахад нь монгол нэрийн дараа хаалтанд бичиж, энгийн үгээр тайлбарлана, жишээ нь «бодит хүү (real yield)»: ${[...unglossed].slice(0, 4).join(", ")}.` })
  }

  // W08 · sentences 15 to 25 words; split anything above 35.
  const long = sentences.find((sentence) => wordsIn(sentence) > SENTENCE_MAX_WORDS)
  if (long) {
    hits.push({ rule: "W08", severity: "warning", message: `${wordsIn(long)} үгтэй өгүүлбэр. ${SENTENCE_MAX_WORDS}-аас урт бол хоёр хуваана.`, sample: `${long.slice(0, 90)}…` })
  }

  // W09 · paragraphs of three to five sentences; one-sentence paragraphs at most twice.
  const paragraphs = paragraphsOf(draft.body)
  const crowded = paragraphs.find((paragraph) => sentencesOf(paragraph).length > PARAGRAPH_MAX_SENTENCES)
  if (crowded) {
    hits.push({ rule: "W09", severity: "warning", message: `Догол мөр ${PARAGRAPH_MAX_SENTENCES}-аас олон өгүүлбэртэй. Нэг догол мөр нэг санаа, 3-5 өгүүлбэр.`, sample: `${crowded.slice(0, 90)}…` })
  }
  const single = paragraphs.filter((paragraph) => sentencesOf(paragraph).length === 1)
  if (single.length > SHORT_PARAGRAPHS_MAX) {
    hits.push({ rule: "W09", severity: "warning", message: `Нэг өгүүлбэртэй ${single.length} догол мөр. Эхний догол мөр эсвэл нэг огцом эргэлтээс бусдыг 3-5 өгүүлбэр болгоно.`, sample: `${single[0].slice(0, 90)}…` })
  }

  // W10 · never three very short sentences in a row.
  const shortRun = sentences.findIndex((_, index) => sentences.slice(index, index + 3).length === 3 && sentences.slice(index, index + 3).every((sentence) => wordsIn(sentence) <= 6))
  if (shortRun >= 0) {
    hits.push({ rule: "W10", severity: "warning", message: "Дараалсан гурван богино өгүүлбэр. Урт, богино өгүүлбэрийг ээлжилнэ.", sample: sentences.slice(shortRun, shortRun + 3).join(" ") })
  }

  // W11 · the ending looks forward with a fact, so the last paragraph carries a figure or a date.
  const lastParagraph = paragraphs.at(-1)
  if (lastParagraph && paragraphs.length > 2 && !/\d/.test(lastParagraph)) {
    hits.push({ rule: "W11", severity: "warning", message: "Төгсгөл тоо, огноогүй. Дараагийн шийдвэр, огноо, төсөөлөл эсвэл эсрэг байр суурийн гол санаагаар төгсгөнө; хураангуй, сургамжаар биш.", sample: `${lastParagraph.slice(0, 90)}…` })
  }

  // W12 · subheads say something: retired label headings, questions, three to eight words.
  const sections = sectionsOf(draft.body)
  const labels = sections.filter((section) => LABEL_HEADING.test(section.heading.trim()))
  if (labels.length) {
    hits.push({
      rule: "W12",
      severity: "error",
      message: `Ерөнхий шошго гарчиг (${labels.map((section) => `«${section.heading}»`).join(", ")}). Дэд гарчиг тухайн хэсгийн гол санааг хэлнэ: «Rio-гийн зэсийн тал хувь Монголоос».`,
    })
  }
  const odd = sections.find((section) => !LABEL_HEADING.test(section.heading.trim()) && (section.heading.includes("?") || wordsIn(section.heading) < SUBHEAD_WORDS[0] || wordsIn(section.heading) > SUBHEAD_WORDS[1]))
  if (odd) {
    hits.push({ rule: "W12", severity: "warning", message: `Дэд гарчиг ${SUBHEAD_WORDS[0]}-${SUBHEAD_WORDS[1]} үгтэй, асуултын тэмдэггүй, хэсгийн санааг хэлсэн өгүүлбэр байна.`, sample: odd.heading })
  }

  // W13 · each section under a subhead has at least two full paragraphs and 100 words.
  const thin = sections.filter((section) => section.paragraphs.length < SECTION_MIN_PARAGRAPHS || wordsIn(section.paragraphs.join(" ")) < SECTION_MIN_WORDS)
  if (thin.length) {
    hits.push({
      rule: "W13",
      severity: "warning",
      message: `Дэд гарчгийн доорх хэсэг ${SECTION_MIN_PARAGRAPHS}+ догол мөр, ${SECTION_MIN_WORDS}+ үг байна. Хүрэхгүй бол хөрш хэсэгтэй нь нийлүүлж, дэд гарчгийг хасна.`,
      sample: thin.map((section) => section.heading).join(", "),
    })
  }

  // W14 · sources are inline links, never a list, a bare URL or a footnote (Part 10).
  const bareUrl = /https?:\/\/\S+|www\.\S+/giu
  if (has(running, bareUrl)) {
    hits.push({ rule: "W14", severity: "error", message: "Текстэд бүтэн холбоос бичихгүй. Холбоосыг эх сурвалжийн нэр эсвэл баримтыг илэрхийлсэн үгс дээр тавина.", sample: sampleOf(running, bareUrl) })
  }
  const lazyLink = /<a\b[^>]*>\s*(?:энд|энэ\s+линк|энэ\s+холбоос|линк|холбоос)\s*<\/a>/giu
  if (has(draft.body, lazyLink)) {
    hits.push({ rule: "W14", severity: "warning", message: "Холбоосыг «энд», «энэ линк» дээр биш, эх сурвалжийн нэр эсвэл баримт дээр тавина.", sample: sampleOf(plain(draft.body), /энд|энэ\s+линк|холбоос/giu) })
  }

  // W15 · the same reporting verb at most twice per piece.
  const overused = VERBS.map(([label, find]) => [label, count(running, find)] as const).find(([, used]) => used > VERB_REPEAT_MAX)
  if (overused) {
    hits.push({ rule: "W15", severity: "warning", message: `«${overused[0]}» үйл үг ${overused[1]} удаа. Нэг үйл үгийг 2-оос илүү давтахгүй: мэдээлэв, нийтэллээ, тооцжээ, төсөөлсөн, анхааруулжээ, мэдэгдэв, зарлав.` })
  }

  // W16 · the body has at least 200 words, the shortest format (Мэдээ).
  const bodyWords = wordsIn(body)
  if (bodyWords > 0 && bodyWords < BODY_MIN_WORDS) {
    hits.push({ rule: "W16", severity: "warning", message: `Үндсэн текст ${bodyWords} үгтэй. Хамгийн богино формат (Мэдээ) 200-350 үг; Мэдээ ба тайлбар 500-900 үг.` })
  }

  // W17 · a colon only for a list or an explanation, at most one per paragraph.
  const colons = paragraphs.find((paragraph) => (outsideQuotes(paragraph).match(/:(?!\/\/)/g) ?? []).length > 1)
  if (colons) {
    hits.push({ rule: "W17", severity: "warning", message: "Нэг догол мөрөнд нэгээс олон хоёр цэг. Жагсаалт эсвэл тайлбарт л хэрэглэнэ.", sample: `${colons.slice(0, 90)}…` })
  }

  // House spelling: Саудын Араб.
  const saudi = /Сауди(?:йн)?\s+Араби(?:а|йн)?|Саудын\s+Араби(?:а)?(?![\p{L}])/giu
  if (has(all, saudi)) {
    hits.push({ rule: "SP04", severity: "error", message: "«Саудын Араб» гэж бичнэ.", sample: sampleOf(all, saudi), fix: fixAll((t) => t.replace(saudi, "Саудын Араб")), fixLabel: "Саудын Араб болгох" })
  }

  // House spelling decisions (2026-10-12): иен, ҮЛЭМЖ, months in digits, Рэй Далио, ОПЕК, Евро-5, Бреттон-Вудс.
  for (const rule of SPELLING) {
    if (!has(all, rule.find)) continue
    hits.push({
      rule: rule.id,
      severity: rule.severity ?? "warning",
      message: rule.message,
      sample: sampleOf(all, rule.find),
      fix: fixAll((text) => text.replace(rule.find, rule.replace as (substring: string, ...args: string[]) => string)),
      fixLabel: rule.fixLabel,
    })
  }

  return hits
}

const MONTHS = ["нэгдүгээр", "хоёрдугаар", "гуравдугаар", "дөрөвдүгээр", "тавдугаар", "зургаадугаар", "долдугаар", "наймдугаар", "есдүгээр", "аравдугаар"]

const SPELLING: { id: string; find: RegExp; replace: string | ((match: string, ...groups: string[]) => string); message: string; fixLabel: string; severity?: StyleSeverity }[] = [
  { id: "SP12", find: /иэн/gu, replace: "иен", message: "«иэн» биш «иен» гэж бичнэ.", fixLabel: "иен болгох", severity: "error" },
  { id: "SP13", find: /УЛЭМЖ/gu, replace: "ҮЛЭМЖ", message: "Хөтлөгчийн нэрийг «ҮЛЭМЖ» гэж бичнэ.", fixLabel: "ҮЛЭМЖ болгох", severity: "error" },
  {
    id: "SP25",
    // "арван нэгдүгээр" before "нэгдүгээр", so the longer name wins. Quarters («гуравдугаар улирал») are not months.
    find: /(?<![\p{L}])(арван нэгдүгээр|арван хоёрдугаар|нэгдүгээр|хоёрдугаар|гуравдугаар|дөрөвдүгээр|тавдугаар|зургаадугаар|долдугаар|наймдугаар|есдүгээр|аравдугаар)(\s+сар)/giu,
    replace: (_match, name: string, rest: string) => {
      const lower = name.toLowerCase()
      const n = lower === "арван нэгдүгээр" ? 11 : lower === "арван хоёрдугаар" ? 12 : MONTHS.indexOf(lower) + 1
      return `${n}-р${rest}`
    },
    message: "Сарыг тоогоор бичнэ: «10-р сарын 12».",
    fixLabel: "Тоогоор бичих",
  },
  { id: "SP26", find: /Рей(\s+Далио)/g, replace: "Рэй$1", message: "«Рэй Далио» гэж бичнэ.", fixLabel: "Рэй болгох" },
  { id: "SP27", find: /(?<![A-Za-z])OPEC(?![A-Za-z])/g, replace: "ОПЕК", message: "«ОПЕК» гэж кириллээр бичнэ.", fixLabel: "ОПЕК болгох" },
  { id: "SP28", find: /Евро\s+5(?!\d)/g, replace: "Евро-5", message: "«Евро-5» гэж бичнэ.", fixLabel: "Евро-5 болгох" },
  { id: "SP29", find: /Бреттон[\s-]+Вүүдс/g, replace: "Бреттон-Вудс", message: "«Бреттон-Вудс» гэж бичнэ.", fixLabel: "Бреттон-Вудс болгох" },
]
