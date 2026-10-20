import { useEffect, useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { ArrowRight, KeyRound } from "lucide-react"

import { useSession } from "@/admin/session"
import { AuthShell, TwoStepForm } from "@/admin/TwoStepForm"
import type { Member, TwoStep } from "@/admin/types"
import { Field, inputClass, Notice } from "@/admin/ui"
import { ShimmerButton } from "@/components/ui/shimmer-button"

const MIN_PASSWORD = 10

/**
 * Where the invite and password-reset e-mails land (team-invite Edge Function, «Нууц үгээ
 * мартсан»). The link signs the person in; here they set a password, then link or enter
 * their authenticator code, and arrive on the board.
 */
export function WelcomePage() {
  const { backend, member: signedIn } = useSession()
  const navigate = useNavigate()
  // Read before Supabase consumes the link's #access_token…&type=invite|recovery.
  const [link] = useState(() => new URLSearchParams(window.location.hash.slice(1)))
  const reset = link.get("type") === "recovery"
  const linkError = link.get("error_description")
  const [member, setMember] = useState<Member | null | undefined>(undefined)
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<TwoStep | null>(null)

  useEffect(() => {
    if (!backend || linkError) return
    let cancelled = false
    const load = () => backend.welcomeMember().then((value) => !cancelled && value && setMember(value))
    // The session arrives from the link a moment after load; give it a few seconds.
    const unsubscribe = backend.onAuthChange(load)
    load()
    const timer = setTimeout(() => !cancelled && setMember((value) => value ?? null), 4000)
    return () => {
      cancelled = true
      clearTimeout(timer)
      unsubscribe()
    }
  }, [backend, linkError])

  if (signedIn) return <Navigate to="/" replace />

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!backend) return
    if (password.length < MIN_PASSWORD) return setError(`Нууц үг дор хаяж ${MIN_PASSWORD} тэмдэгт байна`)
    if (password !== repeat) return setError("Хоёр нууц үг таарахгүй байна")
    setBusy(true)
    setError("")
    try {
      await backend.setPassword(password)
      const next = await backend.twoStep()
      if (next) setStep(next)
      else navigate("/", { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Хадгалж чадсангүй")
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    await backend?.signOut()
    navigate("/login", { replace: true })
  }

  if (linkError || member === null) {
    return (
      <AuthShell label="Редакц">
        <div className="bg-card flex flex-col gap-4 rounded-xl border p-6">
          <h1 className="font-news text-xl">Холбоос хүчингүй байна</h1>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            Холбоосын хугацаа дууссан эсвэл аль хэдийн ашигласан байна. Урилга бол админаас дахин илгээхийг хүснэ үү. Нууц үг сэргээх
            бол нэвтрэх хуудаснаас дахин хүснэ.
          </p>
          <Link to="/login" className="text-foreground text-[13px] font-medium underline underline-offset-4">
            Нэвтрэх хуудас руу
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (member === undefined) {
    return (
      <div className="text-muted-foreground grid min-h-svh place-items-center text-sm" role="status">
        Холбоосыг шалгаж байна…
      </div>
    )
  }

  return (
    <AuthShell label={reset ? "Нууц үг сэргээх" : "Редакцад тавтай морил"}>
      {step ? (
        <TwoStepForm step={step} onDone={() => navigate("/", { replace: true })} onBack={leave} backLabel="Дараа үргэлжлүүлэх" />
      ) : (
        <form onSubmit={save} className="bg-card flex flex-col gap-4 rounded-xl border p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="text-muted-foreground size-4" />
            <h1 className="font-news text-xl">{reset ? "Шинэ нууц үг" : `Сайн байна уу, ${member.name.split(" ")[0]}`}</h1>
          </div>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {reset
              ? `${member.email} бүртгэлийн шинэ нууц үгээ үүсгэнэ үү.`
              : `${member.email} хаягаар редакцад нэвтрэх нууц үгээ үүсгэнэ үү. Дараа нь утасныхаа баталгаажуулах аппыг холбоно, нэг минут орчим.`}
          </p>
          {/* Lets password managers save the pair under the right account. */}
          <input type="email" autoComplete="username" value={member.email} readOnly hidden />
          <Field label="Нууц үг" htmlFor="welcome-password" hint={`Дор хаяж ${MIN_PASSWORD} тэмдэгт`}>
            <input
              id="welcome-password"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Нууц үгээ давтах" htmlFor="welcome-repeat">
            <input
              id="welcome-repeat"
              type="password"
              autoComplete="new-password"
              required
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              className={inputClass}
            />
          </Field>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <ShimmerButton type="submit" disabled={busy} className="h-11 w-full text-[13px] font-medium">
            {busy ? "Хадгалж байна…" : "Үргэлжлүүлэх"}
            <ArrowRight className="size-4" />
          </ShimmerButton>
        </form>
      )}
    </AuthShell>
  )
}
