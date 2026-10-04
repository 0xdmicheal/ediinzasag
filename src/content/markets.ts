/** Friday 2 October 2026 closes. Sunday 4 October the exchanges were shut. */

export interface Quote {
  id: string
  label: string
  price: string
  move: string
  pct: number
  asOf: string
  source: string
  href?: string
  unit?: string
}

export interface CloseRow {
  symbol: string
  name: string
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

export const sessionLabel = "2026.10.02 · Баасан гарагийн хаалт"
export const sessionNote =
  "2026.10.04 ням гарагт бирж хаалттай. Доорх тоо баасан гарагийн нэрлэсэн хаалт. Шууд ханш биш."

export const top20 = {
  price: "66,842.06",
  move: "+323.57",
  pct: 0.49,
  month: "+6.66%",
  year: "+35.71%",
  high: "67,367.47",
  highWhen: "2026.09",
  source: "Монголын хөрөнгийн бирж, өдрийн тайлан",
  href: "https://mse.mn/uploads/ariljaa/reports/report_en-17.pdf",
  monthSource: "Trading Economics",
  monthHref: "https://tradingeconomics.com/mongolia/stock-market",
}

export const mongoliaIndices: Quote[] = [
  {
    id: "mse-a",
    label: "MSE A",
    price: "26,294.73",
    move: "+0.37%",
    pct: 0.37,
    asOf: "2026.10.02",
    source: "Монголын хөрөнгийн бирж",
    href: top20.href,
  },
  {
    id: "mse-b",
    label: "MSE B",
    price: "15,342.78",
    move: "+0.34%",
    pct: 0.34,
    asOf: "2026.10.02",
    source: "Монголын хөрөнгийн бирж",
    href: top20.href,
  },
  {
    id: "fti",
    label: "FTI индекс",
    price: "1,053.00",
    move: "+0.31%",
    pct: 0.31,
    asOf: "2026.10.02",
    source: "Монголын хөрөнгийн бирж",
    href: top20.href,
  },
  {
    id: "cap",
    label: "Үнэлгээ",
    price: "16.73",
    unit: "их наяд ₮",
    move: "10.02 хаалт",
    pct: 0,
    asOf: "2026.10.02",
    source: "Монголын хөрөнгийн бирж",
    href: top20.href,
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
    price: "176.39",
    move: "+11.08",
    pct: 6.7,
    volume: "219,818",
    note: "Хаалт",
  },
  {
    symbol: "TUM",
    name: "Түмэн шувуут",
    price: "467.42",
    move: "+16.54",
    pct: 3.67,
    volume: "35,620",
    note: "Хаалт",
  },
  {
    symbol: "BODI",
    name: "Бодь даатгал",
    price: "102.85",
    move: "+2.87",
    pct: 2.87,
    volume: "3,024",
    note: "Хаалт",
  },
  {
    symbol: "AIC",
    name: "Ард даатгал",
    price: "630.99",
    move: "−25.92",
    pct: -3.95,
    volume: "3,807",
    note: "Хаалт",
  },
  {
    symbol: "MFC",
    name: "Монос хүнс",
    price: "78.57",
    move: "−1.43",
    pct: -1.79,
    volume: "49,802",
    note: "Хаалт",
  },
  {
    symbol: "ADB",
    name: "Ард кредит",
    price: "129.40",
    move: "−2.31",
    pct: -1.75,
    volume: "23,451",
    note: "Хаалт",
  },
  {
    symbol: "ALTT",
    name: "Gold Trust ETF",
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
    label: "Dow",
    price: "51,176.96",
    move: "+250.40",
    pct: 0.49,
    asOf: "2026.10.02",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "spx",
    label: "S&P 500",
    price: "7,722.72",
    move: "+56.27",
    pct: 0.73,
    asOf: "2026.10.02",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "nasdaq",
    label: "Nasdaq",
    price: "27,190.86",
    move: "+319.26",
    pct: 1.19,
    asOf: "2026.10.02",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "nikkei",
    label: "Nikkei",
    price: "68,309",
    move: "−647",
    pct: -0.94,
    asOf: "2026.10.02",
    source: "Trading Economics",
    href: "https://tradingeconomics.com/mongolia/stock-market",
  },
  {
    id: "hsi",
    label: "Hang Seng",
    price: "23,972.29",
    move: "−640.98",
    pct: -2.6,
    asOf: "2026.10.02",
    source: "Dow Jones",
    href: "https://www.morningstar.com/news/dow-jones/202610022168/hang-seng-index-falls-219-this-week-to-2397229-data-talk",
  },
  {
    id: "dax",
    label: "DAX",
    price: "25,231.20",
    move: "+291.85",
    pct: 1.17,
    asOf: "2026.10.02",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "ftse",
    label: "FTSE 100",
    price: "10,461.95",
    move: "+33.68",
    pct: 0.32,
    asOf: "2026.10.02",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "cac",
    label: "CAC 40",
    price: "7,897.19",
    move: "+61.88",
    pct: 0.79,
    asOf: "2026.10.02",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "asx",
    label: "ASX 200",
    price: "8,682",
    move: "+0.79%",
    pct: 0.79,
    asOf: "2026.10.02",
    source: "Trading Economics",
    href: "https://tradingeconomics.com/mongolia/stock-market",
  },
  {
    id: "shanghai",
    label: "Шанхай",
    price: "3,842.19",
    move: "+0.31%",
    pct: 0.31,
    asOf: "2026.09.30",
    source: "Trading Economics",
    href: "https://tradingeconomics.com/hong-kong/stock-market",
  },
]

export const commodities: Quote[] = [
  {
    id: "brent",
    label: "Brent",
    price: "102.25",
    unit: "ам.доллар",
    move: "−0.06",
    pct: -0.06,
    asOf: "2026.10.03",
    source: "Reuters",
    href: "https://www.brecorder.com/news/40442436",
  },
  {
    id: "wti",
    label: "WTI",
    price: "91.11",
    unit: "ам.доллар",
    move: "−1.76",
    pct: -1.9,
    asOf: "2026.10.03",
    source: "Reuters",
    href: "https://www.brecorder.com/news/40442436",
  },
  {
    id: "gold",
    label: "Алт",
    price: "4,162.30",
    unit: "ам.доллар/унц",
    move: "−52.60",
    pct: -1.25,
    asOf: "2026.10.03",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "copper",
    label: "Зэс",
    price: "6.4920",
    unit: "ам.доллар/фунт",
    move: "+0.15%",
    pct: 0.15,
    asOf: "2026.10.02",
    source: "Dow Jones",
    href: "https://www.morningstar.com/news/dow-jones/202610025162/comex-copper-ends-the-week-310-lower-at-64920-data-talk",
  },
  {
    id: "coal",
    label: "Нүүрс",
    price: "148.95",
    unit: "Ньюкасл, ам.доллар",
    move: "−0.23%",
    pct: -0.23,
    asOf: "2026.10.02",
    source: "Investing.com",
    href: "https://cn.investing.com/commodities/newcastle-coal-futures-historical-data",
  },
]

export const fx: Quote[] = [
  {
    id: "eur",
    label: "Евро/ам.доллар",
    price: "1.1255",
    move: "+0.0003",
    pct: 0.03,
    asOf: "2026.10.03",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "jpy",
    label: "Ам.доллар/иен",
    price: "157.85",
    move: "0.00",
    pct: 0,
    asOf: "2026.10.03",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "cny",
    label: "Ам.доллар/юань",
    price: "6.7064",
    move: "0.00",
    pct: 0,
    asOf: "2026.10.03",
    source: "Report.az",
    href: "https://report.az/en/finance/key-indicators-of-world-commodity-stock-and-currency-markets-03-10-2026",
  },
  {
    id: "ust",
    label: "АНУ 10 жил",
    price: "5.283%",
    move: "өндөр хэвээр",
    pct: 0,
    asOf: "2026.10.03",
    source: "Rio Times",
    href: "https://www.riotimesonline.com/global-economy-briefing-october-3-2026/",
  },
]

export const miners: CloseRow[] = [
  {
    symbol: "SCCO",
    name: "Southern Copper",
    price: "205.54",
    move: "+3.17%",
    pct: 3.17,
    volume: "—",
    note: "ам.доллар",
  },
  {
    symbol: "FCX",
    name: "Freeport-McMoRan",
    price: "72.04",
    move: "+3.98%",
    pct: 3.98,
    volume: "—",
    note: "ам.доллар",
  },
]
