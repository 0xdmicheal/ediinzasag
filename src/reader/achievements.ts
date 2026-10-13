import { topicLabel } from "@/content/stories"
import type { LibraryItem } from "@/reader/library-items"
import type { LibraryEntry } from "@/reader/types"

/*
 * Points, levels and merits (Гавьяа), worked out from the reader's history every
 * time instead of stored, so they can never drift from what was read. Only
 * stories and letters that still exist count. Days, hours and weekends are
 * Ulaanbaatar time, like the database.
 *
 * Keep the rules and point values in step with public.reader_points() in
 * supabase/schema.sql: the database recomputes the same total before any badge
 * is bought.
 */

export const POINTS_PER_READ = 5

/** Merits come in four metals; the harder the metal, the more it is worth. */
export type Tier = "bronze" | "silver" | "gold" | "legend"

export const tiers: Record<Tier, { label: string; points: number }> = {
  bronze: { label: "Хүрэл", points: 20 },
  silver: { label: "Мөнгө", points: 60 },
  gold: { label: "Алт", points: 150 },
  legend: { label: "Домог", points: 400 },
}

export const levels = [
  { min: 0, label: "Шинэ уншигч" },
  { min: 200, label: "Уншигч" },
  { min: 600, label: "Идэвхтэй уншигч" },
  { min: 1500, label: "Шинжээч" },
  { min: 3500, label: "Эдийн засагч" },
  { min: 7000, label: "Ахлах эдийн засагч" },
]

export type AchievementIcon =
  | "footprints"
  | "eye"
  | "book"
  | "pickaxe"
  | "archive"
  | "calendar"
  | "flame"
  | "hundred"
  | "crown"
  | "globe"
  | "compass"
  | "mail"
  | "bookmark"
  | "moon"
  | "sunrise"
  | "coffee"

export interface Achievement {
  id: string
  title: string
  description: string
  icon: AchievementIcon
  tier: Tier
  progress: number
  goal: number
  unlocked: boolean
}

const UB = "Asia/Ulaanbaatar"

/** Ulaanbaatar calendar day, hour and weekday of a moment. */
function ub(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: UB, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekend: parts.weekday === "Sat" || parts.weekday === "Sun" }
}

function shiftDay(key: string, by: number) {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + by)
  return date.toISOString().slice(0, 10)
}

/** Current streak (ending today or yesterday) and best streak, in days with at least one finished story. */
export function streaks(reads: LibraryEntry[], now = new Date()) {
  const days = new Set(reads.map((entry) => ub(entry.at).day))
  let best = 0
  for (const key of days) {
    if (days.has(shiftDay(key, -1))) continue
    let length = 1
    // Walk forward from each streak's first day.
    while (days.has(shiftDay(key, length))) length++
    best = Math.max(best, length)
  }
  const today = ub(now.toISOString()).day
  let cursor = days.has(today) ? today : shiftDay(today, -1)
  let current = 0
  while (days.has(cursor)) {
    current++
    cursor = shiftDay(cursor, -1)
  }
  return { current, best }
}

export function readerProgress(reads: LibraryEntry[], saved: LibraryEntry[], items: Map<string, LibraryItem>, granted = 0) {
  const kept = reads.filter((entry) => items.has(entry.slug))
  const finished = kept.map((entry) => items.get(entry.slug)!)
  const keptSaved = saved.filter((entry) => items.has(entry.slug))
  const mongolia = finished.filter((item) => item.desk === "mongolia").length
  const world = finished.filter((item) => item.desk === "world").length
  const topics = new Set(finished.flatMap((item) => item.topic ?? []))
  const topicGoal = Object.keys(topicLabel).length
  const letters = kept.filter((entry) => entry.slug.startsWith("letter-")).length
  const moments = kept.map((entry) => ub(entry.at))
  const night = moments.filter((moment) => moment.hour < 5).length
  const dawn = moments.filter((moment) => moment.hour >= 5 && moment.hour < 8).length
  const weekendDays = new Set(moments.filter((moment) => moment.weekend).map((moment) => moment.day)).size
  const streak = streaks(kept)
  const n = finished.length

  const rules: Omit<Achievement, "unlocked">[] = [
    { id: "first-read", title: "Анхны алхам", description: "Анхны тойм, нийтлэлээ эцэс хүртэл уншсан", icon: "footprints", tier: "bronze", progress: n, goal: 1 },
    { id: "reads-25", title: "Сониуч", description: "25 тойм, нийтлэл уншсан", icon: "eye", tier: "bronze", progress: n, goal: 25 },
    { id: "reads-100", title: "Номын хорхой", description: "100 тойм, нийтлэл уншсан", icon: "book", tier: "silver", progress: n, goal: 100 },
    { id: "reads-300", title: "Мэдлэгийн уурхай", description: "300 тойм, нийтлэл уншсан", icon: "pickaxe", tier: "gold", progress: n, goal: 300 },
    { id: "reads-1000", title: "Амьд архив", description: "1,000 тойм, нийтлэл уншсан", icon: "archive", tier: "legend", progress: n, goal: 1000 },
    { id: "streak-7", title: "Долоо хоног", description: "7 өдөр дараалан уншсан", icon: "calendar", tier: "bronze", progress: streak.best, goal: 7 },
    { id: "streak-30", title: "Бүтэн сар", description: "30 өдөр дараалан уншсан", icon: "flame", tier: "silver", progress: streak.best, goal: 30 },
    { id: "streak-100", title: "Зуун өдөр", description: "100 өдөр дараалан уншсан", icon: "hundred", tier: "gold", progress: streak.best, goal: 100 },
    { id: "streak-365", title: "Жилийн тангараг", description: "365 өдөр дараалан уншсан", icon: "crown", tier: "legend", progress: streak.best, goal: 365 },
    { id: "both-desks", title: "Хоёр ертөнц", description: "Монгол, Дэлхий тус бүрээс 20-иос дээш уншсан", icon: "globe", tier: "silver", progress: Math.min(mongolia, world), goal: 20 },
    { id: "all-topics", title: "Бүх салбар", description: `${topicGoal} сэдэв бүрээс уншсан`, icon: "compass", tier: "gold", progress: topics.size, goal: topicGoal },
    { id: "letters-10", title: "Захидлын нөхөр", description: "Нийтлэл хэсгээс 10 захидал уншсан", icon: "mail", tier: "silver", progress: letters, goal: 10 },
    { id: "saved-25", title: "Цуглуулагч", description: "25 тойм, нийтлэл хадгалсан", icon: "bookmark", tier: "bronze", progress: keptSaved.length, goal: 25 },
    { id: "night-10", title: "Шөнийн шувуу", description: "Шөнө 00:00–05:00 хооронд 10 удаа уншсан", icon: "moon", tier: "silver", progress: night, goal: 10 },
    { id: "dawn-10", title: "Үүрийн гэгээ", description: "Өглөө 05:00–08:00 хооронд 10 удаа уншсан", icon: "sunrise", tier: "silver", progress: dawn, goal: 10 },
    { id: "weekend-10", title: "Амралтын уншигч", description: "10 өөр амралтын өдөр уншсан", icon: "coffee", tier: "bronze", progress: weekendDays, goal: 10 },
  ]
  const achievements: Achievement[] = rules.map((rule) => ({
    ...rule,
    progress: Math.min(rule.progress, rule.goal),
    unlocked: rule.progress >= rule.goal,
  }))
  const unlockedList = achievements.filter((item) => item.unlocked)
  const fromReads = n * POINTS_PER_READ
  const fromMerits = unlockedList.reduce((sum, item) => sum + tiers[item.tier].points, 0)
  const points = fromReads + fromMerits + granted
  const levelIndex = levels.findLastIndex((level) => points >= level.min)
  const next = levels[levelIndex + 1]

  return {
    /** Everything earned, before badges are bought. */
    points,
    /** Where the points came from, for the ledger. */
    earned: {
      reads: n,
      fromReads,
      fromMerits,
      granted,
      byTier: (Object.keys(tiers) as Tier[]).map((tier) => ({ tier, count: unlockedList.filter((item) => item.tier === tier).length })),
    },
    level: levels[levelIndex].label,
    next: next ? { label: next.label, remaining: next.min - points, share: (points - levels[levelIndex].min) / (next.min - levels[levelIndex].min) } : null,
    finished: n,
    saved: keptSaved.length,
    streak,
    achievements,
    unlocked: unlockedList.length,
  }
}
