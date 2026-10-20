import { useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"

import { roleLabel } from "@/admin/rules"
import { useSession } from "@/admin/session"
import type { TwoStep } from "@/admin/types"
import { Field, inputClass, Notice } from "@/admin/ui"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { publicUrl } from "@/lib/public-url"

const demoAccounts = [
  { email: "writer@demo.ez", role: "writer" as const, note: "Ноорог бичиж, хянуулахаар илгээнэ" },
  { email: "editor@demo.ez", role: "editor" as const, note: "Батлах, засвар хүсэх, нийтлэх" },
  { email: "admin@demo.ez", role: "admin" as const, note: "Дээрхийг бүгд + баг, эрх" },
]

export function LoginPage() {
  const { backend, member, refresh } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<TwoStep | null>(null)
  const [code, setCode] = useState("")

  if (member) return <Navigate to={from} replace />

  async function signIn(address: string, secret: string) {
    if (!backend) return
    setBusy(true)
    setError("")
    try {
      const next = await backend.signIn(address, secret)
      if (next) {
        setStep(next)
        return
      }
      navigate(from, { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Нэвтэрч чадсангүй")
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    signIn(email, password)
  }

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (!backend || !step) return
    setBusy(true)
    setError("")
    try {
      await backend.verifyTwoStep(step.factorId, code)
      await refresh()
      navigate(from, { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Баталгаажуулж чадсангүй")
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  async function back() {
    await backend?.signOut()
    setStep(null)
    setCode("")
    setError("")
  }

  return (
    <div className="bg-background text-foreground relative isolate grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={publicUrl("brand/logo-black.png")} alt="Эдийн засаг" className="h-8 w-auto dark:hidden" />
          <img src={publicUrl("brand/logo-white.png")} alt="Эдийн засаг" className="hidden h-8 w-auto dark:block" />
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Редакцын нэвтрэлт</p>
        </div>

        {step ? (
          <form onSubmit={verify} className="bg-card flex flex-col gap-4 rounded-xl border p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-muted-foreground size-4" />
              <h1 className="font-news text-xl">{step.enroll ? "Апп холбох" : "Баталгаажуулах код"}</h1>
            </div>
            {step.enroll ? (
              <>
                <p className="text-muted-foreground text-[13px] leading-relaxed">
                  Редакцад нэвтрэхэд нууц үгээс гадна утасны апп дахь кодыг асууна. Google Authenticator, Microsoft
                  Authenticator эсвэл 1Password-оор доорх QR кодыг уншуулаад, гарч ирсэн 6 оронтой кодыг бичнэ үү.
                </p>
                <img src={step.enroll.qr} alt="Баталгаажуулах аппад уншуулах QR код" className="mx-auto size-44 rounded-lg bg-white p-2" />
                <p className="text-muted-foreground text-center text-[12px]">
                  Уншихгүй бол аппад энэ түлхүүрийг гараар оруулна:
                  <span className="text-foreground mt-1 block font-mono text-[12px] break-all select-all">{step.enroll.secret}</span>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-[13px] leading-relaxed">Утасны апп дахь 6 оронтой кодоо бичнэ үү.</p>
            )}
            <Field label="Код" htmlFor="login-code">
              <input
                id="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className={`${inputClass} text-center font-mono text-lg tracking-[0.3em]`}
              />
            </Field>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <ShimmerButton type="submit" disabled={busy} className="h-11 w-full text-[13px] font-medium">
              {busy ? "Шалгаж байна…" : "Баталгаажуулах"}
              <ArrowRight className="size-4" />
            </ShimmerButton>
            <button type="button" onClick={back} className="text-muted-foreground hover:text-foreground text-center text-[12px]">
              Өөр бүртгэлээр нэвтрэх
            </button>
          </form>
        ) : (
        <form onSubmit={submit} className="bg-card flex flex-col gap-4 rounded-xl border p-6">
          <div className="flex items-center gap-2">
            <LockKeyhole className="text-muted-foreground size-4" />
            <h1 className="font-news text-xl">Багийн гишүүн</h1>
          </div>
          <Field label="И-мэйл" htmlFor="login-email">
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Нууц үг" htmlFor="login-password">
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required={backend?.mode === "supabase"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </Field>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <ShimmerButton type="submit" disabled={busy || !backend} className="h-11 w-full text-[13px] font-medium">
            {busy ? "Нэвтэрч байна…" : "Нэвтрэх"}
            <ArrowRight className="size-4" />
          </ShimmerButton>
          <p className="text-muted-foreground text-center text-[12px]">
            Бүртгэлийг зөвхөн админ урина. Нээлттэй бүртгэл байхгүй.
          </p>
        </form>
        )}

        {backend?.mode === "demo" ? (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-muted-foreground text-center text-[12px]">Демо горим: эрх сонгоод туршаарай</p>
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => signIn(account.email, "")}
                className="bg-card hover:border-foreground/25 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
              >
                <span>
                  <span className="block text-[14px] font-medium">{roleLabel[account.role]}</span>
                  <span className="text-muted-foreground block text-[12px]">{account.note}</span>
                </span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
