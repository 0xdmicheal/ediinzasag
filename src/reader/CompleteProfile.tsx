import { useEffect, useState, type FormEvent } from "react"
import { useLocation } from "react-router-dom"
import { AnimatePresence, motion, MotionConfig } from "motion/react"

import { BirthDateField, birthDateError, GenderField, RegionField } from "@/reader/ProfileFields"
import { AvatarPicker } from "@/reader/ReaderAvatar"
import { useReader } from "@/reader/session"
import type { Gender } from "@/reader/types"

/** "Дараа" hides the step for this browser tab only; it comes back next visit until done. */
const LATER = "ez-complete-profile-later"

function laterThisSession() {
  try {
    return sessionStorage.getItem(LATER) === "1"
  } catch {
    return false
  }
}

/**
 * "Профайлаа гүйцээх": right after a reader's first sign-in (Google, code or
 * password), ask for birth date and gender and let them pick a picture.
 * Shows while either is missing; never on the /login page or over another popup.
 */
export function CompleteProfile() {
  const { auth, reader, refresh, loginOpen } = useReader()
  const location = useLocation()
  const [later, setLater] = useState(laterThisSession)
  const missing = Boolean(reader && (!reader.birthDate || !reader.gender))
  const open = missing && !later && !loginOpen && !location.pathname.startsWith("/login") && !location.pathname.startsWith("/signup")

  function postpone() {
    try {
      sessionStorage.setItem(LATER, "1")
    } catch {
      // Storage blocked: hide it for now anyway.
    }
    setLater(true)
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && reader && auth ? (
          <Step
            key={reader.id}
            name={reader.name}
            initial={{ avatar: reader.avatar, birthDate: reader.birthDate, gender: reader.gender, region: reader.region }}
            onLater={postpone}
            onSave={async (values) => {
              await auth.updateProfile(values)
              await refresh()
            }}
          />
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  )
}

function Step({
  name,
  initial,
  onLater,
  onSave,
}: {
  name: string
  initial: { avatar: string; birthDate: string; gender: Gender | ""; region: string }
  onLater: () => void
  onSave: (values: { avatar: string; birthDate: string; gender: Gender; region: string }) => Promise<void>
}) {
  const [avatar, setAvatar] = useState(initial.avatar)
  const [birthDate, setBirthDate] = useState(initial.birthDate)
  const [gender, setGender] = useState<Gender | "">(initial.gender)
  const [region, setRegion] = useState(initial.region)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = birthDateError(birthDate) || (gender ? "" : "Хүйсээ сонгоно уу")
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError("")
    try {
      await onSave({ avatar, birthDate, gender: gender as Gender, region })
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
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-background/40 fixed inset-0 backdrop-blur-xl" />
      <motion.form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-profile-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="bg-background relative flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Тавтай морил{name ? `, ${name}` : ""}</p>
          <h2 id="complete-profile-title" className="font-news mt-1 text-2xl">
            Профайлаа гүйцээх
          </h2>
          <p className="text-muted-foreground mt-1 text-[13px]">Нэг минут л болно. Мэдээлэл тань зөвхөн танд болон редакцад харагдана.</p>

          <div className="bg-muted/40 mt-5 flex justify-center rounded-xl border p-5">
            <AvatarPicker name={name} value={avatar} onChange={setAvatar} />
          </div>

          <div className="mt-5 space-y-4">
            <BirthDateField id="complete-birth" value={birthDate} onChange={setBirthDate} inputClass={fieldClass} labelClass={label} />
            <GenderField value={gender} onChange={setGender} labelClass={label} />
            <RegionField id="complete-region" value={region} onChange={setRegion} inputClass={fieldClass} labelClass={label} />
            {error ? (
              <p role="alert" className="rounded-md bg-[color-mix(in_oklch,var(--down)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--down)]">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <div className="bg-muted grid shrink-0 grid-cols-[auto_1fr] gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onLater}
            className="text-muted-foreground hover:text-foreground rounded-full px-4 py-2 text-sm font-semibold transition-colors"
          >
            Дараа
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition-colors disabled:opacity-50"
          >
            {busy ? "Хадгалж байна…" : "Хадгалах"}
          </button>
        </div>
      </motion.form>
    </div>
  )
}
