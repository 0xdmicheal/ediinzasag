import { Link } from "react-router-dom"
import { X } from "lucide-react"

import { isEditor } from "@/admin/rules"
import type { Member } from "@/admin/types"
import { Button } from "@/components/ui/button"

const key = (member: Member) => `ez-admin-guide-${member.id}`

function seen(member: Member) {
  try {
    return localStorage.getItem(key(member)) === "1"
  } catch {
    return false
  }
}

const link = "text-foreground underline underline-offset-4"

/** How a story moves through the newsroom. */
const steps = [
  {
    title: "Write",
    body: (
      <>
        Start a <Link to="/new" className={link}>New story</Link>, or pick one the agent found in{" "}
        <Link to="/" className={link}>News</Link>. Everything saves as you type.
      </>
    ),
  },
  { title: "Send for review", body: <>Press «Send» at the top right, finish the readiness checklist, and it goes to an editor.</> },
  { title: "Revise", body: <>If the editor asks for changes, the story comes back to your To do with their note on top.</> },
  { title: "Publish", body: <>The editor approves and publishes it, or schedules a time. Need a fix after that? Ask your editor.</> },
]

/** EZ Writing System v2.1: the rules new writers trip on first. Examples stay in Mongolian. */
const rules = [
  <>Link sources inline, on the name that carries the fact. No source list at the end.</>,
  <>Every figure gets a base and a period: «өнгөрсөн оны мөн үеэс 12 хувиар».</>,
  <>Write as a Mongolian journalist, never like a translation.</>,
  <>No label headings («Яагаад чухал вэ», «Дүгнэлт»). A subhead states its section's point.</>,
  <>«хувь» in the text, quotes in «», no exclamation marks.</>,
]

/**
 * The dashboard's welcome: the four steps and the house rules, shown until the member closes
 * it once. «Guide» in the sidebar brings it back.
 */
export function WelcomeGuide({ member, onClose }: { member: Member; onClose: () => void }) {
  const close = () => {
    try {
      localStorage.setItem(key(member), "1")
    } catch {
      // Private mode: it just shows again next time.
    }
    onClose()
  }
  return (
    <section aria-labelledby="guide-title" className="bg-card relative rounded-xl border">
      <button
        type="button"
        onClick={close}
        aria-label="Close guide"
        className="text-muted-foreground hover:text-foreground hover:bg-background absolute top-3 right-3 grid size-8 place-items-center rounded-lg"
      >
        <X className="size-4" />
      </button>
      <div className="grid gap-8 p-6 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div>
          <p className="text-muted-foreground text-[13px]">Welcome to the newsroom</p>
          <h2 id="guide-title" className="ez-title mt-1 text-[1.75rem] leading-tight">
            Four steps from draft to published
          </h2>
          <ol className="mt-5 divide-y">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <span className="bg-background text-muted-foreground grid size-6 shrink-0 place-items-center rounded-md text-[12px] tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[14px] font-medium">{step.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-[13px] leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:border-l lg:pl-12">
          <p className="text-[14px] font-medium">House rules</p>
          <p className="text-muted-foreground text-[12px]">EZ Writing System v2.1</p>
          <ul className="mt-3 space-y-2.5">
            {rules.map((rule, index) => (
              <li key={index} className="text-muted-foreground border-foreground/15 border-l-2 pl-3 text-[13px] leading-relaxed">
                {rule}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-4 text-[12px] leading-relaxed">
            {isEditor(member)
              ? "When you ask for changes, say what to fix and why in the note."
              : "Unsure? Ask your editor. Use «Preview» to see the story as readers will."}
          </p>
          <Button variant="outline" onClick={close} className="mt-5 h-9 px-4">
            Got it
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Shown until the member closes it once. */
WelcomeGuide.initiallyOpen = (member: Member) => !seen(member)
