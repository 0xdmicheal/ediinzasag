import { hasSupabase } from "@/lib/supabase-env"
import { CURRENCIES, ECONOMIES } from "../../supabase/functions/_shared/large-caps.ts"

/*
 * Markets → Календарь data: what supabase/functions/market-calendar stores
 * (econ_events + econ_glossary, earnings_events). Without Supabase (demo) a
 * small sample shows the layout.
 */

export interface EconEvent {
  id: string
  startsAt: string
  currency: string
  country: string
  flag: string
  impact: "High" | "Medium"
  title: string
  /** Gemini's Mongolian name and explanation; empty until the glossary has the indicator. */
  mnTitle: string
  mnSummary: string
  forecast: string
  previous: string
  actual: string
}

export interface EarningsEvent {
  symbol: string
  country: string
  countryName: string
  flag: string
  name: string
  currency: string
  reportDate: string
  epsEstimate: number | null
  revenueEstimate: number | null
  price: number | null
  targetMean: number | null
  targetLow: number | null
  targetHigh: number | null
  analysts: number | null
  recommendation: string
  mnSummary: string
}

export interface CalendarData {
  econ: EconEvent[]
  earnings: EarningsEvent[]
  updatedAt: string | null
  demo: boolean
}

const economy = (code: string) => ECONOMIES.find((item) => item.code === code)

export const recommendationLabel: Record<string, string> = {
  strong_buy: "Хүчтэй худалдаж авах",
  buy: "Худалдаж авах",
  hold: "Хадгалах",
  underperform: "Сул гүйцэтгэл",
  sell: "Зарах",
}

interface EconRow {
  id: string
  starts_at: string
  currency: string
  title: string
  impact: "High" | "Medium"
  forecast: string
  previous: string
  actual: string
  updated_at: string
}

interface EarningsRow {
  symbol: string
  country: string
  name: string
  currency: string
  report_date: string
  eps_estimate: number | null
  revenue_estimate: number | null
  price: number | null
  target_mean: number | null
  target_low: number | null
  target_high: number | null
  analysts: number | null
  recommendation: string
  mn_summary: string
  updated_at: string
}

export async function loadCalendar(): Promise<CalendarData> {
  if (!hasSupabase) return demoCalendar()
  const { supabaseClient } = await import("@/lib/supabase")
  const db = supabaseClient()
  const today = new Date()
  const from = new Date(today.getTime() - 86_400_000).toISOString()
  const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10)
  const [events, glossary, earnings] = await Promise.all([
    db.from("econ_events").select("*").gte("starts_at", from).order("starts_at"),
    db.from("econ_glossary").select("title, currency, mn_title, mn_summary"),
    db.from("earnings_events").select("*").gte("report_date", day(0)).lte("report_date", day(60)).order("report_date"),
  ])
  if (events.error) throw events.error
  if (earnings.error) throw earnings.error
  const words = new Map((glossary.data ?? []).map((row: { title: string; currency: string; mn_title: string; mn_summary: string }) => [`${row.title}|${row.currency}`, row]))
  const econRows = (events.data ?? []) as EconRow[]
  const earningsRows = (earnings.data ?? []) as EarningsRow[]
  const stamps = [...econRows, ...earningsRows].map((row) => row.updated_at).sort()
  return {
    demo: false,
    updatedAt: stamps.at(-1) ?? null,
    econ: econRows.map((row) => {
      const mn = words.get(`${row.title}|${row.currency}`)
      const place = CURRENCIES[row.currency]
      return {
        id: row.id,
        startsAt: row.starts_at,
        currency: row.currency,
        country: place?.mn ?? row.currency,
        flag: place?.flag ?? "",
        impact: row.impact,
        title: row.title,
        mnTitle: mn?.mn_title ?? "",
        mnSummary: mn?.mn_summary ?? "",
        forecast: row.forecast,
        previous: row.previous,
        actual: row.actual,
      }
    }),
    earnings: earningsRows.map((row) => ({
      symbol: row.symbol,
      country: row.country,
      countryName: economy(row.country)?.mn ?? row.country,
      flag: economy(row.country)?.flag ?? "",
      name: row.name,
      currency: row.currency,
      reportDate: row.report_date,
      epsEstimate: row.eps_estimate,
      revenueEstimate: row.revenue_estimate,
      price: row.price,
      targetMean: row.target_mean,
      targetLow: row.target_low,
      targetHigh: row.target_high,
      analysts: row.analysts,
      recommendation: row.recommendation,
      mnSummary: row.mn_summary,
    })),
  }
}

/** Demo mode (no Supabase): a few rows, marked as samples, so the layout can be seen. */
function demoCalendar(): CalendarData {
  const at = (days: number, hour: number) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + days)
    date.setUTCHours(hour, 30, 0, 0)
    return date.toISOString()
  }
  const date = (days: number) => at(days, 0).slice(0, 10)
  return {
    demo: true,
    updatedAt: null,
    econ: [
      { id: "d1", startsAt: at(1, 12), currency: "USD", country: "АНУ", flag: "🇺🇸", impact: "High", title: "CPI y/y", mnTitle: "Жишээ: АНУ-ын инфляц (CPI), жилээр", mnSummary: "Хэрэглээний үнийн индекс. Холбооны нөөцийн сан хүүгээ тогтооход хамгийн их хардаг үзүүлэлтийн нэг.", forecast: "3.6%", previous: "3.4%", actual: "" },
      { id: "d2", startsAt: at(2, 2), currency: "CNY", country: "Хятад", flag: "🇨🇳", impact: "High", title: "GDP q/y", mnTitle: "Жишээ: Хятадын ДНБ-ий өсөлт, улирлаар", mnSummary: "Хятадын эдийн засгийн өсөлт. Монголын зэс, нүүрсний эрэлтэд шууд нөлөөлдөг.", forecast: "4.6%", previous: "4.8%", actual: "" },
      { id: "d3", startsAt: at(2, 6), currency: "GBP", country: "Их Британи", flag: "🇬🇧", impact: "Medium", title: "GDP m/m", mnTitle: "Жишээ: Их Британийн ДНБ, сараар", mnSummary: "Их Британийн эдийн засгийн сарын өөрчлөлт.", forecast: "-0.1%", previous: "0.4%", actual: "" },
    ],
    earnings: [
      { symbol: "JPM", country: "US", countryName: "АНУ", flag: "🇺🇸", name: "Жишээ: JPMorgan Chase", currency: "USD", reportDate: date(1), epsEstimate: 5.94, revenueEstimate: 51.2e9, price: 333, targetMean: 372, targetLow: 305, targetHigh: 420, analysts: 22, recommendation: "buy", mnSummary: "Шинжээчид энэ улиралд нэгж хувьцаанд ногдох ашгийг 5.94 ам.доллар гэж хүлээж байна. Дундаж зорилтот үнэ одоогийнхоос 11.8 хувиар өндөр, зөвлөмж нь «худалдаж авах»." },
      { symbol: "7203.T", country: "JP", countryName: "Япон", flag: "🇯🇵", name: "Жишээ: Toyota Motor", currency: "JPY", reportDate: date(5), epsEstimate: 82.1, revenueEstimate: 12.4e12, price: 3120, targetMean: 3699, targetLow: 2700, targetHigh: 4500, analysts: 19, recommendation: "buy", mnSummary: "" },
    ],
  }
}
