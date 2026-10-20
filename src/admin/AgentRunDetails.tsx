import { timeAgo } from "@/admin/rules"
import type { NewsRun } from "@/admin/types"

/* The news agent's last run, for whoever wants the numbers (Мэдээний урсгал → Дэлгэрэнгүй). */

/** Why a run added nothing, in plain words (shown only under "Дэлгэрэнгүй"). */
function runReason(run: NewsRun) {
  const d = run.details ?? {}
  if (run.created) return ""
  if (run.error) return "The run stopped early."
  if (d.feeds_total !== undefined && d.feeds_ok === 0) return "Couldn't read any source."
  if (d.fresh === 0) return "No new stories in the last 1–3 days."
  if (d.new === 0) return "Every new story is already on the board."
  return "Nothing fit this time."
}

/** The last run in detail, for whoever wants to look: numbers, picks, and any problems. */
export function RunDetailsView({ run, problem }: { run: NewsRun | undefined; problem: string }) {
  if (!run && !problem) return <p className="text-muted-foreground text-[12px]">The agent hasn't run yet.</p>
  const d = run?.details ?? {}
  const problems = [problem, run?.error ?? "", ...(d.failures ?? []), ...(d.feeds_failed?.length ? [`Not read: ${d.feeds_failed.join(", ")}`] : [])].filter(
    (line, index, all) => line && all.indexOf(line) === index,
  )
  const stats = [
    ["Sources", d.feeds_total !== undefined ? `${d.feeds_ok}/${d.feeds_total}` : "–"],
    ["Stories read", d.fresh ?? run?.scanned ?? 0],
    ["Picked", d.picked?.length ?? 0],
    ["Carded", run?.created ?? 0],
  ] as const
  return (
    <div className="space-y-3 text-[12px]">
      {run ? (
        <p className="text-muted-foreground">
          Last run {timeAgo(run.startedAt)} · {run.trigger === "cron" ? "scheduled" : "manual"}
          {d.provider ? ` · ${d.provider}` : ""}
          {d.ranking ? ` · ${d.ranking}` : ""}
          {runReason(run) ? ` · ${runReason(run)}` : ""}
        </p>
      ) : null}
      <dl className="grid grid-cols-4 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-muted/60 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-news mt-0.5 text-[15px] tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {d.picked?.length ? (
        <div>
          <p className="font-medium">Picked stories</p>
          <ul className="text-muted-foreground mt-1 space-y-0.5">
            {d.picked.map((pick) => (
              <li key={pick.title}>
                {pick.title} <span className="opacity-70">· {pick.source}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {problems.length ? (
        <div>
          <p className="font-medium">Problems</p>
          <ul className="text-muted-foreground mt-1 space-y-0.5">
            {problems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
