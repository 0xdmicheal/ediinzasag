/*
 * Article structure from the EZ Writing System v2.1, Parts 5 and 6: the 18
 * skeletons, the 12 beats and 12 event types that route a story to them, and
 * the shuffle that draws one skeleton, lede, ending and headline pattern per
 * draft. Format sets the length; the skeleton sets the order of ideas.
 * The model only classifies the story and says which skeletons the source can
 * fill; the draw happens here, so pieces in a row do not read alike.
 * Shared; imports nothing.
 */

export type SkeletonCode =
  | "S01" | "S02" | "S03" | "S04" | "S05" | "S06" | "S07" | "S08" | "S09"
  | "S10" | "S11" | "S12" | "S13" | "S14" | "S15" | "S16" | "S17" | "S18"

export interface Skeleton {
  code: SkeletonCode
  name: string
  use: string
  /** Moves in order. A move starting with "(M)" is written only when mongolia_level is direct or channel. */
  moves: string[]
  needs: string
}

export const SKELETONS: Skeleton[] = [
  { code: "S01", name: "Тоо ба утга", use: "A statistic is released", moves: ["The number with its base", "What drove it", "Comparison: the previous figure, the trend, peers", "What it means", "The next release date"], needs: "The figure and its prior value" },
  { code: "S02", name: "Шийдвэрийн задаргаа", use: "A rate, law or policy is decided", moves: ["The decision", "What changed from before", "The stated reason, in the decision-maker's words", "Who is affected", "The next date"], needs: "The decision, the previous setting, a named decision-maker" },
  { code: "S03", name: "Мөнгөний мөр", use: "Budgets, loans, subsidies, deals", moves: ["How much", "From whom", "To whom", "Through what channel", "Who carries the cost", "(M) The Mongolian payer or receiver, with a figure"], needs: "Amount, payer, recipient" },
  { code: "S04", name: "Гинжин урвал", use: "An outside shock travels in steps", moves: ["The event", "Step 1", "Step 2", "Step 3 at the destination", "What would break the chain"], needs: "Each link sourced or named as a mechanism" },
  { code: "S05", name: "Хоёр уншлага", use: "Data or a decision is disputed", moves: ["The news", "Reading A, from a named source", "Reading B, from a named source", "What evidence would settle it"], needs: "Two named sources who disagree" },
  { code: "S06", name: "Тоглогчдын зураг", use: "Negotiations, sanctions, summits", moves: ["The move", "The actors, each with an interest and a lever", "What each gains or loses", "(M) Where Mongolia stands, with a figure"], needs: "Three or more actors with sourced positions" },
  { code: "S07", name: "Хэлцлийн задаргаа", use: "Merger, bond issue, IPO, contract", moves: ["Who, what, at what price", "The price compared: an earlier deal, a coupon or a multiple", "Why now", "The risks", "(M) The Mongolian exposure, with a figure"], needs: "The price or terms" },
  { code: "S08", name: "Он цагийн шугам", use: "A long-running story, probe or follow-up", moves: ["What is new", "Four to six dated steps that led here", "Where it stands", "The next date"], needs: "Dated events in the sources" },
  { code: "S09", name: "Асуулт, хариулт", use: "A complex topic needs unpacking", moves: ["Four to six questions a reader would ask, each answered at once with figures"], needs: "An answer in the source for each question" },
  { code: "S10", name: "Домог ба тоо", use: "A viral claim or a politician's figure", moves: ["The claim: who said it and where", "What the data shows", "Why the two differ", "What remains to be decided"], needs: "The claim's source and a data source" },
  { code: "S11", name: "Тэр үе ба одоо", use: "A record, a first since, a repeat crisis", moves: ["Today's event", "The dated precedent", "What is the same", "What differs", "What followed then (history, not a forecast)"], needs: "A dated precedent" },
  { code: "S12", name: "Масштаб", use: "A very large or very small number", moves: ["The number", "The number in a scale the reader knows", "Why the scale matters", "The caveat"], needs: "The number plus a figure to scale it against" },
  { code: "S13", name: "Хожигч, хохирогч", use: "Tariffs, rate moves, price shocks", moves: ["The change", "Who gains, with figures", "Who loses, with figures", "The net effect", "(M) Mongolia's side of the ledger, with a figure"], needs: "Two or more affected groups with sourced effects" },
  { code: "S14", name: "Гурван зам", use: "Forecasts and open outcomes", moves: ["Where things stand", "The base path", "The better path", "The worse path", "Dated signposts that will tell which path"], needs: "Named forecasts or stated conditions" },
  { code: "S15", name: "Тоон самбар", use: "A weekly or market wrap", moves: ["Three to five numbers, a paragraph each", "One sentence linking them", "What is scheduled next"], needs: "Three or more figures from one period" },
  { code: "S16", name: "Өрхийн түрийвч", use: "Prices, loans, wages, taxes", moves: ["The change", "What it means for a borrower, saver or shopper", "Who is most exposed", "The next date"], needs: "A household-level figure (a price, a rate or a wage)" },
  { code: "S17", name: "Дэлхийгээс Монгол руу", use: "Global news with a real Mongolian exposure", moves: ["The global news, briefly", "(M) Mongolia's exposure in numbers", "(M) The channel", "The next date"], needs: "A Mongolian exposure figure" },
  { code: "S18", name: "Товч хүрээ", use: "Brief news", moves: ["The lede", "Two or three context sentences with figures", "The link"], needs: "The fact itself" },
]

export const BEATS = {
  mongolia_macro: { label: "Монголын макро", skeletons: ["S01", "S12", "S16", "S11", "S10", "S15", "S18"] },
  central_bank: { label: "Төв банк, мөнгөний бодлого", skeletons: ["S02", "S04", "S16", "S05", "S14", "S11", "S18"] },
  banking: { label: "Банк, санхүүгийн салбар", skeletons: ["S01", "S03", "S16", "S08", "S13", "S18"] },
  capital_markets: { label: "Хөрөнгийн зах зээл", skeletons: ["S15", "S07", "S01", "S04", "S14", "S18"] },
  commodities: { label: "Түүхий эд, эрчим хүч", skeletons: ["S04", "S17", "S01", "S12", "S13", "S14"] },
  budget_politics: { label: "Төсөв, дотоод улс төр", skeletons: ["S03", "S02", "S10", "S13", "S08", "S05"] },
  geopolitics: { label: "Геополитик", skeletons: ["S06", "S04", "S14", "S11", "S17", "S08"] },
  trade: { label: "Олон улсын худалдаа, тариф", skeletons: ["S13", "S04", "S01", "S17", "S06", "S12"] },
  companies: { label: "Компани, хэлцэл", skeletons: ["S07", "S03", "S01", "S08", "S13", "S18"] },
  tech: { label: "Технологи, AI", skeletons: ["S12", "S07", "S13", "S11", "S17", "S14"] },
  household: { label: "Өрхийн санхүү", skeletons: ["S16", "S09", "S01", "S12", "S13"] },
  china: { label: "Хятадын эдийн засаг", skeletons: ["S17", "S04", "S01", "S02", "S14", "S12"] },
} satisfies Record<string, { label: string; skeletons: SkeletonCode[] }>

export const EVENTS = {
  data_release: { label: "Data release", best: ["S01", "S12", "S15", "S16"], never: ["S06"] },
  decision: { label: "Decision", best: ["S02", "S13", "S16"], never: ["S15"] },
  deal: { label: "Deal", best: ["S07", "S03"], never: ["S15"] },
  shock: { label: "Shock", best: ["S04", "S11", "S14", "S17"], never: ["S09"] },
  conflict: { label: "Conflict or negotiation", best: ["S06", "S14", "S13"], never: ["S01"] },
  forecast: { label: "Forecast", best: ["S14", "S05", "S12", "S01"], never: ["S02"] },
  trend: { label: "Trend", best: ["S01", "S11", "S12"], never: ["S18"] },
  probe: { label: "Probe or court case", best: ["S08", "S03"], never: ["S13"] },
  record: { label: "Record or first", best: ["S11", "S12"], never: ["S09"] },
  people: { label: "People move", best: ["S18", "S08"], never: ["S12"] },
  follow_up: { label: "Follow-up", best: ["S08", "S18"], never: [] },
  results: { label: "Company results", best: ["S01", "S07", "S13", "S12"], never: ["S06"] },
} satisfies Record<string, { label: string; best: SkeletonCode[]; never: SkeletonCode[] }>

export type Beat = keyof typeof BEATS
export type EventType = keyof typeof EVENTS
export type Format = "medee" | "medee_tailbar"
export type MongoliaLevel = "direct" | "channel" | "none"

export const LEDES = {
  number: { name: "Тоон", how: "Open on the number, with its base and period" },
  plain: { name: "Шууд", how: "Open on what happened: who did what, when" },
  contrast: { name: "Зөрүү", how: "Open on two sourced facts that pull apart, in one sentence" },
  consequence: { name: "Үр дагавар", how: "Open on the consequence, then the cause in the same paragraph" },
  first: { name: "Анхны", how: "Open on the record or the first since, with the dated precedent" },
  household: { name: "Өрхийн", how: "Open on the household stake: a price, rate or wage from the source" },
  quote: { name: "Ишлэл", how: "Open on the named speaker's words, because the words are the news" },
  comparison: { name: "Харьцуулалт", how: "Open on a comparison: against history, a peer or a forecast" },
}
export type Lede = keyof typeof LEDES

export const ENDINGS = {
  next_date: "The next scheduled date: a meeting, release or deadline, with its date",
  signposts: "Dated signposts that will settle the question",
  open_decision: "The open decision and who makes it",
  forward_figure: "One forward-looking figure: a forecast or a target, with who made it",
  counterview: "The counterview's best point, from a named source",
  mongolia_figure: "A Mongolia figure that shows what is at stake here",
}
export type Ending = keyof typeof ENDINGS

export const HEADLINES = {
  number_verb: "Number + verb («Оюу толгойн зэс 27 хувиар өсөв»)",
  actor_action: "Actor + action («Монголбанк бодлогын хүүг 12 хувьд барив»)",
  contrast: "Contrast («Өсөлт хурдан, цалин удаан»)",
  consequence: "Consequence («Хүү өсөхөд байрны зээл 200 мянгаар нэмэгдэнэ»)",
  record: "Record («Алт анх удаа 4,000 ам.доллар давав»), only when literally true",
  colon: "Colon frame («Rio Tinto: зэсийн тал хувь Монголоос»)",
}
export type Headline = keyof typeof HEADLINES

/** What the model reads from the source before the draw; coherence rules 1 to 4 of Part 6 need these facts. */
export interface Classification {
  beat: Beat
  event_type: EventType
  format: Format
  mongolia_level: MongoliaLevel
  /** Skeletons whose "needs" the source can fill. */
  fillable: SkeletonCode[]
  has_household_figure: boolean
  has_dated_precedent: boolean
  has_named_quote: boolean
  has_contrast: boolean
  has_forecast: boolean
}

/** One earlier draft, as recorded in its bot notes, for the recency penalty. */
export interface Recent {
  skeleton: SkeletonCode
  beat?: string
  lede?: string
  ending?: string
}

export interface Plan {
  skeleton: Skeleton
  lede: Lede
  ending: Ending
  headline: Headline
  format: Format
}

/** Мэдээ uses S18, S01 or S02 only (coherence rule 6). */
const SHORT: SkeletonCode[] = ["S18", "S01", "S02"]
const MONGOLIA_ONLY: SkeletonCode[] = ["S17"]

/**
 * Part 6, in its order: constrain, score, sample, check. Fit 3 if listed first
 * for the beat or among the event's best, 2 if allowed for the beat, 1 if fillable
 * elsewhere; minus 2 if used in the last 5 pieces on the same beat, minus 1 if in
 * the last 10 on any beat. One option is drawn from the top three, weighted by
 * score, never always the top one.
 */
export function drawPlan(story: Classification, recent: Recent[], random: () => number = Math.random): Plan {
  const beat = BEATS[story.beat] ?? BEATS.mongolia_macro
  const event = EVENTS[story.event_type] ?? EVENTS.follow_up
  const mongolia = story.mongolia_level !== "none"
  const allowed = (code: SkeletonCode) =>
    !(event.never as SkeletonCode[]).includes(code) &&
    (story.format === "medee" ? SHORT.includes(code) : code !== "S18") &&
    (mongolia || !MONGOLIA_ONLY.includes(code)) &&
    (code !== "S16" || story.has_household_figure) &&
    (code !== "S11" || story.has_dated_precedent) &&
    (code !== "S14" || story.has_forecast)
  const fillable = new Set(story.fillable)
  const sameBeat = recent.filter((row) => row.beat === story.beat).slice(0, 5).map((row) => row.skeleton)
  const anyBeat = recent.slice(0, 10).map((row) => row.skeleton)
  const fit = (code: SkeletonCode) => {
    if (beat.skeletons[0] === code || (event.best as SkeletonCode[]).includes(code)) return 3
    if ((beat.skeletons as SkeletonCode[]).includes(code)) return 2
    return 1
  }
  const score = (code: SkeletonCode) => fit(code) - (sameBeat.includes(code) ? 2 : 0) - (anyBeat.includes(code) ? 1 : 0)
  let pool = SKELETONS.map((s) => s.code).filter((code) => allowed(code) && fillable.has(code))
  // The source fills nothing the routing allows: fall back to the plainest move order for the format.
  if (!pool.length) pool = story.format === "medee" ? ["S18"] : ["S01"]
  const code = weighted(pool.map((option) => ({ option, score: score(option) })), random)
  const skeleton = SKELETONS.find((s) => s.code === code)!

  const ledes = (Object.keys(LEDES) as Lede[]).filter(
    (lede) =>
      (lede !== "household" || story.has_household_figure) &&
      (lede !== "first" || story.has_dated_precedent) &&
      (lede !== "contrast" || story.has_contrast) &&
      (lede !== "quote" || story.has_named_quote) &&
      // S11 opens on today's event; the precedent comes second.
      (code !== "S11" || lede !== "first"),
  )
  const lastLedes = recent.slice(0, 3).map((row) => row.lede)
  const lede = weighted(ledes.map((option) => ({ option, score: 2 - (lastLedes.includes(option) ? 1.5 : 0) + (fitLede(option, code) ? 1 : 0) })), random)

  const endings = (Object.keys(ENDINGS) as Ending[]).filter(
    (ending) => (ending !== "mongolia_figure" || mongolia) && (ending !== "counterview" || story.format !== "medee") && (ending !== "forward_figure" || story.has_forecast),
  )
  const lastEndings = recent.slice(0, 3).map((row) => row.ending)
  const ending = weighted(endings.map((option) => ({ option, score: 2 - (lastEndings.includes(option) ? 1.5 : 0) + (option === "signposts" && code === "S14" ? 1 : 0) })), random)

  const headlines = (Object.keys(HEADLINES) as Headline[]).filter((headline) => headline !== "record" || story.event_type === "record")
  const headline = weighted(headlines.map((option) => ({ option, score: 1 + (option === "number_verb" && lede === "number" ? 1 : 0) })), random)

  return { skeleton, lede, ending, headline, format: story.format }
}

/** Ledes that suit a skeleton's first move get a small bonus. */
function fitLede(lede: Lede, code: SkeletonCode) {
  const pairs: Partial<Record<SkeletonCode, Lede[]>> = {
    S01: ["number", "comparison"], S02: ["plain", "quote"], S04: ["consequence", "plain"], S05: ["contrast"],
    S10: ["contrast", "quote"], S11: ["comparison", "number"], S12: ["number"], S13: ["consequence"], S16: ["household"],
  }
  return pairs[code]?.includes(lede) ?? false
}

/** Draw one of the three highest-scoring options, weighted by score (scores below 0.5 count as 0.5). */
function weighted<T>(options: { option: T; score: number }[], random: () => number): T {
  const top = [...options].sort((a, b) => b.score - a.score).slice(0, 3)
  const total = top.reduce((sum, row) => sum + Math.max(0.5, row.score), 0)
  let pick = random() * total
  for (const row of top) {
    pick -= Math.max(0.5, row.score)
    if (pick <= 0) return row.option
  }
  return top[top.length - 1].option
}

/** The plan as the writer reads it. */
export function planBrief(plan: Plan, mongolia: MongoliaLevel) {
  const moves = plan.skeleton.moves.filter((move) => mongolia !== "none" || !move.startsWith("(M)"))
  return [
    `Structure: skeleton ${plan.skeleton.code} «${plan.skeleton.name}» (${plan.skeleton.use}). It is a sequence of moves, not a set of headings. Write the moves in this order, each as one or more full paragraphs:`,
    ...moves.map((move, index) => `  ${index + 1}. ${move.replace(/^\(M\)\s*/, "")}`),
    plan.format === "medee"
      ? `In a Мэдээ the moves flow as plain paragraphs with no subheads.`
      : `In a Мэдээ ба тайлбар the moves flow as paragraphs; group them under at most two descriptive subheads, and only where a section reaches two paragraphs and 100 words. A subhead never names the move («Алхам 1», «Хоёр дахь уншлага»); it states the point.`,
    `Lede type: ${LEDES[plan.lede].name}. ${LEDES[plan.lede].how}. The why-it-matters statement still comes by paragraph two to four.`,
    `Headline pattern: ${HEADLINES[plan.headline]}.`,
    `Ending: ${ENDINGS[plan.ending]}. It must not repeat the lede's figure.`,
  ].join("\n")
}

/** One line for the editor's notes; recentFrom() reads it back. */
export function planNote(plan: Plan, story: Pick<Classification, "beat" | "event_type">) {
  return `Бүтэц: ${plan.skeleton.code} ${plan.skeleton.name} · ${BEATS[story.beat]?.label ?? story.beat} · ${EVENTS[story.event_type]?.label ?? story.event_type} · эхлэл ${LEDES[plan.lede].name} (${plan.lede}) · төгсгөл ${plan.ending} · гарчиг ${plan.headline} · beat ${story.beat}`
}

/** Parses planNote() lines out of earlier drafts' bot notes, newest first. */
export function recentFrom(notes: string[]): Recent[] {
  return notes.flatMap((text) => {
    const match = text.match(/Бүтэц: (S\d\d)\b[^\n]*?\((\w+)\) · төгсгөл (\w+)[^\n]*?beat (\w+)/)
    return match ? [{ skeleton: match[1] as SkeletonCode, lede: match[2], ending: match[3], beat: match[4] }] : []
  })
}
