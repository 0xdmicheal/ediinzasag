import type { NewsItem } from "@/admin/types"

/*
 * Topic categories for "Мэдээний урсгал". Worked out from each story's
 * headline and summary (English or Mongolian) plus the agent's own topic
 * tags, so stories saved before this list existed get them too. A story can
 * be in several.
 */

export interface NewsCategory {
  key: string
  label: string
  test: RegExp
  /** Case-sensitive extras, for abbreviations like "US" or "AI" that are ordinary words in lowercase. */
  exact?: RegExp
}

/** Whole words for Latin; Mongolian stems may take case endings («зэс» matches «зэсийн»). */
const word = (body: string, flags = "iu") => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{N}A-Za-z])`, flags)

export const NEWS_CATEGORIES: NewsCategory[] = [
  {
    key: "economy",
    label: "Economy",
    test: word(
      "economy|economic|economies|gdp|inflation|cpi|recession|growth|budget|fiscal|deficit|debt|interest rates?|policy rate|central bank|federal reserve|fed|ecb|pboc|imf|world bank|jobs|unemployment|payrolls|wages|exports?|imports?|trade|эдийн засаг|эдийн засгийн|ДНБ|инфляц|инфляци|төсөв|төсвийн|өрийн|бодлогын хүү|төв банк|монголбанк|ажилгүйдэл|цалин|экспорт|импорт|худалдаа",
    ),
  },
  {
    key: "markets",
    label: "Markets",
    test: word(
      "stocks?|shares|equities|bonds?|yields?|treasur(?:y|ies)|nasdaq|s&p|dow|wall street|investors?|ipo|currency|currencies|dollar|yuan|yen|forex|exchange rate|хувьцаа|хувьцааны|бонд|хөрөнгийн бирж|хөрөнгө оруулагч|ханш|валют|төгрөг|доллар",
    ),
  },
  {
    key: "mining",
    label: "Mining",
    test: word("mining|miners?|copper|coal|coking|gold|iron ore|lithium|rare earths?|oyu tolgoi|rio tinto|уул уурхай|уул уурхайн|зэс|нүүрс|алт|алтны|төмрийн хүдэр|оюу толгой"),
  },
  {
    key: "energy",
    label: "Energy",
    test: word("oil|crude|brent|wti|opec|fuel|diesel|gasoline|petrol|natural gas|lng|electricity|energy|renewables?|solar|nuclear|газрын тос|түүхий тос|шатахуун|бензин|дизель|ОПЕК|эрчим хүч|цахилгаан|сэргээгдэх"),
  },
  {
    key: "geopolitics",
    label: "Geopolitics",
    test: word(
      "war|wars|military|missiles?|troops|sanctions?|tariffs?|trade war|export controls?|nato|ukraine|russia|taiwan|iran|israel|gaza|north korea|ceasefire|conflict|diplomacy|дайн|цэрэг|цэргийн|хориг|тариф|худалдааны дайн|украин|орос|тайвань|иран|израиль|геополитик",
    ),
  },
  {
    key: "ai",
    label: "AI",
    test: word("artificial intelligence|openai|chatgpt|anthropic|llms?|machine learning|data cent(?:er|re)s?|nvidia|хиймэл оюун|хиймэл оюуны"),
    exact: word("AI|A\\.I\\.", "u"),
  },
  {
    key: "tech",
    label: "Tech",
    test: word("tech|technology|chips?|semiconductors?|tsmc|apple|microsoft|google|alphabet|amazon|tesla|samsung|startups?|fintech|software|чип|технологи|технологийн|стартап|финтек"),
  },
  { key: "crypto", label: "Crypto", test: word("crypto|cryptocurrenc(?:y|ies)|bitcoin|ethereum|stablecoins?|крипто|биткойн") },
  {
    key: "us",
    label: "US",
    test: word("united states|america|american|washington|white house|trump|congress|federal reserve|wall street|АНУ|америк|америкийн|вашингтон|трамп"),
    exact: word("US|USA|U\\.S\\.", "u"),
  },
  { key: "china", label: "China", test: word("china|chinese|beijing|shanghai|xi jinping|pboc|yuan|хятад|хятадын|бээжин") },
  { key: "europe", label: "Europe", test: word("europe|european|eu|eurozone|ecb|germany|france|britain|uk|brussels|европ|европын|ЕХ|герман|франц|их британи") },
  { key: "asia", label: "Asia", test: word("japan|japanese|korea|korean|india|indian|asean|asia|asian|singapore|vietnam|япон|солонгос|энэтхэг|ази") },
]

/** The agent's own topic tags that mean the same as a category. */
const TAG_TO_CATEGORY: Record<string, string> = {
  policy: "economy",
  fuel: "energy",
  energy: "energy",
  mining: "mining",
  markets: "markets",
  geopolitics: "geopolitics",
  tech: "tech",
  us: "us",
  china: "china",
  europe: "europe",
}

/** Category keys a story belongs to. */
export function categoriesOf(item: Pick<NewsItem, "title" | "summary" | "tags">) {
  const text = `${item.title} ${item.summary}`
  const tagged = new Set(item.tags.map((tag) => TAG_TO_CATEGORY[tag]).filter(Boolean))
  return NEWS_CATEGORIES.filter((category) => tagged.has(category.key) || category.test.test(text) || Boolean(category.exact?.test(text))).map((category) => category.key)
}
