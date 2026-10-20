import { useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { ArrowRight, LockKeyhole } from "lucide-react"

import { roleLabel } from "@/admin/rules"
import { useSession } from "@/admin/session"
import { AuthShell, TwoStepForm } from "@/admin/TwoStepForm"
import type { TwoStep } from "@/admin/types"
import { Field, inputClass, Notice } from "@/admin/ui"
import { ShimmerButton } from "@/components/ui/shimmer-button"

const demoAccounts = [
  { email: "writer@demo.ez", role: "writer" as const, note: "Ноорог бичиж, хянуулахаар илгээнэ" },
  { email: "editor@demo.ez", role: "editor" as const, note: "Батлах, засвар хүсэх, нийтлэх" },
  { email: "admin@demo.ez", role: "admin" as const, note: "Дээрхийг бүгд + баг, эрх" },
]

export function LoginPage() {
  const { backend, member } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<TwoStep | null>(null)
  // "Нууц үгээ мартсан": the same card asks for the e-mail and sends a reset link.
  const [forgot, setForgot] = useState(false)
  const [sent, setSent] = useState(false)

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

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!forgot) return signIn(email, password)
    if (!backend) return
    setBusy(true)
    setError("")
    try {
      await backend.sendPasswordReset(email)
      setSent(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Илгээж чадсангүй")
    } finally {
      setBusy(false)
    }
  }

  async function back() {
    await backend?.signOut()
    setStep(null)
    setError("")
  }

  function toggleForgot() {
    setForgot((value) => !value)
    setSent(false)
    setError("")
  }

  return (
    <AuthShell label="Редакцын нэвтрэлт">
      {step ? (
        <TwoStepForm step={step} onDone={() => navigate(from, { replace: true })} onBack={back} backLabel="Өөр бүртгэлээр нэвтрэх" />
      ) : (
        <form onSubmit={submit} className="bg-card flex flex-col gap-4 rounded-xl border p-6">
          <div className="flex items-center gap-2">
            <LockKeyhole className="text-muted-foreground size-4" />
            <h1 className="font-news text-xl">{forgot ? "Нууц үг сэргээх" : "Багийн гишүүн"}</h1>
          </div>
          {forgot ? (
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              Бүртгэлтэй и-мэйлээ бичнэ үү. Шинэ нууц үг үүсгэх холбоос илгээнэ.
            </p>
          ) : null}
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
          {forgot ? null : (
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
          )}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {sent ? <Notice tone="success">Холбоос илгээлээ. И-мэйлээ шалгана уу (spam хавтсыг ч мөн).</Notice> : null}
          <ShimmerButton type="submit" disabled={busy || !backend || sent} className="h-11 w-full text-[13px] font-medium">
            {forgot ? (busy ? "Илгээж байна…" : "Холбоос илгээх") : busy ? "Нэвтэрч байна…" : "Нэвтрэх"}
            <ArrowRight className="size-4" />
          </ShimmerButton>
          {backend?.mode === "supabase" ? (
            <button type="button" onClick={toggleForgot} className="text-muted-foreground hover:text-foreground text-center text-[12px]">
              {forgot ? "Нэвтрэх рүү буцах" : "Нууц үгээ мартсан уу?"}
            </button>
          ) : null}
          <p className="text-muted-foreground text-center text-[12px]">
            Бүртгэлийг зөвхөн админ урина. Урилгын и-мэйл дэх холбоосоор анх нэвтэрнэ.
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
    </AuthShell>
  )
}
