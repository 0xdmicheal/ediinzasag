import { useState, type FormEvent } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { ArrowRight, X } from "lucide-react"

import { buttonClass, Field, inputClass, Notice } from "@/admin/ui"
import { LoginShowcase, LoginShowcaseCompact } from "@/reader/LoginShowcase"
import { formatPhone, normalizePhone } from "@/reader/phone"
import { useReader } from "@/reader/session"
import type { CodeChannel } from "@/reader/types"

type Mode = "signin" | "code" | "signup" | "reset"

const titles: Record<Mode, string> = {
  signin: "Нууц үгээр",
  code: "Кодоор",
  signup: "Бүртгүүлэх",
  reset: "Нууц үг сэргээх",
}

/* One short heading for every tab, so switching never re-wraps it. */
const headings: Record<Mode, string> = {
  signin: "Нэвтрэх",
  code: "Нэвтрэх",
  signup: "Нэвтрэх",
  reset: "Нууц үг сэргээх",
}

const linkButton = "text-muted-foreground hover:text-foreground text-[12px] underline-offset-2 hover:underline"

/** Google's "G", in its own colours (as their sign-in guidelines ask). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** /login and /signup as a page (direct links, e-mail redirects). In the app the same panel opens as a popup. */
export function LoginPage() {
  const { reader } = useReader()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/account"
  if (reader) return <Navigate to={from} replace />
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <LoginPanel
        from={from}
        initialMode={location.pathname.endsWith("signup") ? "signup" : "code"}
        onDone={() => navigate(from, { replace: true })}
      />
    </section>
  )
}

/**
 * Reader sign-in card: Google, a one-time code by e-mail or SMS, or a
 * password. `onDone` runs once signed in; `onClose` adds a close button (popup).
 * Staff use /admin/login.
 */
export function LoginPanel({
  from,
  initialMode = "code",
  onDone,
  onClose,
}: {
  /** Path on this site to come back to after Google. */
  from: string
  initialMode?: "code" | "signup"
  onDone: () => void
  onClose?: () => void
}) {
  const { auth } = useReader()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [channel, setChannel] = useState<CodeChannel>("email")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  /** Where the code went (e-mail or E.164 phone); set once it was sent, then the form asks for it. */
  const [codeTarget, setCodeTarget] = useState<string | null>(null)
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [sent, setSent] = useState("")
  const [busy, setBusy] = useState(false)

  function reset() {
    setError("")
    setSent("")
    setCode("")
    setCodeTarget(null)
    setDemoCode(null)
  }

  function switchTo(next: Mode) {
    setMode(next)
    reset()
  }

  function switchChannel(next: CodeChannel) {
    setChannel(next)
    reset()
  }

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await task()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Алдаа гарлаа")
    } finally {
      setBusy(false)
    }
  }

  async function sendCode() {
    if (!auth) return
    const target = channel === "phone" ? normalizePhone(phone) : email.trim()
    if (!target) throw new Error("Утасны дугаараа шалгана уу (жишээ нь 99112233)")
    setDemoCode(await auth.requestCode(channel, target))
    setCodeTarget(target)
    setCode("")
  }

  function google() {
    if (!auth) return
    run(async () => {
      await auth.signInWithGoogle(from)
      // Supabase has left the page for Google by now; the demo signs in on the spot.
      if (auth.mode === "demo") onDone()
    })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!auth) return
    run(async () => {
      if (mode === "signin") {
        await auth.signIn(email, password)
        onDone()
      } else if (mode === "code") {
        if (!codeTarget) return sendCode()
        await auth.verifyCode(channel, codeTarget, code)
        onDone()
      } else if (mode === "signup") {
        const mustConfirm = await auth.signUp(name, email, password)
        if (mustConfirm) setSent(`${email} хаяг руу баталгаажуулах холбоос илгээлээ. Түүн дээр дарж бүртгэлээ идэвхжүүлнэ үү.`)
        else onDone()
      } else {
        await auth.sendPasswordReset(email)
        setSent(`${email} хаяг руу нууц үг сэргээх холбоос илгээлээ.`)
      }
    })
  }

  const submitLabel =
    mode === "reset"
      ? "Холбоос илгээх"
      : mode === "code"
        ? codeTarget
          ? "Баталгаажуулах"
          : "Код авах"
        : mode === "signin"
          ? "Нэвтрэх"
          : titles[mode]
  const shownTarget = codeTarget && channel === "phone" ? formatPhone(codeTarget) : codeTarget

  return (
    <div className="bg-background relative grid overflow-hidden rounded-2xl border shadow-[0_40px_80px_-50px_rgb(0_0_0/0.45)] lg:grid-cols-[1.05fr_1fr]">
      {onClose ? (
        <button
          type="button"
          aria-label="Хаах"
          onClick={onClose}
          className="bg-background/80 text-muted-foreground hover:text-foreground absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full border backdrop-blur transition-colors"
        >
          <X className="size-4" />
        </button>
      ) : null}
      <div className="hidden lg:block">
        <LoginShowcase />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col px-5 py-8 sm:px-10 sm:py-10">
        <p className="text-muted-foreground font-mono text-[11px] uppercase">Уншигчийн бүртгэл</p>
        <h1 id="login-title" className="font-news mt-1 text-3xl">
          {headings[mode]}
        </h1>
        <p className="text-muted-foreground mt-1 text-[13px]">Бүртгэлгүй бол анх нэвтрэхэд шинээр үүснэ.</p>
        <div className="lg:hidden">
          <LoginShowcaseCompact />
        </div>

        {/*
        Fixed minimum height (the tallest tab: code entered, or sign-up), so
        switching tabs or steps never moves the notes and footer below.
      */}
        <div className="min-h-[35rem]">
          {mode !== "reset" && !sent ? (
            <>
              <button
                type="button"
                onClick={google}
                disabled={busy || !auth}
                className="bg-background hover:bg-muted border-foreground/15 mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-full border px-5 text-[14px] font-medium whitespace-nowrap shadow-xs transition-colors disabled:opacity-60"
              >
                <GoogleMark />
                Google-ээр нэвтрэх
              </button>
              <div className="text-muted-foreground my-5 flex items-center gap-3 text-[12px]">
                <span className="bg-foreground/15 h-px flex-1" />
                эсвэл
                <span className="bg-foreground/15 h-px flex-1" />
              </div>
              <div role="tablist" aria-label="Нэвтрэх арга" className="bg-muted grid grid-cols-3 gap-1 rounded-full p-1">
                {(["code", "signin", "signup"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={mode === key}
                    onClick={() => switchTo(key)}
                    className={`h-8 rounded-full text-[13px] font-medium transition-colors ${mode === key ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {titles[key]}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {sent ? (
            <div className="mt-6 flex flex-col gap-4">
              <Notice tone="success">{sent}</Notice>
              <button type="button" onClick={() => switchTo("code")} className={buttonClass.ghost}>
                Нэвтрэх хуудас руу
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
              {mode === "code" && !codeTarget ? (
                <div role="radiogroup" aria-label="Код хүлээн авах" className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "email", label: "И-мэйл" },
                      { key: "phone", label: "Утас (SMS)" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="radio"
                      aria-checked={channel === item.key}
                      onClick={() => switchChannel(item.key)}
                      className={`h-9 rounded-md border text-[13px] font-medium transition-colors ${channel === item.key ? "border-foreground bg-foreground/[0.04]" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {mode === "signup" ? (
                <Field label="Нэр" htmlFor="reader-name">
                  <input
                    id="reader-name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              ) : null}

              {mode === "code" && channel === "phone" ? (
                <Field
                  label="Утасны дугаар"
                  htmlFor="reader-phone"
                  hint={codeTarget ? undefined : "Монгол дугаар бол 8 оронтойгоор бичихэд хангалттай"}
                >
                  <input
                    id="reader-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    readOnly={Boolean(codeTarget)}
                    placeholder="9911 2233"
                    value={codeTarget ? formatPhone(codeTarget) : phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              ) : (
                <Field label="И-мэйл" htmlFor="reader-email" hint={mode === "code" && !codeTarget ? "Бүртгэлгүй бол шинээр үүснэ" : undefined}>
                  <input
                    id="reader-email"
                    type="email"
                    autoComplete="email"
                    required
                    readOnly={mode === "code" && Boolean(codeTarget)}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              )}

              {mode === "signin" || mode === "signup" ? (
                <Field label="Нууц үг" htmlFor="reader-password" hint={mode === "signup" ? "Дор хаяж 8 тэмдэгт" : undefined}>
                  <input
                    id="reader-password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              ) : null}

              {mode === "code" && codeTarget ? (
                <>
                  {demoCode ? (
                    <Notice>
                      Демо горим: {channel === "phone" ? "SMS" : "и-мэйл"} илгээгдэхгүй. Таны код{" "}
                      <strong className="font-mono tracking-widest">{demoCode}</strong>
                    </Notice>
                  ) : (
                    <Notice tone="success">
                      {shownTarget} {channel === "phone" ? "дугаар руу SMS-ээр" : "хаяг руу"} 6 оронтой код илгээлээ.
                      {channel === "email" ? " Спам хавтсаа ч шалгаарай." : ""}
                    </Notice>
                  )}
                  <Field label="Код" htmlFor="reader-code">
                    <input
                      id="reader-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6,10}"
                      maxLength={10}
                      required
                      autoFocus
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                      className={`${inputClass} font-mono text-lg tracking-[0.4em]`}
                    />
                  </Field>
                </>
              ) : null}

              {error ? <Notice tone="error">{error}</Notice> : null}
              <button type="submit" disabled={busy || !auth} className={buttonClass.primary}>
                {busy ? "Түр хүлээнэ үү…" : submitLabel}
                <ArrowRight className="size-4" />
              </button>
              {mode === "code" && codeTarget ? (
                <div className="flex justify-between">
                  <button type="button" onClick={reset} className={linkButton}>
                    {channel === "phone" ? "Дугаар солих" : "И-мэйл солих"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => run(sendCode)} className={linkButton}>
                    Код дахин илгээх
                  </button>
                </div>
              ) : null}
              {mode === "signin" ? (
                <button type="button" onClick={() => switchTo("reset")} className={linkButton}>
                  Нууц үгээ мартсан уу?
                </button>
              ) : null}
              {mode === "reset" ? (
                <button type="button" onClick={() => switchTo("signin")} className={linkButton}>
                  Нэвтрэх рүү буцах
                </button>
              ) : null}
            </form>
          )}
        </div>

        {auth?.mode === "demo" ? (
          <p className="text-muted-foreground mt-4 text-center text-[12px]">
            Демо горим: бүртгэл зөвхөн энэ хөтөчид хадгалагдана. Google товч жишээ бүртгэлээр нэвтэрнэ.
          </p>
        ) : null}
        <p className="text-muted-foreground mt-6 text-center text-[12px]">
          Редакцын гишүүн үү?{" "}
          <Link to="/admin/login" className="text-foreground underline underline-offset-2">
            Редакцын нэвтрэлт
          </Link>
        </p>
      </div>
    </div>
  )
}
