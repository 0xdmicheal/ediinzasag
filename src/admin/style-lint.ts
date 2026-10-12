import type { ArticleDraft } from "@/admin/types"

/*
 * House style checks from the EZ Mongolian Writing Style Book v1.0 (Annex A).
 * Errors block publishing (they go into readiness() as one required check);
 * warnings only advise. Where the fix is mechanical, `fix` rewrites the draft:
 * only text is touched, never HTML tags or attributes.
 *
 * Rules that need a person's judgement (hedging, evidentials, metaphors) are
 * left to the editor; see the vault's "Style Book" notes.
 */

export type StyleSeverity = "error" | "warning"

export interface StyleHit {
  /** Style book lint ID, e.g. "L01". */
  rule: string
  severity: StyleSeverity
  /** What is wrong, in Mongolian. */
  message: string
  /** The offending text, shortened. */
  sample?: string
  /** Mechanical fix for every occurrence, when one exists. */
  fix?: (draft: ArticleDraft) => ArticleDraft
  fixLabel?: string
}

type TextField = "title" | "dek" | "body" | "take"
const FIELDS: TextField[] = ["title", "dek", "body", "take"]

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

function fixAll(replace: (text: string) => string) {
  return (draft: ArticleDraft): ArticleDraft => {
    const next = { ...draft }
    for (const field of FIELDS) next[field] = field === "body" ? mapText(draft.body, replace) : replace(draft[field])
    return next
  }
}

/** First match in the article's text, with some context, for display. */
function sampleOf(text: string, pattern: RegExp) {
  const match = pattern.exec(text)
  pattern.lastIndex = 0
  if (!match) return undefined
  const start = Math.max(0, match.index - 25)
  return `${start > 0 ? "…" : ""}${text.slice(start, match.index + match[0].length + 25).replace(/\s+/g, " ").trim()}…`
}

/** Whole-word pattern; non-global by default so .test() keeps no state between calls. */
const word = (body: string, flags = "iu") => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, flags)

/** Text outside «…» quotations, so a quoted speaker may say what the house voice may not. */
const outsideQuotes = (text: string) => text.replace(/«[^»]*»/g, " ")

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

const INVESTMENT = word("алт|алтны|хувьцаа|хувьцааны|крипто|биткойн|хөрөнгө оруулалт|хөрөнгө оруулах|бонд|валютын ханш")
const NO_ADVICE = /зөвлөгөө биш/i
const MONGOLIA = word("монгол|монголын|монголд|монголыг|төгрөг|төгрөгийн|төгрөгөөр|манай улс|улаанбаатар")
/** Latin names and acronyms readers know; everything else lowercase in Latin wants a «буюу» gloss. */
const LATIN_OK = new Set(["brent", "wti", "fed", "imf", "opec", "nvidia", "tsmc", "reuters", "bloomberg", "goldman", "sachs", "covid"])

export function lintStyle(draft: ArticleDraft): StyleHit[] {
  const hits: StyleHit[] = []
  const all = [draft.title, draft.dek, plain(draft.body), draft.take].join("\n")
  const body = plain(draft.body)

  // L01 · no em or en dash, anywhere.
  if (/[—–]/.test(all)) {
    hits.push({
      rule: "L01",
      severity: "error",
      message: "Урт зураас (— –) хэрэглэхгүй. Таслал, цэг, хоёр цэг эсвэл «буюу» ашиглана.",
      sample: sampleOf(all, /[—–]/g),
      fix: fixAll((text) => text.replace(/\s*[—–]\s*(\d)/g, "-$1").replace(/\s*[—–]\s*/g, ", ")),
      fixLabel: "Таслалаар солих",
    })
  }

  // L02 · the reader is та / та бүхэн, never чи (a quoted speaker may still say it).
  const chi = word("чи|чиний|чамд|чамайг|чамаас|чамтай|чамаар|чамдаа")
  if (chi.test(outsideQuotes(all))) {
    hits.push({
      rule: "L02",
      severity: "error",
      message: "Уншигчид «чи» гэж хандахгүй. «Та», «та бүхэн» гэж бичнэ.",
      sample: sampleOf(outsideQuotes(all), chi),
    })
  }

  // L03 · иен, never иэн, including inflected forms (иэний, иэнээр…).
  if (/иэн/i.test(all)) {
    hits.push({
      rule: "L03",
      severity: "error",
      message: "«иэн» биш «иен» гэж бичнэ.",
      sample: sampleOf(all, /иэн/gi),
      fix: fixAll((t) => t.replace(/иэн/g, "иен").replace(/Иэн/g, "Иен").replace(/ИЭН/g, "ИЕН")),
      fixLabel: "иен болгох",
    })
  }

  // L04 · Саудын Араб.
  const saudi = /Сауди(?:йн)?\s+Араби(?:а|йн)?|Саудын\s+Араби(?:а)?(?![\p{L}])/giu
  if (saudi.test(all)) {
    saudi.lastIndex = 0
    hits.push({ rule: "L04", severity: "error", message: "«Саудын Араб» гэж бичнэ.", sample: sampleOf(all, saudi), fix: fixAll((t) => t.replace(saudi, "Саудын Араб")), fixLabel: "Саудын Араб болгох" })
  }

  // L05 · ҮЛЭМЖ / Үлэмж, never with У.
  if (/УЛЭМЖ|Улэмж/.test(all)) {
    hits.push({ rule: "L05", severity: "error", message: "Хөтлөгчийн нэрийг «Үлэмж» (ҮЛЭМЖ) гэж бичнэ.", sample: sampleOf(all, /УЛЭМЖ|Улэмж/g), fix: fixAll((t) => t.replace(/УЛЭМЖ/g, "ҮЛЭМЖ").replace(/Улэмж/g, "Үлэмж")), fixLabel: "Үлэмж болгох" })
  }

  // L24 (lite) · a number in the title or summary must be in the body too: no headline-only figures.
  const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."))
  const bodyNumbers = new Set(numbers(body))
  const orphan = [...numbers(draft.title), ...numbers(draft.dek)].filter((n) => !bodyNumbers.has(n))
  if (orphan.length) {
    hits.push({
      rule: "L24",
      severity: "error",
      message: `Гарчиг, товч тайлбар дахь тоо үндсэн текстэд байх ёстой: ${[...new Set(orphan)].join(", ")}.`,
    })
  }

  // L12 · rhetorical self-answering: «Энэ бол X биш. Энэ бол Y.»
  const selfAnswer = /Энэ бол [^.!?]{1,80} биш\.\s*Энэ бол/giu
  if (selfAnswer.test(all)) {
    selfAnswer.lastIndex = 0
    hits.push({ rule: "L12", severity: "error", message: "«Энэ бол X биш. Энэ бол Y.» хэлбэрээс зайлсхийнэ. Санаагаа нэг өгүүлбэрээр хэлнэ.", sample: sampleOf(all, selfAnswer) })
  }

  // L23 · Mongolian quotes are «guillemets».
  if (/"[^"]+"/.test(all) || /[“”„]/.test(all)) {
    hits.push({
      rule: "L23",
      severity: "warning",
      message: "Ишлэл, бүтээлийн нэрийг «…» хашилтаар бичнэ.",
      sample: sampleOf(all, /"[^"]+"|[“”„][^“”„]*[“”„]/g),
      fix: fixAll((t) => t.replace(/"([^"]+)"/g, "«$1»").replace(/[“„]([^“”„]*)”/g, "«$1»")),
      fixLabel: "«…» болгох",
    })
  }

  // L11 · performed discovery: tell the finding, not the story of finding it.
  const discovery = /судалж эхлэхдээ|гэж бодож байлаа\.\s*Гэтэл/giu
  if (discovery.test(all)) {
    discovery.lastIndex = 0
    hits.push({ rule: "L11", severity: "warning", message: "«Судалж эхлэхдээ … гэж бодож байлаа» гэх мэт олсон түүхээ биш, дүгнэлтээ шууд хэлнэ.", sample: sampleOf(all, discovery) })
  }

  // L13 · three-beat punch ending: the last three sentences each under five words.
  const last = sentencesOf(body).slice(-3)
  if (last.length === 3 && last.every((sentence) => sentence.split(/\s+/).length < 5)) {
    hits.push({ rule: "L13", severity: "warning", message: "Гурван богино өгүүлбэрээр төгсгөхгүй. Нэг тайван, бүтэн өгүүлбэрээр дуусгана.", sample: last.join(" ") })
  }

  // L18 · end on Mongolia: the last 15% of the body names Mongolia, the tugrik or «манай улс».
  if (body.length > 400 && !MONGOLIA.test(body.slice(Math.floor(body.length * 0.85)))) {
    hits.push({ rule: "L18", severity: "warning", message: "Төгсгөлийн хэсэгт Монголтой холбоно (төгрөг, өрхийн зардал). Жишээ: «Нэгэнт … ярьсных энийг Монголтой холбож харах хэрэгтэй.»" })
  }

  // L21 · investment topics carry a no-advice line.
  if (INVESTMENT.test(all) && !NO_ADVICE.test(all)) {
    hits.push({ rule: "L21", severity: "warning", message: "Хөрөнгө оруулалтын сэдэв: «Мэдээж энэ бол санхүүгийн зөвлөгөө биш, бидний үзэл бодол юм.» гэх мөр нэмнэ." })
  }

  // L10 · Latin technical terms are glossed once with «буюу».
  const unglossed = new Set<string>()
  const seen = new Set<string>()
  for (const sentence of sentencesOf(outsideQuotes(body))) {
    for (const match of sentence.matchAll(/(?<![A-Za-z])[a-z][a-z-]{3,}(?: [a-z][a-z-]{2,})?(?![A-Za-z])/g)) {
      const term = match[0]
      if (seen.has(term) || LATIN_OK.has(term) || /https?|www/.test(term)) continue
      seen.add(term)
      if (!/буюу|\(/.test(sentence)) unglossed.add(term)
    }
  }
  if (unglossed.size) {
    hits.push({ rule: "L10", severity: "warning", message: `Англи нэр томьёог анх гарахад нь «буюу»-гаар тайлбарлана: ${[...unglossed].slice(0, 4).join(", ")}.` })
  }

  return hits
}
