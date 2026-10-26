import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, FilePlus2, RefreshCw } from "lucide-react"

import { useTeam } from "@/admin/session"
import type { NewsBrief } from "@/admin/types"
import { buttonClass, Field, inputClass, Notice } from "@/admin/ui"

/*
 * A brief on a paywalled story (WSJ, Bloomberg, Barron's): someone reads it on their own
 * subscription and writes down the facts. The agent never opens the page; it finds other
 * coverage of the same story and drafts EZ's own card that credits the outlet.
 * The limits match the news-agent function's (checkBrief).
 */

const FACTS_MAX = 6000
const OUTLETS = ["The Wall Street Journal", "Bloomberg", "Barron's"]

const empty: NewsBrief = { outlet: OUTLETS[0], url: "", title: "", facts: "", quotes: "" }

export function BriefForm() {
  const { backend } = useTeam()
  const [brief, setBrief] = useState<NewsBrief>(empty)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [articleId, setArticleId] = useState("")

  const set = (key: keyof NewsBrief) => (event: { target: { value: string } }) => setBrief((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError("")
    setArticleId("")
    try {
      setArticleId(await backend.fileNewsBrief(brief))
      setBrief((current) => ({ ...empty, outlet: current.outlet }))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't make the card")
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="text-muted-foreground max-w-2xl text-[13px] leading-relaxed">
        For a story you read on your own subscription. Write the facts in your own notes: the numbers, who said what, what happens next.
        Don&apos;t paste the article. The agent adds other coverage of the story and drafts a card that links the outlet.
      </p>
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <Field label="Outlet" htmlFor="brief-outlet">
          <input id="brief-outlet" list="brief-outlets" required maxLength={80} value={brief.outlet} onChange={set("outlet")} className={inputClass} />
          <datalist id="brief-outlets">
            {OUTLETS.map((outlet) => (
              <option key={outlet} value={outlet} />
            ))}
          </datalist>
        </Field>
        <Field label="Article link" htmlFor="brief-url">
          <input id="brief-url" type="url" required value={brief.url} onChange={set("url")} placeholder="https://www.wsj.com/…" className={inputClass} />
        </Field>
      </div>
      <Field label="Headline" htmlFor="brief-title">
        <input id="brief-title" required maxLength={300} value={brief.title} onChange={set("title")} className={inputClass} />
      </Field>
      <Field label="Facts" htmlFor="brief-facts" hint={`${brief.facts.length} / ${FACTS_MAX} · Notes in English or Mongolian, one fact per line works best.`}>
        <textarea
          id="brief-facts"
          required
          minLength={40}
          maxLength={FACTS_MAX}
          rows={7}
          value={brief.facts}
          onChange={set("facts")}
          className={inputClass}
        />
      </Field>
      <Field label="Quotes (optional)" htmlFor="brief-quotes" hint="Up to two short quotes, one per line, with who said it.">
        <textarea id="brief-quotes" rows={2} value={brief.quotes} onChange={set("quotes")} className={inputClass} />
      </Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={sending} className={buttonClass.primary}>
          {sending ? <RefreshCw className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
          {sending ? "Drafting… up to 2 min" : "Make card"}
        </button>
        {articleId ? (
          <Link to={`/edit/${articleId}`} className={buttonClass.ghost}>
            Open card
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </form>
  )
}
