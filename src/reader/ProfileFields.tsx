import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, EyeOff, MapPin, Mars, Venus } from "lucide-react"
import { cn } from "cn"

import { Select } from "@/admin/Select"
import { regions } from "@/reader/regions"
import { genderLabel, MIN_AGE, type Gender } from "@/reader/types"

/*
 * Birth date, gender and region inputs, shared by "Профайлаа гүйцээх" and the
 * edit dialog. The date is a month calendar. The region uses the same rounded
 * select as the rest of the site.
 */

const pad = (value: number) => String(value).padStart(2, "0")

/** Latest allowed birth date: today, MIN_AGE years ago. */
export function latestBirthDate(now = new Date()) {
  return `${now.getFullYear() - MIN_AGE}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** An error message, or "" when the date is fine. */
export function birthDateError(value: string) {
  if (!value) return "Төрсөн огноогоо оруулна уу"
  if (value < "1900-01-01") return "Төрсөн огноо буруу байна"
  if (value > latestBirthDate()) return `${MIN_AGE}-аас дээш настай байх шаардлагатай`
  return ""
}

function ageOn(date: string, now = new Date()) {
  const [year, month, day] = date.split("-").map(Number)
  let age = now.getFullYear() - year
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age--
  return age
}

const months = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"]
const weekdays = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"]
const earliestYear = 1920

function parseBirth(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function isoDay(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function BirthDateField({
  id,
  value,
  onChange,
  labelClass,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  /** Kept for callers; the date has its own look now. */
  inputClass?: string
  labelClass: string
}) {
  const selected = parseBirth(value)
  const latest = useMemo(() => parseBirth(latestBirthDate()) ?? new Date(), [])
  const [view, setView] = useState(() => {
    const start = selected ?? latest
    return new Date(start.getFullYear(), start.getMonth(), 1)
  })
  const [pickingYear, setPickingYear] = useState(false)

  useEffect(() => {
    if (!selected) return
    setView(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [value])

  const age = value && !birthDateError(value) ? ageOn(value) : null
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const newestYear = latest.getFullYear()
  const years = Array.from({ length: newestYear - earliestYear + 1 }, (_, index) => newestYear - index)

  function moveMonth(delta: number) {
    const next = new Date(year, month + delta, 1)
    const min = new Date(earliestYear, 0, 1)
    const max = new Date(latest.getFullYear(), latest.getMonth(), 1)
    if (next < min || next > max) return
    setView(next)
  }

  function pickYear(nextYear: number) {
    const maxMonth = nextYear === latest.getFullYear() ? latest.getMonth() : 11
    setView(new Date(nextYear, Math.min(month, maxMonth), 1))
    setPickingYear(false)
  }

  function pickDay(day: number) {
    const date = new Date(year, month, day)
    const iso = isoDay(date)
    if (iso < "1900-01-01" || iso > latestBirthDate()) return
    onChange(iso)
  }

  return (
    <fieldset className="space-y-1.5">
      <legend className={cn(labelClass, "flex w-full items-center justify-between")}>
        <span id={`${id}-label`}>Төрсөн огноо</span>
        {age !== null ? (
          <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[12px] font-semibold">{age} настай</span>
        ) : null}
      </legend>
      <div className="bg-background rounded-xl border p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Өмнөх сар"
            onClick={() => moveMonth(-1)}
            className="text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-md"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-expanded={pickingYear}
            onClick={() => setPickingYear((open) => !open)}
            className="text-[13px] font-semibold"
          >
            {months[month]} {year}
          </button>
          <button
            type="button"
            aria-label="Дараагийн сар"
            onClick={() => moveMonth(1)}
            className="text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-md"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        {pickingYear ? (
          <div className="grid max-h-52 grid-cols-4 gap-1 overflow-y-auto">
            {years.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => pickYear(option)}
                className={cn(
                  "h-8 rounded-md text-[13px]",
                  option === year ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 text-center" role="grid" aria-labelledby={`${id}-label`}>
            {weekdays.map((label) => (
              <span key={label} className="text-muted-foreground h-8 text-[11px] leading-8 font-medium">
                {label}
              </span>
            ))}
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1
              const iso = isoDay(new Date(year, month, day))
              const disabled = iso < "1900-01-01" || iso > isoDay(latest)
              const isSelected = value === iso
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={`${year} оны ${months[month]} ${day}`}
                  onClick={() => pickDay(day)}
                  className={cn(
                    "mx-auto flex size-8 items-center justify-center rounded-md text-[13px]",
                    disabled && "text-muted-foreground/35",
                    !disabled && !isSelected && "hover:bg-muted",
                    isSelected && "bg-primary text-primary-foreground",
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </fieldset>
  )
}

const genderIcon: Record<Gender, ReactNode> = {
  female: <Venus className="size-4" />,
  male: <Mars className="size-4" />,
  unspecified: <EyeOff className="size-4" />,
}

export function GenderField({ value, onChange, labelClass }: { value: Gender | ""; onChange: (value: Gender) => void; labelClass: string }) {
  return (
    <div className="space-y-1.5">
      <span id="gender-label" className={labelClass}>
        Хүйс
      </span>
      <div role="radiogroup" aria-labelledby="gender-label" className="grid grid-cols-3 gap-2">
        {(Object.keys(genderLabel) as Gender[]).map((key) => {
          const selected = value === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(key)}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 text-[13px] font-semibold transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {genderIcon[key]}
              {genderLabel[key]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Optional: where the reader lives. Only counts per region ever reach the newsroom. */
export function RegionField({
  id,
  value,
  onChange,
  labelClass,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  /** Kept for callers; the field has its own look now. */
  inputClass?: string
  labelClass: string
}) {
  return (
    <div className="space-y-1.5">
      <span id={`${id}-label`} className={labelClass}>
        Хаана амьдардаг вэ? <span className="font-normal opacity-70">· заавал биш</span>
      </span>
      <Select
        label="Хаана амьдардаг вэ?"
        value={value}
        onChange={onChange}
        icon={<MapPin className="size-4" />}
        options={[{ value: "", label: "Хэлэхгүй" }, ...regions.map((region) => ({ value: region.id, label: region.label }))]}
      />
    </div>
  )
}
