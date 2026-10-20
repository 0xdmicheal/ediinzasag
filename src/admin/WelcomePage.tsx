import { useEffect, useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { ArrowRight, KeyRound } from "lucide-react"

import { useSession } from "@/admin/session"
import { AuthShell, TwoStepForm } from "@/admin/TwoStepForm"
import type { Member, TwoStep } from "@/admin/types"
import { Field, inputClass, Notice } from "@/admin/ui"
import { Button } from "@/components/ui/button"

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
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters`)
    if (password !== repeat) return setError("The two passwords don't match")
    setBusy(true)
    setError("")
    try {
      await backend.setPassword(password)
      const next = await backend.twoStep()
      if (next) setStep(next)
      else navigate("/", { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't save the password")
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
      <AuthShell label="Newsroom">
        <div className="bg-card flex flex-col gap-4 rounded-xl border p-6">
          <h1 className="text-xl font-medium">This link no longer works</h1>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            It has expired or was already used. For an invite, ask an admin to send it again. For a password reset, ask for a new
            link on the sign-in page.
          </p>
          <Link to="/login" className="text-foreground text-[13px] font-medium underline underline-offset-4">
            Go to sign-in
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (member === undefined) {
    return (
      <div className="text-muted-foreground grid min-h-svh place-items-center text-sm" role="status">
        Checking the link…
      </div>
    )
  }

  return (
    <AuthShell label={reset ? "Password reset" : "Welcome to the newsroom"}>
      {step ? (
        <TwoStepForm step={step} onDone={() => navigate("/", { replace: true })} onBack={leave} backLabel="Finish later" />
      ) : (
        <form onSubmit={save} className="bg-card flex flex-col gap-4 rounded-xl border p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="text-muted-foreground size-4" />
            <h1 className="text-xl font-medium">{reset ? "Set a new password" : `Hi, ${member.name.split(" ")[0]}`}</h1>
          </div>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {reset
              ? `Choose a new password for ${member.email}.`
              : `Create the password you'll use with ${member.email}. Then you'll link an authenticator app on your phone; it takes about a minute.`}
          </p>
          {/* Lets password managers save the pair under the right account. */}
          <input type="email" autoComplete="username" value={member.email} readOnly hidden />
          <Field label="Password" htmlFor="welcome-password" hint={`At least ${MIN_PASSWORD} characters`}>
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
          <Field label="Repeat password" htmlFor="welcome-repeat">
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
          <Button type="submit" disabled={busy} className="h-11 w-full gap-1.5 text-[14px]">
            {busy ? "Saving…" : "Continue"}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
