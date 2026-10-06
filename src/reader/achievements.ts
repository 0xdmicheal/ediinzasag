import { topicLabel } from "@/content/stories"
import type { LibraryItem } from "@/reader/library-items"
import type { LibraryEntry } from "@/reader/types"

/*
 * Points, levels and achievements, worked out from the reader's history every
 * time instead of stored, so they can never drift from what was read.
 * Only stories and letters that still exist count. Nobody else sees these numbers; a
 * public leaderboard would need them computed in the database instead.
 */

export const POINTS_PER_READ = 10
export const POINTS_PER_ACHIEVEMENT = 50

export const levels = [
  { min: 0, label: "Шинэ уншигч" },
  { min: 100, label: "Уншигч" },
  { min: 300, label: "Идэвхтэй уншигч" },
  { min: 700, label: "Шинжээч" },
  { min: 1500, label: "Эдийн засагч" },
]

export type AchievementIcon = "book" | "books" | "library" | "globe" | "compass" | "bookmark" | "flame" | "trophy"

export interface Achievement {
  id: string
  title: string
  description: string
  icon: AchievementIcon
  progress: number
  goal: number
  unlocked: boolean
}

/** Local calendar day, so a streak follows the reader's own midnight. */
function day(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function previousDay(key: string) {
  const [year, month, date] = key.split("-").map(Number)
  return day(new Date(year, month - 1, date - 1).toISOString())
}

/** Current streak (ending today or yesterday) and best streak, in days with at least one finished story. */
export function streaks(reads: LibraryEntry[], now = new Date()) {
  const days = new Set(reads.map((entry) => day(entry.at)))
  let best = 0
  for (const key of days) {
    if (days.has(previousDay(key))) continue
    let length = 1
    let cursor = key
    // Walk forward from each streak's first day.
    for (;;) {
      const [year, month, date] = cursor.split("-").map(Number)
      const next = day(new Date(year, month - 1, date + 1).toISOString())
      if (!days.has(next)) break
      length++
      cursor = next
    }
    best = Math.max(best, length)
  }
  const today = day(now.toISOString())
  let cursor = days.has(today) ? today : previousDay(today)
  let current = 0
  while (days.has(cursor)) {
    current++
    cursor = previousDay(cursor)
  }
  return { current, best }
}

export function readerProgress(reads: LibraryEntry[], saved: LibraryEntry[], items: Map<string, LibraryItem>) {
  const finished = reads.flatMap((entry) => items.get(entry.slug) ?? [])
  const keptSaved = saved.filter((entry) => items.has(entry.slug))
  const desks = new Set(finished.flatMap((item) => item.desk ?? []))
  const topics = new Set(finished.flatMap((item) => item.topic ?? []))
  const topicGoal = Math.min(5, Object.keys(topicLabel).length)
  const streak = streaks(reads.filter((entry) => items.has(entry.slug)))

  const rules: Omit<Achievement, "unlocked">[] = [
    { id: "first-read", title: "Анхны тойм", description: "Нэг тойм эсвэл нийтлэлийг эцэс хүртэл уншсан", icon: "book", progress: finished.length, goal: 1 },
    { id: "reads-10", title: "Арван тойм", description: "10 тойм, нийтлэл уншсан", icon: "books", progress: finished.length, goal: 10 },
    { id: "reads-50", title: "Тогтмол уншигч", description: "50 тойм, нийтлэл уншсан", icon: "library", progress: finished.length, goal: 50 },
    { id: "both-desks", title: "Хоёр ширээ", description: "Монгол ба Дэлхий хоёуланг уншсан", icon: "globe", progress: desks.size, goal: 2 },
    { id: "topics", title: "Олон талт", description: `${topicGoal} өөр сэдвээр уншсан`, icon: "compass", progress: topics.size, goal: topicGoal },
    { id: "saved-5", title: "Цуглуулагч", description: "5 тойм, нийтлэл хадгалсан", icon: "bookmark", progress: keptSaved.length, goal: 5 },
    { id: "streak-3", title: "Гурван өдөр", description: "3 өдөр дараалан уншсан", icon: "flame", progress: streak.best, goal: 3 },
    { id: "streak-7", title: "Долоо хоног", description: "7 өдөр дараалан уншсан", icon: "trophy", progress: streak.best, goal: 7 },
  ]
  const achievements: Achievement[] = rules.map((rule) => ({
    ...rule,
    progress: Math.min(rule.progress, rule.goal),
    unlocked: rule.progress >= rule.goal,
  }))
  const unlocked = achievements.filter((item) => item.unlocked).length
  const points = finished.length * POINTS_PER_READ + unlocked * POINTS_PER_ACHIEVEMENT
  const levelIndex = levels.findLastIndex((level) => points >= level.min)
  const next = levels[levelIndex + 1]

  return {
    points,
    level: levels[levelIndex].label,
    next: next ? { label: next.label, remaining: next.min - points, share: (points - levels[levelIndex].min) / (next.min - levels[levelIndex].min) } : null,
    finished: finished.length,
    saved: keptSaved.length,
    streak,
    achievements,
    unlocked,
  }
}
