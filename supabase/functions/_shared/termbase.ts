/*
 * EZ termbase: the 49 entries of the Article Bot Writing Guide v1.0 (Annex B,
 * style/termbase.csv) with their gloss policy, plus earlier house entries from
 * the Style Book that the guide doesn't list (marked HOUSE). `match` lists the
 * English (and Mongolian) forms that pull the entry into the agent's prompt.
 * Add to it after every edit that corrects a term. Shared by the admin and the
 * news agent; imports nothing.
 */

/**
 * mn_only: the Mongolian term alone. mn_then_latin_paren: «бодит хүү (real yield)»
 * at first use, then Mongolian only. abbr_expand_once: «Дотоодын нийт бүтээгдэхүүн (ДНБ)»
 * at first use. fixed_phrase: use exactly as written.
 */
export type TermPolicy = "mn_only" | "mn_then_latin_paren" | "abbr_expand_once" | "fixed_phrase"

export interface Term {
  mn: string
  en: string
  policy: TermPolicy
  /** Lowercase English/Mongolian fragments that mean this term is in play. */
  match: string[]
  /** Where it comes from: HOST, ART, DRAFT, OPEN (guide tags) or HOUSE (earlier house decision). */
  tag: string
  note?: string
}

export const TERMS: Term[] = [
  // Energy
  { mn: "газрын тосны бүтээгдэхүүн", en: "petroleum products", policy: "mn_only", tag: "HOST+ART", match: ["petroleum product", "fuel product"] },
  { mn: "бэлэн бүтээгдэхүүний үнэ", en: "finished product price", policy: "mn_only", tag: "HOST+ART", match: ["product price", "pump price"] },
  { mn: "түүхий тос", en: "crude oil", policy: "mn_only", tag: "HOST+ART", match: ["crude"], note: "«газрын тос» is also accepted (house 2026-10-12); never mix forms within one article." },
  { mn: "нефтийн бүтээгдэхүүн", en: "petroleum products (customs category)", policy: "mn_only", tag: "ART", match: ["customs"], note: "Used in import statistics." },
  { mn: "боловсруулах үйлдвэр", en: "refinery", policy: "mn_only", tag: "ART", match: ["refiner"] },
  { mn: "олборлолт", en: "production (extraction)", policy: "mn_only", tag: "ART", match: ["output", "production", "extraction"] },
  { mn: "боловсруулалт", en: "refining", policy: "mn_only", tag: "ART", match: ["refining"] },
  { mn: "ердийн хэрэглээний N хоногийн нөөц", en: "N days of normal consumption cover", policy: "fixed_phrase", tag: "ART", match: ["days of", "stockpile", "fuel reserve", "reserves of fuel"], note: "Official formulation; give stocks as days." },
  { mn: "намрын нөөц", en: "autumn stockpile", policy: "mn_only", tag: "ART", match: ["autumn stock", "winter stock"] },
  { mn: "шатахуун түгээх станц", en: "fuel station", policy: "mn_only", tag: "ART", match: ["fuel station", "gas station", "petrol station"] },
  { mn: "вагон цистерн", en: "tank wagon", policy: "mn_only", tag: "ART", match: ["tank car", "tank wagon", "rail tanker"] },
  { mn: "Евро-5 стандартын автобензин", en: "Euro-5 standard petrol", policy: "mn_only", tag: "ART", match: ["euro 5", "euro-5"] },
  { mn: "АИ-92", en: "octane grade 92", policy: "mn_only", tag: "ART", match: ["ai-92", "octane", "92-octane"], note: "Written without a space." },
  { mn: "ОПЕК", en: "OPEC", policy: "mn_only", tag: "OPEN", match: ["opec"] },
  { mn: "дунд нэрэлт", en: "middle distillates", policy: "mn_then_latin_paren", tag: "DRAFT", match: ["middle distillate", "distillate"] },
  // Macro
  { mn: "ДНБ", en: "GDP", policy: "abbr_expand_once", tag: "ART", match: ["gdp", "gross domestic product"], note: "Дотоодын нийт бүтээгдэхүүн (ДНБ) at first use." },
  { mn: "инфляц", en: "inflation", policy: "mn_only", tag: "ART", match: ["inflation"] },
  { mn: "төсвийн тэнцэл", en: "budget balance", policy: "mn_only", tag: "ART", match: ["budget balance", "fiscal balance"] },
  { mn: "төсвийн алдагдал", en: "budget deficit", policy: "mn_only", tag: "DRAFT", match: ["deficit"] },
  { mn: "зарлагын дээд хэмжээ", en: "expenditure ceiling", policy: "mn_only", tag: "ART", match: ["spending cap", "expenditure ceiling", "spending ceiling"] },
  { mn: "төсвийн хүрээний мэдэгдэл", en: "budget framework statement", policy: "mn_only", tag: "ART", match: ["budget framework"] },
  { mn: "тодотгол", en: "budget amendment", policy: "mn_only", tag: "ART", match: ["supplementary budget", "budget amendment", "revised budget"] },
  { mn: "эдийн засгийн өсөлт", en: "economic growth", policy: "mn_only", tag: "ART", match: ["economic growth", "growth rate"] },
  { mn: "төсөөлөл", en: "forecast", policy: "mn_only", tag: "ART", match: ["forecast", "projection", "outlook"] },
  { mn: "уул уурхайн бус салбар", en: "non-mining sector", policy: "mn_only", tag: "ART", match: ["non-mining"] },
  { mn: "АМНАТ", en: "mineral resource royalty", policy: "abbr_expand_once", tag: "ART", match: ["royalt"] },
  { mn: "тэгш бус байдал", en: "inequality", policy: "mn_only", tag: "ART", match: ["inequality"] },
  { mn: "ядуурлын түвшин", en: "poverty rate", policy: "mn_only", tag: "ART", match: ["poverty"] },
  { mn: "тайлант хугацаа", en: "reporting period", policy: "mn_only", tag: "ART", match: ["reporting period"] },
  { mn: "өмнөх оны мөн үе", en: "same period last year", policy: "mn_only", tag: "ART", match: ["year-on-year", "year on year", "from a year earlier", "y/y"] },
  { mn: "Гаалийн Ерөнхий Газар", en: "General Administration of Customs", policy: "mn_only", tag: "ART", match: ["customs"] },
  { mn: "импортын бүтэц", en: "import structure", policy: "mn_only", tag: "ART", match: ["import mix", "import structure", "composition of imports"] },
  // Finance
  { mn: "бодит хүү", en: "real yield / real interest rate", policy: "mn_then_latin_paren", tag: "DRAFT", match: ["real yield", "real interest"], note: "бодит хүү (real yield) in written copy." },
  { mn: "нөөц валют", en: "reserve currency", policy: "mn_then_latin_paren", tag: "DRAFT", match: ["reserve currency"] },
  { mn: "төв банк", en: "central bank", policy: "mn_only", tag: "DRAFT", match: ["central bank"] },
  { mn: "Холбооны нөөцийн сан", en: "Federal Reserve", policy: "mn_then_latin_paren", tag: "DRAFT", match: ["federal reserve", "the fed", "fed "], note: "Холбооны нөөцийн сан (Fed); then Fed-ийн with a hyphen before the suffix." },
  { mn: "засгийн газрын бонд", en: "government bond", policy: "mn_then_latin_paren", tag: "DRAFT", match: ["treasur", "government bond", "sovereign bond"], note: "Treasury glossed once in brackets." },
  { mn: "мөнгөний нийлүүлэлт", en: "money supply", policy: "mn_only", tag: "DRAFT", match: ["money supply"] },
  { mn: "үнэ цэнийг хадгалах хэрэгсэл", en: "store of value", policy: "mn_then_latin_paren", tag: "DRAFT", match: ["store of value"] },
  { mn: "өрийн үйлчилгээ", en: "debt service", policy: "mn_only", tag: "DRAFT", match: ["debt service", "debt servicing", "interest payments"], note: "Its ratio to revenue is the key debt-episode measure." },
  { mn: "төсвийн хумилт", en: "austerity", policy: "mn_only", tag: "DRAFT", match: ["austerity"] },
  { mn: "өрийн бүтцийн өөрчлөлт", en: "debt restructuring", policy: "mn_only", tag: "DRAFT", match: ["restructur"] },
  { mn: "дефолт", en: "default", policy: "mn_only", tag: "DRAFT", match: ["default"], note: "Alternative: төлөгдөхгүй орхих." },
  { mn: "гадаад валютын албан нөөц", en: "official FX reserves", policy: "mn_only", tag: "DRAFT", match: ["fx reserves", "foreign reserves", "foreign exchange reserves"] },
  { mn: "унци", en: "ounce", policy: "fixed_phrase", tag: "DRAFT", match: ["ounce", "oz"] },
  // Spelling and style
  { mn: "иен", en: "yen", policy: "fixed_phrase", tag: "HOST", match: ["yen"], note: "Never иэн." },
  { mn: "Саудын Араб", en: "Saudi Arabia", policy: "fixed_phrase", tag: "HOST", match: ["saudi"] },
  { mn: "ҮЛЭМЖ", en: "host name in capitals", policy: "fixed_phrase", tag: "HOST", match: ["ulemj", "үлэмж"], note: "Never УЛЭМЖ." },
  { mn: "нэгж хувь", en: "percentage point", policy: "fixed_phrase", tag: "DRAFT", match: ["percentage point", "basis point", "bps"], note: "For a change in a rate, never «хувь»." },
  // Earlier house entries (Style Book v1.0, decisions of 2026-10-12)
  { mn: "бодлогын хүү", en: "policy rate", policy: "mn_only", tag: "HOUSE", match: ["policy rate", "benchmark rate", "key rate"] },
  { mn: "эх үүсвэр", en: "supply source", policy: "mn_only", tag: "HOUSE", match: ["supply source", "supplier"] },
  { mn: "QE", en: "quantitative easing", policy: "mn_then_latin_paren", tag: "HOUSE", match: ["quantitative easing", "qe"], note: "төв банк мөнгө хэвлэж бонд худалдаж авах арга (QE) at first use." },
  { mn: "бодит үр дүнтэй ханш", en: "REER", policy: "mn_only", tag: "HOUSE", match: ["reer", "real effective exchange"] },
  { mn: "цэвэр зээлдүүлэгч улс", en: "net creditor", policy: "mn_only", tag: "HOUSE", match: ["net creditor"] },
  { mn: "интервенц", en: "intervention", policy: "mn_only", tag: "HOUSE", match: ["intervention"] },
  { mn: "ипотекийн зээл", en: "mortgage", policy: "mn_only", tag: "HOUSE", match: ["mortgage"] },
  { mn: "Олон Улсын Валютын Сан (ОУВС)", en: "IMF", policy: "abbr_expand_once", tag: "HOUSE", match: ["imf", "international monetary fund"] },
  { mn: "Дэлхийн Банк", en: "World Bank", policy: "mn_only", tag: "HOUSE", match: ["world bank"] },
  { mn: "Дэлхийн Алтны Зөвлөл", en: "World Gold Council", policy: "mn_only", tag: "HOUSE", match: ["world gold council"] },
  { mn: "Рэй Далио", en: "Ray Dalio", policy: "fixed_phrase", tag: "HOUSE", match: ["dalio"] },
  { mn: "Бреттон-Вудс", en: "Bretton Woods", policy: "fixed_phrase", tag: "HOUSE", match: ["bretton"] },
]

const POLICY_HINT: Record<TermPolicy, string> = {
  mn_only: "Mongolian only",
  mn_then_latin_paren: "Mongolian, then the Latin in brackets at first use",
  abbr_expand_once: "expand once at first use",
  fixed_phrase: "exactly as written",
}

/** The entries whose English or Mongolian forms appear in `text`, at most `limit`. */
export function termsFor(text: string, limit = 25) {
  const haystack = text.toLowerCase()
  return TERMS.filter((term) => term.match.some((fragment) => haystack.includes(fragment))).slice(0, limit)
}

/** One prompt line per term: "real yield → бодит хүү (Mongolian, then the Latin in brackets at first use; …)". */
export const termLine = (term: Term) => `- ${term.en} → ${term.mn} (${POLICY_HINT[term.policy]}${term.note ? `; ${term.note}` : ""})`
