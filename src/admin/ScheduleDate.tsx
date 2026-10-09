import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"

import { Select } from "@/admin/Select"

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"]
const MONTHS = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"]
const PRESETS = [
  { id: "today", label: "Өнөөдөр", offset: 0 },
  { id: "tomorrow", label: "Маргааш", offset: 1 },
  { id: "7d", label: "7 хоног", offset: 7 },
  { id: "14d", label: "14 хоног", offset: 14 },
  { id: "30d", label: "30 хоног", offset: 30 },
] as const

const pad2 = (value: number) => String(value).padStart(2, "0")

function startOfDay(offset = 0) {
  const day = new Date()
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() + offset)
  return day
}

export function scheduleDayValue(day: Date) {
  return `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`
}

function parseDay(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return startOfDay(1)
  return new Date(year, month - 1, day)
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const hourOptions = Array.from({ length: 24 }, (_, hour) => ({ value: pad2(hour), label: pad2(hour) }))
const minuteOptions = ["00", "15", "30", "45"].map((minute) => ({ value: minute, label: minute }))

/**
 * Publish scheduler for the editor panel. One day inside the next 30, plus a
 * time. The month grid and preset list follow the scheduler calendar.
 */
export function ScheduleDate({
  day,
  hour,
  minute,
  onDay,
  onHour,
  onMinute,
}: {
  day: string
  hour: string
  minute: string
  onDay: (value: string) => void
  onHour: (value: string) => void
  onMinute: (value: string) => void
}) {
  const selected = parseDay(day)
  const today = useMemo(() => startOfDay(0), [])
  const last = useMemo(() => startOfDay(30), [])
  const [view, setView] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )

  const presetId = PRESETS.find((preset) => sameDay(startOfDay(preset.offset), selected))?.id
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const previous = new Date(year, month - 1, 1)
  const next = new Date(year, month + 1, 1)
  const canPrevious = new Date(previous.getFullYear(), previous.getMonth() + 1, 0) >= today
  const canNext = next <= last

  function pick(date: Date) {
    if (date < today || date > last) return
    onDay(scheduleDayValue(date))
    setView(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background text-[13px]">
      <div className="flex min-h-0">
        <aside className="flex w-[6.75rem] shrink-0 flex-col gap-0.5 border-r border-border bg-muted/40 py-2">
          {PRESETS.map((preset) => {
            const active = presetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => pick(startOfDay(preset.offset))}
                className={cn(
                  "mx-1.5 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors",
                  active ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </aside>
        <div className="min-w-0 flex-1 p-3">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Өмнөх сар"
              disabled={!canPrevious}
              onClick={() => canPrevious && setView(previous)}
              className="text-muted-foreground hover:text-foreground grid size-7 place-items-center rounded-lg disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-[13px] font-semibold">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              aria-label="Дараагийн сар"
              disabled={!canNext}
              onClick={() => canNext && setView(next)}
              className="text-muted-foreground hover:text-foreground grid size-7 place-items-center rounded-lg disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((label) => (
              <span key={label} className="text-muted-foreground mb-1 text-[11px] font-medium">
                {label}
              </span>
            ))}
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <span key={`empty-${index}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const date = new Date(year, month, index + 1)
              const allowed = date >= today && date <= last
              const isSelected = sameDay(date, selected)
              return (
                <button
                  key={date.getDate()}
                  type="button"
                  disabled={!allowed}
                  onClick={() => pick(date)}
                  className={cn(
                    "relative flex h-8 items-center justify-center rounded-lg text-[13px]",
                    !allowed && "text-muted-foreground/40",
                    allowed && !isSelected && "text-foreground hover:bg-muted",
                  )}
                >
                  {isSelected ? (
                    <span className="bg-foreground text-background relative z-10 flex size-8 items-center justify-center rounded-lg text-xs font-bold shadow-md">
                      {date.getDate()}
                      {reduceMotion ? (
                        <span className="bg-brand absolute bottom-1 h-[1.5px] w-2 rounded-full" />
                      ) : (
                        <motion.span layoutId="schedule-day" className="bg-brand absolute bottom-1 h-[1.5px] w-2 rounded-full" />
                      )}
                    </span>
                  ) : (
                    date.getDate()
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Select label="Цаг" value={hour} onChange={onHour} options={hourOptions} />
        <Select label="Минут" value={minute} onChange={onMinute} options={minuteOptions} />
      </div>
    </div>
  )
}
