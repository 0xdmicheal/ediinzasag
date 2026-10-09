/**
 * Latest closes, 2026.10.08–09. US and European indices are Thursday 8 October
 * closes (Friday's US session was still open when this was written); Asia,
 * the TOP-20, oil, gold and copper are Friday 9 October. Every quote carries its
 * own date. `prev` is the 2026.10.02 value from the previous refresh, so the page
 * can show the move since then; `ytd` is the published change since 1 January.
 * The MSE sub-indices and the per-stock tables are still the 10.02 exchange
 * report: no newer report was published in a form we could read.
 */

export type Currency = "MNT" | "USD"

/** What a number is measured in. Every quote says this explicitly so ₮ and $ never get mixed up. */
export type Denomination =
  | { kind: "money"; currency: Currency; per?: string; scale?: string }
  | { kind: "index" }
  | { kind: "fx"; base: string; quote: string }
  | { kind: "percent" }

export interface Quote {
  id: string
  label: string
  price: string
  move: string
  pct: number
  denom: Denomination
  asOf: string
  source: string
  href?: string
  /** The value at the previous refresh (2026.10.02), for the move since then. */
  prev?: string
  /** % change since 1 January, from the source's year-start column. */
  ytd?: number
  /** % change over 12 months, when the source publishes it instead of year-to-date. */
  year?: number
}

export interface CloseRow {
  symbol: string
  name: string
  currency: Currency
  price: string
  move: string
  pct: number
  volume: string
  note: string
}

export interface FlowRow {
  symbol: string
  name: string
  volume: string
  value: string
  average: string
}

export const sessionLabel = "2026.10.08–09 · Сүүлийн хаалт"
export const sessionNote =
  "АНУ, Европын индекс 10.08-ны пүрэв, Ази, ТОП-20, түүхий эд 10.09-ний баасан гарагийн тоо. Шууд ханш биш."
/** Short label for the sticky bar on /markets. */
export const sessionShort = "10.08–09-ний хаалт"

export const top20 = {
  price: "66,714.98",
  move: "+2.63",
  pct: 0.0,
  month: "+6.09%",
  year: "+34.61%",
  high: "67,367.47",
  highWhen: "2026.09",
  asOf: "2026.10.09",
  /** 2026.10.02 close from the MSE report, for the week's move. */
  prev: "66,842.06",
  source: "Trading Economics, MSE TOP-20",
  href: "https://tradingeconomics.com/mongolia/stock-market",
  monthSource: "Trading Economics",
  monthHref: "https://tradingeconomics.com/mongolia/stock-market",
  /** The exchange's own report behind the sub-indices and stock tables below. */
  reportLabel: "МХБ-ийн 2026.10.02-ны тайлан",
  reportHref: "https://mse.mn/uploads/ariljaa/reports/report_en-17.pdf",
}

export const mongoliaIndices: Quote[] = [
  {
    id: "mse-a",
    denom: { kind: "index" },
    label: "MSE A",
    price: "26,294.73",
    move: "+0.37%",
    pct: 0.37,
    asOf: "2026.10.02",
    source: "Монголын хөрөнгийн бирж",
    href: top20.reportHref,
  },
  {
    id: "mse-b",
    denom: { kind: "index" },
    label: "MSE B",
    price: "15,342.78",
    move: "+0.34%",
    pct: 0.34,
    asOf: "2026.10.02",
    source: "Монголын хөрөнгийн бирж",
    href: top20.reportHref,
  },
  {
    id: "fti",
    denom: { kind: "index" },
    label: "FTI индекс",
    price: "1,053.00",
    move: "+0.31%",
    pct: 0.31,
    asOf: "2026.10.02",
    source: "Монголын хөрөнгийн бирж",
    href: top20.reportHref,
  },
  {
    id: "cap",
    denom: { kind: "money", currency: "MNT", scale: "их наяд" },
    label: "Үнэлгээ",
    price: "16.73",
    move: "10.02 хаалт",
    pct: 0,
    asOf: "2026.10.02",
    source: "Монголын хөрөнгийн бирж",
    href: top20.reportHref,
  },
]

export const sessionStats = [
  { label: "Ширхэг", value: "3.36 сая" },
  { label: "Үнийн дүн", value: "1.36 тэрбум ₮" },
  { label: "Хэлцэл", value: "3,827" },
  { label: "Үнэт цаас", value: "62" },
]

export const fridayCloses: CloseRow[] = [
  {
    symbol: "LEND",
    name: "ЛэндМН",
    currency: "MNT",
    price: "176.39",
    move: "+11.08",
    pct: 6.7,
    volume: "219,818",
    note: "Хаалт",
  },
  {
    symbol: "TUM",
    name: "Түмэн шувуут",
    currency: "MNT",
    price: "467.42",
    move: "+16.54",
    pct: 3.67,
    volume: "35,620",
    note: "Хаалт",
  },
  {
    symbol: "BODI",
    name: "Бодь даатгал",
    currency: "MNT",
    price: "102.85",
    move: "+2.87",
    pct: 2.87,
    volume: "3,024",
    note: "Хаалт",
  },
  {
    symbol: "AIC",
    name: "Ард даатгал",
    currency: "MNT",
    price: "630.99",
    move: "−25.92",
    pct: -3.95,
    volume: "3,807",
    note: "Хаалт",
  },
  {
    symbol: "MFC",
    name: "Монос хүнс",
    currency: "MNT",
    price: "78.57",
    move: "−1.43",
    pct: -1.79,
    volume: "49,802",
    note: "Хаалт",
  },
  {
    symbol: "ADB",
    name: "Ард кредит",
    currency: "MNT",
    price: "129.40",
    move: "−2.31",
    pct: -1.75,
    volume: "23,451",
    note: "Хаалт",
  },
  {
    symbol: "ALTT",
    name: "Gold Trust ETF",
    currency: "MNT",
    price: "4,730.00",
    move: "−545.00",
    pct: -10.33,
    volume: "2,724",
    note: "Хаалт",
  },
]

export const fridayFlow: FlowRow[] = [
  {
    symbol: "MGLA",
    name: "Эм Жи Эл Акуа",
    volume: "2,199,999",
    value: "621.3 сая ₮",
    average: "282.40",
  },
  {
    symbol: "KHAN",
    name: "Хаан банк",
    volume: "—",
    value: "162.4 сая ₮",
    average: "—",
  },
  {
    symbol: "TDB",
    name: "Худалдаа хөгжлийн банк",
    volume: "—",
    value: "95.8 сая ₮",
    average: "—",
  },
  {
    symbol: "AARD",
    name: "Ард санхүүгийн нэгдэл",
    volume: "—",
    value: "93.7 сая ₮",
    average: "—",
  },
  {
    symbol: "MSE",
    name: "Монголын хөрөнгийн бирж",
    volume: "122,603",
    value: "52.0 сая ₮",
    average: "423.81",
  },
]

export const worldIndices: Quote[] = [
  {
    id: "dow",
    denom: { kind: "index" },
    label: "Dow",
    price: "51,231.64",
    move: "+51.77",
    pct: 0.1,
    asOf: "2026.10.08",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "51,176.96",
    ytd: 6.59,
  },
  {
    id: "spx",
    denom: { kind: "index" },
    label: "S&P 500",
    price: "7,765.36",
    move: "−36.41",
    pct: -0.47,
    asOf: "2026.10.08",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "7,722.72",
    ytd: 13.44,
  },
  {
    id: "nasdaq",
    denom: { kind: "index" },
    label: "Nasdaq",
    price: "27,193.34",
    move: "−345.35",
    pct: -1.25,
    asOf: "2026.10.08",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "27,190.86",
    ytd: 17.0,
  },
  {
    id: "nikkei",
    denom: { kind: "index" },
    label: "Nikkei",
    price: "69,042.11",
    move: "−993.60",
    pct: -1.42,
    asOf: "2026.10.08",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "68,309",
    ytd: 37.15,
  },
  {
    id: "dax",
    denom: { kind: "index" },
    label: "DAX",
    price: "24,806.97",
    move: "−297.39",
    pct: -1.18,
    asOf: "2026.10.08",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "25,231.20",
    ytd: 1.29,
  },
  {
    id: "ftse",
    denom: { kind: "index" },
    label: "FTSE 100",
    price: "10,441.60",
    move: "−16.90",
    pct: -0.16,
    asOf: "2026.10.08",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "10,461.95",
    ytd: 5.14,
  },
  {
    id: "cac",
    denom: { kind: "index" },
    label: "CAC 40",
    price: "7,729.69",
    move: "−39.52",
    pct: -0.51,
    asOf: "2026.10.08",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "7,897.19",
    ytd: -5.15,
  },
  {
    id: "shanghai",
    denom: { kind: "index" },
    label: "Шанхай",
    price: "3,811.90",
    move: "−30.29",
    pct: -0.79,
    asOf: "2026.10.08",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "3,842.19",
    ytd: -3.95,
  },
  {
    id: "hsi",
    denom: { kind: "index" },
    label: "Hang Seng",
    price: "24,103.00",
    move: "+425.56",
    pct: 1.79,
    asOf: "2026.10.09",
    source: "Trading Economics",
    href: "https://tradingeconomics.com/hong-kong/stock-market",
    prev: "23,972.29",
    year: -8.32,
  },
]

export const commodities: Quote[] = [
  {
    id: "brent",
    denom: { kind: "money", currency: "USD", per: "баррель" },
    label: "Brent",
    price: "102.71",
    move: "−1.51",
    pct: -1.45,
    asOf: "2026.10.09",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "102.25",
    ytd: 68.79,
  },
  {
    id: "wti",
    denom: { kind: "money", currency: "USD", per: "баррель" },
    label: "WTI",
    price: "90.29",
    move: "−1.20",
    pct: -1.31,
    asOf: "2026.10.09",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "91.11",
    ytd: 57.24,
  },
  {
    id: "gold",
    denom: { kind: "money", currency: "USD", per: "унц" },
    label: "Алт",
    price: "4,208.40",
    move: "+51.40",
    pct: 1.24,
    asOf: "2026.10.09",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "4,162.30",
    ytd: -3.06,
  },
  {
    id: "copper",
    denom: { kind: "money", currency: "USD", per: "фунт" },
    label: "Зэс",
    price: "6.6493",
    move: "+2.00%",
    pct: 2.0,
    asOf: "2026.10.09",
    source: "Trading Economics",
    href: "https://tradingeconomics.com/commodity/copper",
    prev: "6.4920",
    year: 38.59,
  },
  {
    id: "coal",
    denom: { kind: "money", currency: "USD", per: "тонн" },
    label: "Нүүрс · Ньюкасл",
    price: "149.45",
    move: "−0.53%",
    pct: -0.53,
    asOf: "2026.10.08",
    source: "Trading Economics",
    href: "https://tradingeconomics.com/commodity/coal",
    prev: "148.95",
    year: 43.01,
  },
]

export const fx: Quote[] = [
  {
    id: "mnt",
    denom: { kind: "fx", base: "USD", quote: "MNT" },
    label: "Ам.доллар/төгрөг",
    price: "3,597.35",
    move: "зах зээлийн дунд ханш",
    pct: 0,
    asOf: "2026.10.09",
    source: "XE",
    href: "https://www.xe.com/en-us/currencyconverter/convert/?Amount=1&From=USD&To=MNT",
  },
  {
    id: "eur",
    denom: { kind: "fx", base: "EUR", quote: "USD" },
    label: "Евро/ам.доллар",
    price: "1.1227",
    move: "0.0000",
    pct: 0,
    asOf: "2026.10.09",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "1.1255",
    ytd: -4.41,
  },
  {
    id: "jpy",
    denom: { kind: "fx", base: "USD", quote: "JPY" },
    label: "Ам.доллар/иен",
    price: "158.10",
    move: "+0.22",
    pct: 0.14,
    asOf: "2026.10.09",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "157.85",
    ytd: 1.05,
  },
  {
    id: "cny",
    denom: { kind: "fx", base: "USD", quote: "CNY" },
    label: "Ам.доллар/юань",
    price: "6.6975",
    move: "−0.0100",
    pct: -0.15,
    asOf: "2026.10.09",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-09-10-2026",
    prev: "6.7064",
    ytd: -4.17,
  },
  {
    id: "ust",
    denom: { kind: "percent" },
    label: "АНУ 10 жил",
    price: "5.26%",
    move: "+0.02 нэгж",
    pct: 0,
    asOf: "2026.10.09",
    source: "Trading Economics",
    href: "https://tradingeconomics.com/united-states/government-bond-yield",
    prev: "5.283%",
  },
]

export const miners: CloseRow[] = [
  {
    symbol: "SCCO",
    name: "Southern Copper",
    currency: "USD",
    price: "205.54",
    move: "+3.17%",
    pct: 3.17,
    volume: "—",
    note: "ам.доллар",
  },
  {
    symbol: "FCX",
    name: "Freeport-McMoRan",
    currency: "USD",
    price: "72.04",
    move: "+3.98%",
    pct: 3.98,
    volume: "—",
    note: "ам.доллар",
  },
]

/**
 * US Treasury yields by maturity, Friday 2026.10.09 (Trading Economics). One
 * country, one date, so the points can share an axis. The 10-year touched
 * 5.35% on 10.08, its highest since 2002.
 */
export const usCurve = {
  asOf: "2026.10.09",
  source: "Trading Economics",
  href: "https://tradingeconomics.com/united-states/government-bond-yield",
  high10: 5.35,
  points: [
    { label: "2 жил", years: 2, yield: 4.79 },
    { label: "10 жил", years: 10, yield: 5.26 },
    { label: "30 жил", years: 30, yield: 5.63 },
  ],
  japan10: { yield: 3.02, asOf: "2026.10.09", href: "https://tradingeconomics.com/japan/government-bond-yield" },
}

/** Mongolia's headline numbers, each with its own date and source (see the 10.08–09 briefings). */
export const mongoliaMacro = {
  inflation: { value: 12.9, label: "2026.09", source: "ҮСХ (AKIpress)", href: "https://akipress.com/news:923934" },
  policyRate: { value: 12.5, label: "2026.09.17", source: "Монголбанк", href: "https://www.mongolbank.mn/en/r/13002" },
  target: "6±2%",
  reserves: { value: 8.9, label: "2026.09 эцэс", source: "Синьхуа", href: "https://english.news.cn/20261007/8d4942aeaa414d1b814281ceffeb51f4/c.html" },
  reservesGoal: 10,
}

/**
 * Exports, January–September 2026, billion US dollars (Ministry of Economy and
 * Development via MI24). "Other mining" is the mining total (15.8) less copper
 * and coal; the four parts add up to the 16.6 total.
 */
export const exportMix = {
  total: 16.6,
  growth: 54,
  label: "2026 оны 1–9 сар",
  source: "Эдийн засаг, хөгжлийн яам (MI24)",
  href: "https://mongoliadaily.substack.com/p/mi24-morning-brief-for-thursday-october-993",
  parts: [
    { key: "copper", label: "Зэсийн баяжмал", value: 7.1, growth: 79 },
    { key: "coal", label: "Нүүрс", value: 6.1, growth: 50 },
    { key: "mining", label: "Бусад уул уурхай", value: 2.6 },
    { key: "other", label: "Уул уурхайн бус", value: 0.8, growth: 9 },
  ],
}
