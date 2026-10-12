/*
 * EZ termbase: the Mongolian terms the style book settles (Part 3.9 and Part 5),
 * so writers and the news agent use what Mongolian readers already know rather
 * than a translator's guess. `match` lists the English (and Mongolian) forms that
 * pull the entry into the agent's prompt. Add to it after every edit that
 * corrects a term. Shared by the admin and the news agent; imports nothing.
 */

export type TermPolicy = "translate" | "transliterate" | "loanword" | "gloss-once" | "official"

export interface Term {
  mn: string
  en: string
  policy: TermPolicy
  /** Lowercase English/Mongolian fragments that mean this term is in play. */
  match: string[]
  note?: string
}

export const TERMS: Term[] = [
  // Energy and petroleum (style book 5.1)
  { mn: "газрын тосны бүтээгдэхүүн", en: "petroleum products", policy: "translate", match: ["petroleum product", "fuel product"] },
  { mn: "бэлэн бүтээгдэхүүний үнэ", en: "finished product price", policy: "translate", match: ["product price", "pump price"] },
  { mn: "түүхий тос (эсвэл газрын тос)", en: "crude oil", policy: "translate", match: ["crude"], note: "Both forms are fine (house decision 2026-10-12)." },
  { mn: "нефтийн бүтээгдэхүүн", en: "petroleum products (customs category)", policy: "official", match: ["customs"], note: "Only when quoting customs data." },
  { mn: "боловсруулах үйлдвэр", en: "refinery", policy: "translate", match: ["refiner"] },
  { mn: "олборлолт / боловсруулалт", en: "production / refining", policy: "translate", match: ["output", "production", "refining"] },
  { mn: "ердийн хэрэглээний N хоногийн нөөц", en: "N days of normal consumption (stock cover)", policy: "official", match: ["days of", "stockpile", "reserves of fuel", "fuel reserve"], note: "Official formula; give stocks as days, never tonnes alone." },
  { mn: "эх үүсвэр", en: "supply source", policy: "translate", match: ["supply source", "supplier"] },
  { mn: "Евро-5 стандартын автобензин", en: "Euro-5 petrol", policy: "translate", match: ["euro 5", "euro-5"] },
  { mn: "АИ-92, АИ-95", en: "octane grades", policy: "official", match: ["ai-92", "octane", "92-octane"] },
  { mn: "шатахуун түгээх станц", en: "fuel station", policy: "translate", match: ["fuel station", "gas station", "petrol station"] },
  { mn: "вагон цистерн", en: "tank wagon", policy: "translate", match: ["tank car", "tank wagon", "rail tanker"] },
  { mn: "дунд нэрэлт (middle distillates)", en: "middle distillates", policy: "gloss-once", match: ["middle distillate", "distillate"] },
  { mn: "ОПЕК", en: "OPEC", policy: "translate", match: ["opec"] },
  // Macroeconomics, budget, trade (5.2)
  { mn: "ДНБ (Дотоодын Нийт Бүтээгдэхүүн)", en: "GDP", policy: "translate", match: ["gdp", "gross domestic product"] },
  { mn: "инфляц", en: "inflation", policy: "loanword", match: ["inflation"] },
  { mn: "бодлогын хүү", en: "policy rate", policy: "translate", match: ["policy rate", "benchmark rate", "key rate"] },
  { mn: "төсвийн тэнцэл", en: "budget balance", policy: "translate", match: ["budget balance", "fiscal balance"] },
  { mn: "төсвийн алдагдал", en: "budget deficit", policy: "translate", match: ["deficit"] },
  { mn: "зарлагын дээд хэмжээ", en: "expenditure ceiling", policy: "translate", match: ["spending cap", "expenditure ceiling", "spending ceiling"] },
  { mn: "төсвийн хүрээний мэдэгдэл", en: "budget framework statement", policy: "official", match: ["budget framework"] },
  { mn: "тодотгол", en: "budget amendment", policy: "translate", match: ["supplementary budget", "budget amendment", "revised budget"] },
  { mn: "уул уурхайн бус салбар", en: "non-mining sector", policy: "translate", match: ["non-mining"] },
  { mn: "АМНАТ", en: "mineral resource royalty", policy: "official", match: ["royalt"] },
  { mn: "ядуурлын түвшин", en: "poverty rate", policy: "translate", match: ["poverty"] },
  { mn: "өмнөх оны мөн үе", en: "same period last year", policy: "official", match: ["year-on-year", "year on year", "from a year earlier", "y/y"] },
  { mn: "Гаалийн Ерөнхий Газар", en: "General Administration of Customs", policy: "translate", match: ["customs"] },
  // Finance, gold, debt (5.3, 3.9)
  { mn: "real yield буюу бодит хүү", en: "real yield", policy: "gloss-once", match: ["real yield", "real interest"] },
  { mn: "reserve currency буюу нөөц валют", en: "reserve currency", policy: "gloss-once", match: ["reserve currency"] },
  { mn: "Холбооны нөөцийн сан буюу Fed (Fed-ийн)", en: "Federal Reserve", policy: "translate", match: ["federal reserve", "the fed", "fed "] },
  { mn: "засгийн газрын бонд буюу Treasury", en: "government bond / Treasury", policy: "gloss-once", match: ["treasur", "government bond", "sovereign bond"] },
  { mn: "QE буюу төв банк мөнгө хэвлэж бонд худалдаж авах арга", en: "quantitative easing", policy: "gloss-once", match: ["quantitative easing", "qe"] },
  { mn: "store of value буюу үнэ цэнийг хадгалах хэрэгсэл", en: "store of value", policy: "gloss-once", match: ["store of value"] },
  { mn: "өрийн үйлчилгээ", en: "debt service", policy: "translate", match: ["debt service", "debt servicing", "interest payments"] },
  { mn: "өрийн бүтцийн өөрчлөлт", en: "debt restructuring", policy: "translate", match: ["restructur"] },
  { mn: "дефолт", en: "default", policy: "loanword", match: ["default"] },
  { mn: "гадаад валютын албан нөөц", en: "official FX reserves", policy: "translate", match: ["fx reserves", "foreign reserves", "foreign exchange reserves"] },
  { mn: "бодит үр дүнтэй ханш", en: "REER", policy: "translate", match: ["reer", "real effective exchange"] },
  { mn: "цэвэр зээлдүүлэгч улс", en: "net creditor", policy: "translate", match: ["net creditor"] },
  { mn: "интервенц", en: "intervention", policy: "loanword", match: ["intervention"] },
  { mn: "ипотекийн зээл", en: "mortgage", policy: "loanword", match: ["mortgage"] },
  { mn: "Олон Улсын Валютын Сан (ОУВС)", en: "IMF", policy: "translate", match: ["imf", "international monetary fund"] },
  { mn: "Дэлхийн Банк", en: "World Bank", policy: "translate", match: ["world bank"] },
  { mn: "Дэлхийн Алтны Зөвлөл", en: "World Gold Council", policy: "translate", match: ["world gold council"] },
  { mn: "иен", en: "yen", policy: "transliterate", match: ["yen"], note: "Never иэн." },
  { mn: "Саудын Араб", en: "Saudi Arabia", policy: "transliterate", match: ["saudi"] },
  { mn: "Рэй Далио", en: "Ray Dalio", policy: "transliterate", match: ["dalio"] },
  { mn: "Бреттон-Вудс", en: "Bretton Woods", policy: "transliterate", match: ["bretton"] },
  { mn: "унци", en: "ounce", policy: "loanword", match: ["ounce", "oz"] },
]

/** The entries whose English or Mongolian forms appear in `text`, at most `limit`. */
export function termsFor(text: string, limit = 25) {
  const haystack = text.toLowerCase()
  return TERMS.filter((term) => term.match.some((fragment) => haystack.includes(fragment))).slice(0, limit)
}
