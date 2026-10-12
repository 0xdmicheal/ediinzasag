/*
 * The earnings calendar's companies: the largest listed companies of the 20
 * biggest economies (IMF GDP ranking), as Yahoo Finance tickers. Checked against
 * Yahoo on 2026-10-12; Russia is left out (no data under sanctions). Add or
 * remove freely; a ticker Yahoo can't find is skipped and reported in the run.
 * Shared by the market-calendar function and the site; imports nothing.
 */

export interface Economy {
  code: string
  /** Mongolian country name for the calendar. */
  mn: string
  flag: string
}

export const ECONOMIES: Economy[] = [
  { code: "US", mn: "АНУ", flag: "🇺🇸" },
  { code: "CN", mn: "Хятад", flag: "🇨🇳" },
  { code: "DE", mn: "Герман", flag: "🇩🇪" },
  { code: "JP", mn: "Япон", flag: "🇯🇵" },
  { code: "IN", mn: "Энэтхэг", flag: "🇮🇳" },
  { code: "GB", mn: "Их Британи", flag: "🇬🇧" },
  { code: "FR", mn: "Франц", flag: "🇫🇷" },
  { code: "IT", mn: "Итали", flag: "🇮🇹" },
  { code: "CA", mn: "Канад", flag: "🇨🇦" },
  { code: "BR", mn: "Бразил", flag: "🇧🇷" },
  { code: "MX", mn: "Мексик", flag: "🇲🇽" },
  { code: "AU", mn: "Австрали", flag: "🇦🇺" },
  { code: "KR", mn: "Өмнөд Солонгос", flag: "🇰🇷" },
  { code: "ES", mn: "Испани", flag: "🇪🇸" },
  { code: "ID", mn: "Индонез", flag: "🇮🇩" },
  { code: "NL", mn: "Нидерланд", flag: "🇳🇱" },
  { code: "TR", mn: "Турк", flag: "🇹🇷" },
  { code: "SA", mn: "Саудын Араб", flag: "🇸🇦" },
  { code: "CH", mn: "Швейцари", flag: "🇨🇭" },
]

export const LARGE_CAPS: { country: string; symbol: string }[] = [
  ...["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "BRK-B", "JPM", "LLY", "V", "XOM", "WMT"].map((symbol) => ({ country: "US", symbol })),
  ...["0700.HK", "9988.HK", "1398.HK", "0939.HK", "3690.HK", "1211.HK", "601318.SS", "600519.SS"].map((symbol) => ({ country: "CN", symbol })),
  ...["SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "MBG.DE"].map((symbol) => ({ country: "DE", symbol })),
  ...["7203.T", "8306.T", "6758.T", "9984.T", "6861.T"].map((symbol) => ({ country: "JP", symbol })),
  ...["RELIANCE.NS", "HDFCBANK.NS", "TCS.NS", "INFY.NS", "BHARTIARTL.NS"].map((symbol) => ({ country: "IN", symbol })),
  ...["AZN.L", "SHEL.L", "HSBA.L", "ULVR.L", "RIO.L"].map((symbol) => ({ country: "GB", symbol })),
  ...["MC.PA", "OR.PA", "TTE.PA", "SAN.PA", "AIR.PA"].map((symbol) => ({ country: "FR", symbol })),
  ...["ENEL.MI", "ISP.MI", "UCG.MI", "RACE.MI"].map((symbol) => ({ country: "IT", symbol })),
  ...["RY.TO", "SHOP.TO", "TD.TO", "ENB.TO"].map((symbol) => ({ country: "CA", symbol })),
  ...["PETR4.SA", "VALE3.SA", "ITUB4.SA"].map((symbol) => ({ country: "BR", symbol })),
  ...["WALMEX.MX", "AMXB.MX", "GFNORTEO.MX"].map((symbol) => ({ country: "MX", symbol })),
  ...["CBA.AX", "BHP.AX", "CSL.AX"].map((symbol) => ({ country: "AU", symbol })),
  ...["005930.KS", "000660.KS", "373220.KS"].map((symbol) => ({ country: "KR", symbol })),
  ...["ITX.MC", "SAN.MC", "IBE.MC"].map((symbol) => ({ country: "ES", symbol })),
  ...["BBCA.JK", "BBRI.JK", "TLKM.JK"].map((symbol) => ({ country: "ID", symbol })),
  ...["ASML.AS", "PRX.AS", "INGA.AS"].map((symbol) => ({ country: "NL", symbol })),
  ...["THYAO.IS", "BIMAS.IS", "KCHOL.IS"].map((symbol) => ({ country: "TR", symbol })),
  ...["2222.SR", "1120.SR", "2010.SR"].map((symbol) => ({ country: "SA", symbol })),
  ...["NESN.SW", "NOVN.SW", "UBSG.SW"].map((symbol) => ({ country: "CH", symbol })),
]

/** Forex Factory lists events by currency; these are the countries we show and their Mongolian names. */
export const CURRENCIES: Record<string, { mn: string; flag: string }> = {
  USD: { mn: "АНУ", flag: "🇺🇸" },
  EUR: { mn: "Евро бүс", flag: "🇪🇺" },
  CNY: { mn: "Хятад", flag: "🇨🇳" },
  JPY: { mn: "Япон", flag: "🇯🇵" },
  GBP: { mn: "Их Британи", flag: "🇬🇧" },
  CAD: { mn: "Канад", flag: "🇨🇦" },
  AUD: { mn: "Австрали", flag: "🇦🇺" },
  NZD: { mn: "Шинэ Зеланд", flag: "🇳🇿" },
  CHF: { mn: "Швейцари", flag: "🇨🇭" },
  ALL: { mn: "Дэлхий", flag: "🌐" },
}
