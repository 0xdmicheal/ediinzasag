import { useEffect, useRef, useState, type FormEvent } from "react"
import { Eye, EyeOff, VenetianMask, X } from "lucide-react"
import { AnimatePresence, motion, MotionConfig } from "motion/react"

import { BirthDateField, birthDateError, GenderField } from "@/reader/ProfileFields"
import { AvatarPicker } from "@/reader/ReaderAvatar"
import type { Gender } from "@/reader/types"

/*
 * Watermelon UI "Edit Profile" (registry: edit-profile-base), adapted for a
 * reader account: name, e-mail (add or change), a new password (set one or
 * change it), birth date, gender, the "post comments as Зочин" switch and the
 * profile picture (faces or shapes). Escape closes it.
 */

export interface ProfileValues {
  name: string
  email: string
  /** Empty when the reader leaves the password as it is. */
  password: string
  /** Comments are posted as "Зочин". */
  anonymous: boolean
  avatar: string
  birthDate: string
  gender: Gender | ""
}

export function EditProfile({
  open,
  onClose,
  values,
  phone,
  onSave,
}: {
  open: boolean
  onClose: () => void
  values: Omit<ProfileValues, "password">
  /** Shown read-only when set. */
  phone?: string
  /**
   * Saves the changed fields. Rejects with an Error to show its message;
   * resolves with a note (e.g. "check your inbox") to keep the dialog open
   * and show it, or nothing to close.
   */
  onSave: (next: ProfileValues) => Promise<string | void>
}) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open ? <Dialog key="dialog" onClose={onClose} values={values} phone={phone} onSave={onSave} /> : null}
      </AnimatePresence>
    </MotionConfig>
  )
}

function Dialog({
  onClose,
  values,
  phone,
  onSave,
}: {
  onClose: () => void
  values: Omit<ProfileValues, "password">
  phone?: string
  onSave: (next: ProfileValues) => Promise<string | void>
}) {
  // Mounted fresh on every open, so the fields start from the saved values.
  const [name, setName] = useState(values.name)
  const [email, setEmail] = useState(values.email)
  const [password, setPassword] = useState("")
  const [anonymous, setAnonymous] = useState(values.anonymous)
  const [avatar, setAvatar] = useState(values.avatar)
  const [birthDate, setBirthDate] = useState(values.birthDate)
  const [gender, setGender] = useState<Gender | "">(values.gender)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    field.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const changed =
    name.trim() !== values.name ||
    email.trim().toLowerCase() !== values.email.toLowerCase() ||
    password !== "" ||
    anonymous !== values.anonymous ||
    avatar !== values.avatar ||
    birthDate !== values.birthDate ||
    gender !== values.gender

  async function submit(event: FormEvent) {
    event.preventDefault()
    const dateProblem = birthDate ? birthDateError(birthDate) : ""
    if (dateProblem) {
      setError(dateProblem)
      return
    }
    setBusy(true)
    setError("")
    setNote("")
    try {
      const message = await onSave({ name: name.trim(), email: email.trim(), password, anonymous, avatar, birthDate, gender })
      setPassword("")
      if (message) setNote(message)
      else onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Хадгалж чадсангүй")
    } finally {
      setBusy(false)
    }
  }

  const fieldClass =
    "bg-background border-input text-foreground w-full rounded-lg border-2 px-4 py-2.5 text-[15px] font-semibold outline-none transition-all focus:border-ring"
  const label = "text-muted-foreground text-sm font-medium"

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="bg-background/30 fixed inset-0 backdrop-blur-sm"
      />
      <div className="pointer-events-none relative z-[101] w-full max-w-[45rem]">
        <motion.form
          onSubmit={submit}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 300, mass: 0.8 }}
          className="border-border bg-background pointer-events-auto flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-2xl border shadow-lg sm:max-h-[calc(100svh-2rem)] sm:rounded-xl"
        >
          <div className="flex shrink-0 items-center justify-between px-5 py-4 md:px-8">
            <h2 id="edit-profile-title" className="text-foreground text-lg font-semibold">
              Профайл засах
            </h2>
            <button type="button" aria-label="Хаах" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
              <X className="size-5" />
            </button>
          </div>

          <div className="border-border bg-muted/30 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain border-y md:flex-row">
            <div className="flex-1 space-y-4 p-5 sm:p-6">
              {/* Phones: the picture picker sits at the top instead of the side panel. */}
              <div className="md:hidden">
                <AvatarPicker name={name || email || phone || ""} value={avatar} onChange={setAvatar} compact />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-profile-name" className={label}>
                  Харагдах нэр
                </label>
                <input
                  ref={field}
                  id="edit-profile-name"
                  required
                  maxLength={60}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-profile-email" className={label}>
                  {values.email ? "И-мэйл" : "И-мэйл холбох"}
                </label>
                <input
                  id="edit-profile-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tani@email.mn"
                  required={Boolean(values.email)}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass}
                />
                <p className="text-muted-foreground text-[12px]">Шинэ хаягаа и-мэйлээр ирсэн холбоосоор баталгаажуулна.</p>
              </div>

              <BirthDateField id="edit-profile-birth" value={birthDate} onChange={setBirthDate} inputClass={fieldClass} labelClass={label} />
              <GenderField value={gender} onChange={setGender} labelClass={label} />

              {phone ? (
                <div className="space-y-1.5">
                  <span className={label}>Утас</span>
                  <p className={`${fieldClass} text-muted-foreground cursor-not-allowed truncate text-sm`}>{phone}</p>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="edit-profile-password" className={label}>
                  Нууц үг
                </label>
                <div className="relative">
                  <input
                    id="edit-profile-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Шинэ нууц үг"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${fieldClass} pr-11`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Нууц үгийг нуух" : "Нууц үгийг харах"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-muted-foreground text-[12px]">
                  Google, код эсвэл утсаар орсон бол энд нууц үг үүсгэнэ. Дор хаяж 8 тэмдэгт. Өөрчлөхгүй бол хоосон орхино.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={anonymous}
                onClick={() => setAnonymous(!anonymous)}
                className="border-input bg-background flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors hover:border-foreground/30"
              >
                <VenetianMask className="text-muted-foreground size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-[14px] font-semibold">Сэтгэгдэлд нэрээ нуух</span>
                  <span className="text-muted-foreground block text-[12px] leading-snug">Шинэ сэтгэгдэл Зочин нэрээр гарна</span>
                </span>
                <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${anonymous ? "bg-foreground" : "bg-foreground/20"}`}>
                  <span
                    className={`bg-background absolute top-0.5 left-0.5 size-5 rounded-full shadow-sm transition-transform duration-200 ${anonymous ? "translate-x-4" : ""}`}
                  />
                </span>
              </button>

              {error ? (
                <p role="alert" className="rounded-md bg-[color-mix(in_oklch,var(--down)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--down)]">
                  {error}
                </p>
              ) : null}
              {note ? (
                <p role="status" className="rounded-md bg-[color-mix(in_oklch,var(--up)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--up)]">
                  {note}
                </p>
              ) : null}
            </div>

            <div className="border-border hidden border-l border-dashed md:block" />

            <div className="hidden flex-1 flex-col items-center justify-center gap-4 p-8 px-6 md:flex">
              <span className="text-muted-foreground text-sm font-medium">Профайлын зураг</span>
              <AvatarPicker name={name || email || phone || ""} value={avatar} onChange={setAvatar} />
              <h3 className="text-foreground text-center text-lg font-bold">{name.trim() || "Уншигч"}</h3>
            </div>
          </div>

          <div className="bg-muted grid shrink-0 grid-cols-2 gap-3 px-5 py-4 sm:flex sm:justify-end md:px-8">
            <button
              type="button"
              onClick={onClose}
              className="bg-background border-border text-foreground hover:bg-muted/80 rounded-full border-2 px-5 py-2 text-sm font-bold transition-colors"
            >
              {note ? "Хаах" : "Болих"}
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim() || !changed}
              className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-5 py-2 text-sm font-bold shadow-lg transition-colors disabled:opacity-50"
            >
              {busy ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  )
}
