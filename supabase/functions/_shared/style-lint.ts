/*
 * House style checks from the EZ Article Bot Writing Guide v1.0 (13 Oct 2026),
 * Mode W (a written article): the retired-phrase registry R01 to R15 (Annex A)
 * and the linter rules W01 to W18 (Part 9.1) that need no claim ledger, plus
 * the house spelling decisions of 2026-10-12. The guide supersedes the Style
 * Book v1.0 where they differ (its Annex E). Shared by the admin editor
 * (src/admin/style-lint.ts re-exports this) and the news agent (Deno), so it
 * imports nothing.
 *
 * Nothing here blocks publishing: errors are what the guide says must be fixed,
 * warnings only advise; the editor panel shows both. Where the fix is mechanical, `fix` rewrites the draft:
 * only text is touched, never HTML tags or attributes.
 *
 * Not here, because they need the ledger or typed blocks the site doesn't
 * store yet: W03 (number audit), W05 (required blocks), W06 (inference labels),
 * W18 (must-appear claims). The news agent does a lighter number check itself.
 */

/** The text fields every check reads; ArticleDraft and the agent's briefing both fit. */
export interface StyleDraft {
  title: string
  dek: string
  body: string
  take: string
}

export type StyleSeverity = "error" | "warning"

export interface StyleHit {
  /** Guide rule ID, e.g. "W01" or "R05"; L25+ are house spelling decisions. */
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

/** Text outside «…» quotations, so a quoted speaker may say what the house voice may not. */
const outsideQuotes = (text: string) => text.replace(/«[^»]*»/g, " ")

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

const wordsIn = (text: string) => text.match(/[\p{L}\p{N}-]+/gu)?.length ?? 0

/* Limits from the guide's style/config.json. */
const HEADLINE_MAX_WORDS = 14
const SENTENCE_WARN_WORDS = 45
const PARAGRAPH_WARN_SENTENCES = 6
const SECOND_PERSON_MAX = 2

/*
 * The retired-phrase registry (guide Annex A, style/retired_phrases.json 1.0.0),
 * at its Mode W severity. R01 to R04 are the hosts' decision of 13 Oct 2026;
 * R05 to R09 are spoken devices, errors in written copy; R11 is a warning until
 * the hosts rule on it (decision D2).
 */
const RETIRED: { id: string; find: RegExp; severity: StyleSeverity; message: string; fix?: (text: string) => string; fixLabel?: string }[] = [
  { id: "R01", find: /байна\s+л\s+даа/giu, severity: "error", message: "«байна л даа» хэрэглэхээ больсон. Энгийн «байна» гэж бичнэ." },
  {
    id: "R02",
    find: /энгийнээр\s+ингэж\s+ойлго(?:но|оорой|ох|цгоо)/giu,
    severity: "error",
    message: "«Энгийнээр ингэж ойлгоно» хэрэглэхээ больсон. Тайлбарын эхний алхмаас, «X гэдэг нь …» тодорхойлолтоос эсвэл «Жишээ нь, …»-ээс шууд эхэлнэ.",
  },
  {
    id: "R03",
    find: /(?:яг\s+энэ\s+хэсгийг\s+)?(?:анхааралтай\s+)?сайн\s+(?:анзаар|хар)аарай|анзаараарай/giu,
    severity: "error",
    message: "«Сайн анзаараарай / сайн хараарай» хэрэглэхээ больсон. Санаагаа догол мөрийн эхний богино өгүүлбэр болгоно.",
  },
  { id: "R04", find: /гэвэл\s+энгийнээр/giu, severity: "error", message: "«…вэ гэвэл энгийнээр» хэрэглэхээ больсон. Асуултыг дэд гарчиг болгоод шууд хариулна." },
  { id: "R05", find: word("л\\s+(?:даа|дээ)"), severity: "error", message: "Ярианы сул үг «л даа / л дээ» бичгийн нийтлэлд орохгүй. Хасна." },
  { id: "R06", find: word("шүү\\s+дээ|биз\\s+дээ|биз(?=\\s*[?.!])|дөө"), severity: "error", message: "Ярианы сул үг «шүү дээ», «биз», «дөө» бичгийн нийтлэлд орохгүй. Хасна." },
  { id: "R07", find: /(?:^|[.!?]\s+)(?:Аан|За)\s*,/gmu, severity: "error", message: "Өгүүлбэрийг «Аан,», «За,»-аар эхлүүлэхгүй. Өгүүлэгдэхүүнээс нь эхэлнэ." },
  { id: "R08", find: /\p{L}+(?:цгаая|цгооё|цгээ)(?![\p{L}\p{N}])/giu, severity: "error", message: "«-цгаая / -цгооё» (харцгаая) нь үзэгчид хандсан хэлбэр. «Дараагийн хэсэгт …» гэх юм уу шууд дараагийн хэсгээ эхэлнэ." },
  { id: "R09", find: word("та\\s+бүхэн(?:ий|д|ээ)?|танд\\s+(?:сануулъя|хэлье)"), severity: "error", message: "Уншигчид «та бүхэн» гэж хандахгүй. Хувь хүнгүй, эсвэл «уншигч» гэж бичнэ." },
  { id: "R10", find: word("чи|чиний|чамд|чамайг|чамаас|чамтай|чамаар|чамдаа"), severity: "error", message: "«Чи» гэж хандахгүй. Хувь хүнгүйгээр бичнэ." },
  { id: "R11", find: /шударгаар\s+хэлэх(?:эд|\s+ёстой)|шударга\s+байя/giu, severity: "warning", message: "«Шударгаар хэлэхэд» гэж үнэнч байдлаа зарлахгүй. Хүлээн зөвшөөрөх зүйлээ баримт болгож шууд хэлнэ." },
  {
    id: "R12",
    find: /иэн/giu,
    severity: "error",
    message: "«иэн» биш «иен» гэж бичнэ.",
    fix: (t) => t.replace(/иэн/g, "иен").replace(/Иэн/g, "Иен").replace(/ИЭН/g, "ИЕН"),
    fixLabel: "иен болгох",
  },
  { id: "R13", find: /УЛЭМЖ|Улэмж/gu, severity: "error", message: "Хөтлөгчийн нэрийг «ҮЛЭМЖ» (Үлэмж) гэж бичнэ.", fix: (t) => t.replace(/УЛЭМЖ/g, "ҮЛЭМЖ").replace(/Улэмж/g, "Үлэмж"), fixLabel: "ҮЛЭМЖ болгох" },
  { id: "R14", find: /Би\s+[^.?!]{0,60}судалж\s+эхлэхдээ|гэж\s+бодож\s+байлаа/giu, severity: "error", message: "«Би судалж эхлэхдээ …», «… гэж бодож байлаа» гэх мэт олсон түүхээ биш, дүгнэлтээ шууд хэлнэ." },
  { id: "R15", find: /Энэ\s+бол\s+[^.?!]{1,80}\s+биш\.\s+Энэ\s+бол/giu, severity: "error", message: "«Энэ бол X биш. Энэ бол Y.» хэлбэрээс зайлсхийнэ. Санаагаа нэг өгүүлбэрээр хэлнэ." },
]

/** Editor-curated hype list (style/hype_words.txt, a starter list awaiting review, decision D15). */
const HYPE = word("гайхалтай|цочирдмоор|шоконд оруулсан|түүхэн мөч|тэсрэлт|цунами|нураав|дэлбэрэв|шок", "giu")
const RELATIVE_DATE = word("өнөөдөр|өчигдөр|маргааш|энэ долоо хоногт|энэ сард|саяхан", "giu")
const SECOND_PERSON = word("та|таны|танд|таныг", "giu")
const INVESTMENT = word("алт|алтны|хувьцаа|хувьцааны|крипто|биткойн|хөрөнгө оруулалт|хөрөнгө оруулах|бонд|валютын ханш")
const NO_ADVICE = /зөвлөгөө\s+биш/iu
const MONGOLIA = word("монгол|монголын|монголд|монголыг|төгрөг|төгрөгийн|төгрөгөөр|манай улс|улаанбаатар")
/** Latin tokens that need no gloss (style/latin_allowlist.txt, plus names readers know). */
const LATIN_OK = new Set(["brent", "wti", "opec", "fed", "qe", "etf", "gdp", "imf", "oecd", "usd", "eur", "jpy", "cny", "mnt", "ai", "it", "nvidia", "tsmc", "reuters", "bloomberg", "goldman", "sachs", "covid"])

/** Digit figures, ignoring years, АИ-92 style codes and «5-р сарын 7» dates (as the guide's W03 does). */
function figuresOf(text: string) {
  const cleaned = text
    .replace(/[\p{L}]+-\d+/gu, " ")
    .replace(/(?<!\d)(?:19|20)\d{2}(?!\d)/g, " ")
    .replace(/\d{1,2}-р\s+сар(?:ын)?(?:\s+\d{1,2})?/gu, " ")
  return (cleaned.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []).map((figure) => figure.replace(/,/g, ""))
}

export function lintStyle(draft: StyleDraft): StyleHit[] {
  const hits: StyleHit[] = []
  const body = plain(draft.body)
  const all = [draft.title, draft.dek, body, draft.take].join("\n")
  const voice = outsideQuotes(all)

  // W01 · no em or en dash, anywhere.
  if (/[—–]/.test(all)) {
    hits.push({
      rule: "W01",
      severity: "error",
      message: "Урт зураас (— –) хэрэглэхгүй. Таслал, хоёр цэг, цэг эсвэл «буюу» ашиглана.",
      sample: sampleOf(all, /[—–]/g),
      fix: fixAll((text) => text.replace(/\s*[—–]\s*(\d)/g, "-$1").replace(/\s*[—–]\s*/g, ", ")),
      fixLabel: "Таслалаар солих",
    })
  }

  // W02 · the retired-phrase registry. A quoted speaker may still say these.
  for (const rule of RETIRED) {
    const text = rule.fix ? all : voice
    if (!has(text, rule.find)) continue
    hits.push({
      rule: rule.id,
      severity: rule.severity,
      message: rule.message,
      sample: sampleOf(text, rule.find),
      ...(rule.fix ? { fix: fixAll(rule.fix), fixLabel: rule.fixLabel } : {}),
    })
  }

  // House spelling: Саудын Араб.
  const saudi = /Сауди(?:йн)?\s+Араби(?:а|йн)?|Саудын\s+Араби(?:а)?(?![\p{L}])/giu
  if (has(all, saudi)) {
    hits.push({ rule: "L04", severity: "error", message: "«Саудын Араб» гэж бичнэ.", sample: sampleOf(all, saudi), fix: fixAll((t) => t.replace(saudi, "Саудын Араб")), fixLabel: "Саудын Араб болгох" })
  }

  // W04 · headline: no «!», no all-caps word, a figure must repeat in the dek or body, at most 14 words.
  const title = draft.title.trim()
  if (title.includes("!")) {
    hits.push({ rule: "W04", severity: "error", message: "Гарчигт анхаарлын тэмдэг (!) тавихгүй.", sample: title, fix: <T extends StyleDraft>(d: T): T => ({ ...d, title: d.title.replace(/\s*!+/g, "") }), fixLabel: "! хасах" })
  } else if (/[А-ЯӨҮЁ]{7,}/u.test(title)) {
    hits.push({ rule: "W04", severity: "error", message: "Гарчигт бүхэлдээ том үсгээр бичсэн үг оруулахгүй.", sample: title })
  } else {
    const rest = figuresOf(`${draft.dek} ${body}`)
    const missing = figuresOf(title).filter((figure) => !rest.includes(figure))
    if (missing.length) {
      hits.push({ rule: "W04", severity: "error", message: `Гарчиг дахь тоо (${missing.join(", ")}) товч тайлбар эсвэл үндсэн текстэд давтагдах ёстой.`, sample: title })
    } else if (wordsIn(title) > HEADLINE_MAX_WORDS) {
      hits.push({ rule: "W04", severity: "warning", message: `Гарчиг ${wordsIn(title)} үгтэй. ${HEADLINE_MAX_WORDS}-өөс хэтрүүлэхгүй.`, sample: title })
    }
  }

  // W07 · investment topics carry the no-advice line (an error in the guide; a warning here because the topic is guessed).
  if (has(all, INVESTMENT) && !NO_ADVICE.test(all)) {
    hits.push({ rule: "W07", severity: "warning", message: "Зах зээл, хөрөнгийн сэдэв: «Энэ нь хөрөнгө оруулалтын зөвлөгөө биш.» гэсэн өгүүлбэр оруулна. Худалдан ав, зар, хадгал гэж зөвлөхгүй." })
  }

  // W08 · absolute dates only.
  if (has(voice, RELATIVE_DATE)) {
    hits.push({ rule: "W08", severity: "warning", message: "«Өнөөдөр», «өчигдөр», «саяхан» биш, «2026 оны 10-р сарын 12» гэж тодорхой огноогоор бичнэ.", sample: sampleOf(voice, RELATIVE_DATE) })
  }

  // W09 · the closing part links to Mongolia, or says plainly that no link is established.
  if (body.length > 400 && !has(body.slice(Math.floor(body.length * 0.6)), MONGOLIA)) {
    hits.push({ rule: "W09", severity: "warning", message: "Төгсгөлийн хэсэгт Монголтой холбоно (төгрөг, үнэ, экспорт). Холбоо тогтоогдоогүй бол түүнийгээ шууд хэлнэ." })
  }

  // W10 · Mongolian quotes are «guillemets».
  if (/"[^"]+"/.test(all) || /[“”„]/.test(all)) {
    hits.push({
      rule: "W10",
      severity: "warning",
      message: "Ишлэл, бүтээлийн нэрийг «…» хашилтаар бичнэ.",
      sample: sampleOf(all, /"[^"]+"|[“”„][^“”„]*[“”„]/g),
      fix: fixAll((t) => t.replace(/"([^"]+)"/g, "«$1»").replace(/[“„]([^“”„]*)”/g, "«$1»")),
      fixLabel: "«…» болгох",
    })
  }

  // W11 · «хувь» in running text; % only in headlines and tables.
  if (/\d\s*%/.test(`${draft.dek}\n${body}\n${draft.take}`)) {
    hits.push({
      rule: "W11",
      severity: "warning",
      message: "Үндсэн текстэд «%» биш «хувь» гэж бичнэ. Хувь хэмжээний өөрчлөлтийг «нэгж хувь» гэнэ.",
      sample: sampleOf(body, /\d\s*%/g),
      fix: <T extends StyleDraft>(d: T): T => {
        const swap = (t: string) => t.replace(/(\d)\s*%/g, "$1 хувь")
        return { ...d, dek: swap(d.dek), body: mapText(d.body, swap), take: swap(d.take) }
      },
      fixLabel: "«хувь» болгох",
    })
  }

  // W12 · a Latin term comes after its Mongolian term, in brackets, at first use: «бодит хүү (real yield)».
  const unglossed = new Set<string>()
  const seen = new Set<string>()
  for (const sentence of sentencesOf(outsideQuotes(body))) {
    for (const match of sentence.matchAll(/(?<![A-Za-z./@])[A-Za-z][A-Za-z-]{3,}(?![A-Za-z]|\.[a-z])/g)) {
      const term = match[0]
      const key = term.toLowerCase()
      if (seen.has(key) || LATIN_OK.has(key) || /https?|www/.test(key)) continue
      seen.add(key)
      if (!new RegExp(`\\([^)]*${term}[^)]*\\)`).test(sentence)) unglossed.add(term)
    }
  }
  if (unglossed.size) {
    hits.push({ rule: "W12", severity: "warning", message: `Латин нэр томьёог анх гарахад нь монгол нэрийн дараа хаалтанд бичнэ, жишээ нь «бодит хүү (real yield)»: ${[...unglossed].slice(0, 4).join(", ")}.` })
  }

  // W13 · hype words: show the size with the number, not the adjective.
  if (has(voice, HYPE)) {
    hits.push({ rule: "W13", severity: "warning", message: "Хэт хөөрөгдсөн үг. Үгийг хасаад өгүүлбэр утгаа алдахгүй бол хасна, эс бөгөөс тоо, харьцуулалтаар солино.", sample: sampleOf(voice, HYPE) })
  }

  // W14 · sentences of 15 to 30 words; warn above 45.
  const long = sentencesOf(body).find((sentence) => wordsIn(sentence) > SENTENCE_WARN_WORDS)
  if (long) {
    hits.push({ rule: "W14", severity: "warning", message: `${wordsIn(long)} үгтэй өгүүлбэр байна. ${SENTENCE_WARN_WORDS}-аас урт бол хоёр хуваана.`, sample: `${long.slice(0, 90)}…` })
  }

  // W15 · paragraphs of two to four sentences; warn above six.
  const crowded = paragraphsOf(draft.body).find((paragraph) => sentencesOf(paragraph).length > PARAGRAPH_WARN_SENTENCES)
  if (crowded) {
    hits.push({ rule: "W15", severity: "warning", message: `Догол мөр ${PARAGRAPH_WARN_SENTENCES}-аас олон өгүүлбэртэй. 2-4 өгүүлбэрт хуваана.`, sample: `${crowded.slice(0, 90)}…` })
  }

  // W16 · three-beat punch ending: the last three sentences each five words or fewer.
  const last = sentencesOf(body).slice(-3)
  if (last.length === 3 && last.every((sentence) => wordsIn(sentence) <= 5)) {
    hits.push({ rule: "W16", severity: "warning", message: "Гурван богино өгүүлбэрээр төгсгөхгүй. Нэг тайван, бүтэн өгүүлбэрээр дуусгана.", sample: last.join(" ") })
  }

  // W17 · written copy rarely addresses the reader: at most two «та» forms.
  SECOND_PERSON.lastIndex = 0
  const youCount = (voice.match(SECOND_PERSON) ?? []).length
  if (youCount > SECOND_PERSON_MAX) {
    hits.push({ rule: "W17", severity: "warning", message: `Уншигчид «та» гэж ${youCount} удаа хандсан. Нийтлэлд ${SECOND_PERSON_MAX}-оос ихгүй, ихэнхдээ хувь хүнгүй бичнэ.`, sample: sampleOf(voice, SECOND_PERSON) })
  }

  // House spelling decisions (2026-10-12, matching the guide's defaults D8 and D9): months in digits, Рэй Далио, ОПЕК, Евро-5, Бреттон-Вудс.
  for (const rule of SPELLING) {
    if (!has(all, rule.find)) continue
    hits.push({
      rule: rule.id,
      severity: "warning",
      message: rule.message,
      sample: sampleOf(all, rule.find),
      fix: fixAll((text) => text.replace(rule.find, rule.replace as (substring: string, ...args: string[]) => string)),
      fixLabel: rule.fixLabel,
    })
  }

  return hits
}

const MONTHS = ["нэгдүгээр", "хоёрдугаар", "гуравдугаар", "дөрөвдүгээр", "тавдугаар", "зургаадугаар", "долдугаар", "наймдугаар", "есдүгээр", "аравдугаар"]

const SPELLING: { id: string; find: RegExp; replace: string | ((match: string, ...groups: string[]) => string); message: string; fixLabel: string }[] = [
  {
    id: "L25",
    // "арван нэгдүгээр" before "нэгдүгээр", so the longer name wins.
    find: /(?<![\p{L}])(арван нэгдүгээр|арван хоёрдугаар|нэгдүгээр|хоёрдугаар|гуравдугаар|дөрөвдүгээр|тавдугаар|зургаадугаар|долдугаар|наймдугаар|есдүгээр|аравдугаар)(\s+сар)/giu,
    replace: (_match, name: string, rest: string) => {
      const lower = name.toLowerCase()
      const n = lower === "арван нэгдүгээр" ? 11 : lower === "арван хоёрдугаар" ? 12 : MONTHS.indexOf(lower) + 1
      return `${n}-р${rest}`
    },
    message: "Сарыг тоогоор бичнэ: «10-р сарын 12».",
    fixLabel: "Тоогоор бичих",
  },
  { id: "L26", find: /Рей(\s+Далио)/g, replace: "Рэй$1", message: "«Рэй Далио» гэж бичнэ.", fixLabel: "Рэй болгох" },
  { id: "L27", find: /(?<![A-Za-z])OPEC(?![A-Za-z])/g, replace: "ОПЕК", message: "«ОПЕК» гэж кириллээр бичнэ.", fixLabel: "ОПЕК болгох" },
  { id: "L28", find: /Евро\s+5(?!\d)/g, replace: "Евро-5", message: "«Евро-5» гэж бичнэ.", fixLabel: "Евро-5 болгох" },
  { id: "L29", find: /Бреттон[\s-]+Вүүдс/g, replace: "Бреттон-Вудс", message: "«Бреттон-Вудс» гэж бичнэ.", fixLabel: "Бреттон-Вудс болгох" },
]
