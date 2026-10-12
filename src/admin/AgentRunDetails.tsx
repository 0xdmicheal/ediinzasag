import { timeAgo } from "@/admin/rules"
import type { NewsRun } from "@/admin/types"

/* The news agent's last run, for whoever wants the numbers (Мэдээний урсгал → Дэлгэрэнгүй). */

/** Why a run added nothing, in plain words (shown only under "Дэлгэрэнгүй"). */
function runReason(run: NewsRun) {
  const d = run.details ?? {}
  if (run.created) return ""
  if (run.error) return "Ажиллагаа дутуу дууссан."
  if (d.feeds_total !== undefined && d.feeds_ok === 0) return "Эх сурвалжуудыг уншиж чадсангүй."
  if (d.fresh === 0) return "Сүүлийн 1–3 хоногт шинэ мэдээ гараагүй."
  if (d.new === 0) return "Шинэ мэдээ бүгд самбарт аль хэдийн байна."
  return "Энэ удаад тохирох мэдээ олдсонгүй."
}

/** The last run in detail, for whoever wants to look: numbers, picks, and any problems. */
export function RunDetailsView({ run, problem }: { run: NewsRun | undefined; problem: string }) {
  if (!run && !problem) return <p className="text-muted-foreground text-[12px]">Агент одоогоор ажиллаагүй байна.</p>
  const d = run?.details ?? {}
  const problems = [problem, run?.error ?? "", ...(d.failures ?? []), ...(d.feeds_failed?.length ? [`Уншигдаагүй: ${d.feeds_failed.join(", ")}`] : [])].filter(
    (line, index, all) => line && all.indexOf(line) === index,
  )
  const stats = [
    ["Эх сурвалж", d.feeds_total !== undefined ? `${d.feeds_ok}/${d.feeds_total}` : "–"],
    ["Уншсан мэдээ", d.fresh ?? run?.scanned ?? 0],
    ["Сонгосон", d.picked?.length ?? 0],
    ["Нэмсэн", run?.created ?? 0],
  ] as const
  return (
    <div className="space-y-3 text-[12px]">
      {run ? (
        <p className="text-muted-foreground">
          Сүүлд {timeAgo(run.startedAt)} · {run.trigger === "cron" ? "автомат" : "гараар"}
          {d.provider ? ` · ${d.provider}` : ""}
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
          <p className="font-medium">Сонгосон мэдээ</p>
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
          <p className="font-medium">Асуудал</p>
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
