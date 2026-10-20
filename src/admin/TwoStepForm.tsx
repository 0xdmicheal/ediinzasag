import { useState, type FormEvent, type ReactNode } from "react"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { useSession } from "@/admin/session"
import type { TwoStep } from "@/admin/types"
import { Field, inputClass, Notice } from "@/admin/ui"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { publicUrl } from "@/lib/public-url"

/** The logo and card frame shared by the login and welcome pages. */
export function AuthShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-background text-foreground relative isolate grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={publicUrl("brand/logo-black.png")} alt="Эдийн засаг" className="h-8 w-auto dark:hidden" />
          <img src={publicUrl("brand/logo-white.png")} alt="Эдийн засаг" className="hidden h-8 w-auto dark:block" />
          <p className="text-muted-foreground font-mono text-[11px] uppercase">{label}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * The 6-digit code after the password. With `step.enroll` the member has no app yet:
 * the QR code comes first. Calls `onDone` once the session is verified (aal2).
 */
export function TwoStepForm({ step, onDone, onBack, backLabel }: { step: TwoStep; onDone: () => void; onBack: () => void; backLabel: string }) {
  const { backend, refresh } = useSession()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (!backend) return
    setBusy(true)
    setError("")
    try {
      await backend.verifyTwoStep(step.factorId, code)
      await refresh()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Баталгаажуулж чадсангүй")
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  return (
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
      <Field label="Код" htmlFor="two-step-code">
        <input
          id="two-step-code"
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
      <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground text-center text-[12px]">
        {backLabel}
      </button>
    </form>
  )
}
