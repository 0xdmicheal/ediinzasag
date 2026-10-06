import { genderLabel, MIN_AGE, type Gender } from "@/reader/types"

/* Birth date and gender inputs, shared by "Профайлаа гүйцээх" and the edit dialog. */

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

export function BirthDateField({
  id,
  value,
  onChange,
  inputClass,
  labelClass,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  inputClass: string
  labelClass: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        Төрсөн огноо
      </label>
      <input
        id={id}
        type="date"
        required
        min="1900-01-01"
        max={latestBirthDate()}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
      />
    </div>
  )
}

export function GenderField({ value, onChange, labelClass }: { value: Gender | ""; onChange: (value: Gender) => void; labelClass: string }) {
  return (
    <div className="space-y-1.5">
      <span id="gender-label" className={labelClass}>
        Хүйс
      </span>
      <div role="radiogroup" aria-labelledby="gender-label" className="grid grid-cols-3 gap-2">
        {(Object.keys(genderLabel) as Gender[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            onClick={() => onChange(key)}
            className={`h-10 rounded-lg border-2 text-[13px] font-semibold transition-colors ${value === key ? "border-foreground bg-foreground text-background" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}
          >
            {genderLabel[key]}
          </button>
        ))}
      </div>
    </div>
  )
}
