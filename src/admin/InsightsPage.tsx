import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { Bot, ChevronDown, Lock, Table2 } from "lucide-react"
import { cn } from "cn"

import { canManageTeam, roleLabel, timeAgo } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { Avatar, Notice, RoleBadge } from "@/admin/ui"
import type { AuthorStats, Insights } from "@/admin/types"
import { genderLabel, type Gender } from "@/reader/types"
import { regionLabel } from "@/reader/regions"

/*
 * Admin-only monitoring: audience (age, gender, region, sign-ups), reading
 * activity, each team member's progress and the news agent. Personal details
 * reach the browser as counts only (admin_insights() in schema.sql).
 * Every chart is a single measure in the brand hue; categories are told apart
 * by their labels, and each chart has a table view.
 */

const number = new Intl.NumberFormat("mn-MN")
const fmt = (value: number) => number.format(Math.round(value))
const percent = (value: number, total: number) => (total ? `${Math.round((value / total) * 100)}%` : "0%")

const ageOrder = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+", "unknown"]
const ageLabel = (bucket: string) => (bucket === "unknown" ? "Тодорхойгүй" : bucket)
const genderName = (key: string) => (key in genderLabel ? genderLabel[key as Gender] : "Тодорхойгүй")
const shortDate = (iso: string) => iso.slice(5).replace("-", ".")

interface Datum {
  key: string
  label: string
  value: number
  detail?: string
}

function ChartCard({ title, subtitle, table, children, className }: { title: string; subtitle?: string; table: Datum[]; children: ReactNode; className?: string }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section className={cn("bg-card flex flex-col rounded-xl border p-4 sm:p-5", className)}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {subtitle ? <p className="text-muted-foreground mt-0.5 text-[12px]">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          aria-pressed={showTable}
          onClick={() => setShowTable((value) => !value)}
          className={cn(
            "text-muted-foreground hover:text-foreground grid size-8 shrink-0 place-items-center rounded-md transition-colors",
            showTable && "bg-foreground/[0.07] text-foreground",
          )}
          aria-label="Хүснэгтээр харах"
          title="Хүснэгтээр харах"
        >
          <Table2 className="size-4" />
        </button>
      </header>
      <div className="mt-4 flex-1">
        {showTable ? (
          <table className="w-full text-[13px]">
            <tbody>
              {table.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="py-1.5">{row.label}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{fmt(row.value)}</td>
                  {row.detail ? <td className="text-muted-foreground py-1.5 pl-3 text-right font-mono text-[12px] tabular-nums">{row.detail}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-[12px]">{label}</p>
      <p className="font-news mt-1 text-[1.75rem] leading-none tabular-nums">{value}</p>
      {note ? <p className="text-muted-foreground mt-1.5 text-[12px]">{note}</p> : null}
    </div>
  )
}

/** Vertical columns from a shared baseline, 4px rounded tops, 2px gaps, tooltip on hover/focus. */
function Columns({ data, unit, labelEvery = 1 }: { data: Datum[]; unit: string; labelEvery?: number }) {
  const max = Math.max(1, ...data.map((item) => item.value))
  const [active, setActive] = useState<number | null>(null)
  return (
    <div className="relative">
      <div className="text-muted-foreground mb-1 text-right font-mono text-[10px] tabular-nums">{fmt(max)}</div>
      <div className="border-foreground/15 relative flex h-40 items-end gap-[2px] border-b" onMouseLeave={() => setActive(null)}>
        {/* Recessive mid gridline. */}
        <div aria-hidden className="border-foreground/[0.07] pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed" />
        {data.map((item, index) => (
          <button
            key={item.key}
            type="button"
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            aria-label={`${item.label}: ${fmt(item.value)} ${unit}`}
            className="group relative flex h-full flex-1 items-end focus-visible:outline-none"
          >
            <span
              className={cn("bg-brand block w-full rounded-t-[4px] transition-opacity", active !== null && active !== index && "opacity-45")}
              style={{ height: `${Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100)}%` }}
            />
          </button>
        ))}
        {active !== null ? (
          <div
            role="status"
            className="bg-popover text-popover-foreground pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-md"
            style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
          >
            <span className="text-muted-foreground block">{data[active].label}</span>
            <span className="font-mono font-semibold tabular-nums">
              {fmt(data[active].value)} {unit}
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {data.map((item, index) => (
          <span key={item.key} className="text-muted-foreground flex-1 truncate text-center font-mono text-[10px]">
            {index % labelEvery === 0 ? item.label : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Ranked horizontal bars with the share and count printed beside each. */
function RankBars({ data, limit = 8 }: { data: Datum[]; limit?: number }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const shown = sorted.slice(0, limit)
  const rest = sorted.slice(limit).reduce((sum, item) => sum + item.value, 0)
  const rows = rest > 0 ? [...shown, { key: "other", label: "Бусад", value: rest }] : shown
  const max = Math.max(1, ...rows.map((item) => item.value))
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((item) => (
        <li key={item.key} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-[13px]" title={`${item.label}: ${fmt(item.value)}`}>
          <span className="truncate">{item.label}</span>
          <span className="bg-foreground/[0.05] h-2.5 overflow-hidden rounded-r-[4px]">
            <span className="bg-brand block h-full rounded-r-[4px]" style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
          <span className="text-muted-foreground w-20 text-right font-mono text-[12px] tabular-nums">
            {percent(item.value, total)} · {fmt(item.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Daily reads as a 2px line over a soft area, with a crosshair tooltip. */
function ReadsLine({ points }: { points: Insights["reading"] }) {
  const [active, setActive] = useState<number | null>(null)
  const width = 600
  const height = 160
  const max = Math.max(1, ...points.map((point) => point.reads))
  const x = (index: number) => (points.length < 2 ? width / 2 : (index / (points.length - 1)) * width)
  const y = (value: number) => height - (value / max) * (height - 8)
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.reads).toFixed(1)}`).join(" ")
  const area = `${line} L${width},${height} L0,${height} Z`

  function onMove(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))))
  }

  const current = active !== null ? points[active] : null
  return (
    <div className="relative">
      <div className="text-muted-foreground mb-1 text-right font-mono text-[10px] tabular-nums">{fmt(max)}</div>
      <div className="relative h-40">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="size-full overflow-visible" role="img" aria-label="Өдөр бүрийн уншилт, сүүлийн 30 хоног">
          <line x1="0" x2={width} y1={height / 2} y2={height / 2} className="stroke-foreground/[0.07]" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={width} y1={height} y2={height} className="stroke-foreground/15" vectorEffect="non-scaling-stroke" />
          <path d={area} className="fill-[var(--brand)]" fillOpacity={0.12} />
          <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {current && active !== null ? (
            <line x1={x(active)} x2={x(active)} y1={0} y2={height} className="stroke-foreground/30" vectorEffect="non-scaling-stroke" />
          ) : null}
          <rect width={width} height={height} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
        </svg>
        {current && active !== null ? (
          // HTML marker in the same box as the SVG, so it stays round while the SVG stretches.
          <span
            aria-hidden
            className="bg-brand ring-background pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
            style={{ left: `${(x(active) / width) * 100}%`, top: `${(y(current.reads) / height) * 100}%` }}
          />
        ) : null}
      </div>
      {current && active !== null ? (
        <>
          <div
            role="status"
            // Beside the crosshair (flipped near the right edge) so it never covers the marker.
            className={cn(
              "bg-popover text-popover-foreground pointer-events-none absolute top-5 z-10 rounded-md border px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-md",
              x(active) / width > 0.7 ? "-translate-x-[calc(100%+0.75rem)]" : "translate-x-3",
            )}
            style={{ left: `${(x(active) / width) * 100}%` }}
          >
            <span className="text-muted-foreground block">{current.day.replace(/-/g, ".")}</span>
            <span className="font-mono font-semibold tabular-nums">{fmt(current.reads)} уншилт</span>
            <span className="text-muted-foreground block font-mono tabular-nums">{fmt(current.readers)} уншигч</span>
          </div>
        </>
      ) : null}
      <div className="text-muted-foreground mt-1.5 flex justify-between font-mono text-[10px]">
        <span>{points[0] ? shortDate(points[0].day) : ""}</span>
        <span>{points.at(-1) ? shortDate(points.at(-1)!.day) : ""}</span>
      </div>
    </div>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  return (
    <span className="bg-foreground/[0.05] inline-block h-1.5 w-16 overflow-hidden rounded-r-[4px] align-middle">
      <span className="bg-brand block h-full rounded-r-[4px]" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
  )
}

function AuthorTable({ authors }: { authors: AuthorStats[] }) {
  const maxPublished = Math.max(1, ...authors.map((author) => author.published30d))
  const maxReads = Math.max(1, ...authors.map((author) => author.reads))
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[56rem] text-[13px]">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-[11px]">
            <th className="px-4 py-2 font-medium sm:pl-0">Гишүүн</th>
            <th className="px-2 py-2 font-medium">Нийтэлсэн · 30 хоног</th>
            <th className="px-2 py-2 text-right font-medium">Нийт</th>
            <th className="px-2 py-2 text-right font-medium">Явцад</th>
            <th className="px-2 py-2 text-right font-medium">Ноорог</th>
            <th className="px-2 py-2 text-right font-medium">Засвар хүссэн</th>
            <th className="px-2 py-2 text-right font-medium" title="Агентын мэдээнээс авч засварласан">
              Агентаас
            </th>
            <th className="px-2 py-2 text-right font-medium" title="Ноорог эхэлснээс нийтлэх хүртэлх дундаж хугацаа">
              Дундаж хугацаа
            </th>
            <th className="px-2 py-2 font-medium">Уншилт</th>
            <th className="px-2 py-2 text-right font-medium">🔥</th>
            <th className="px-2 py-2 text-right font-medium" title="Батлах, засвар хүсэх, нийтлэх шийдвэр">
              Хянасан
            </th>
            <th className="px-4 py-2 text-right font-medium sm:pr-0">Сүүлд</th>
          </tr>
        </thead>
        <tbody>
          {authors.map((author) => (
            <tr key={author.id} className="border-b last:border-0">
              <td className="px-4 py-2.5 sm:pl-0">
                <span className="flex items-center gap-2">
                  <Avatar name={author.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{author.name}</span>
                    <RoleBadge role={author.role} />
                  </span>
                </span>
              </td>
              <td className="px-2 py-2.5">
                <span className="flex items-center gap-2">
                  <MiniBar value={author.published30d} max={maxPublished} />
                  <span className="font-mono tabular-nums">{fmt(author.published30d)}</span>
                </span>
              </td>
              <td className="px-2 py-2.5 text-right font-mono tabular-nums">{fmt(author.published)}</td>
              <td className="px-2 py-2.5 text-right font-mono tabular-nums">{fmt(author.inProgress)}</td>
              <td className="px-2 py-2.5 text-right font-mono tabular-nums">{fmt(author.drafts)}</td>
              <td className={cn("px-2 py-2.5 text-right font-mono tabular-nums", author.changesRequested > 0 && "text-[var(--down)]")}>
                {fmt(author.changesRequested)}
              </td>
              <td className="px-2 py-2.5 text-right font-mono tabular-nums">{fmt(author.claimed)}</td>
              <td className="text-muted-foreground px-2 py-2.5 text-right font-mono tabular-nums">
                {author.hoursToPublish === null ? "–" : author.hoursToPublish < 48 ? `${author.hoursToPublish} ц` : `${Math.round(author.hoursToPublish / 24)} хоног`}
              </td>
              <td className="px-2 py-2.5">
                <span className="flex items-center gap-2">
                  <MiniBar value={author.reads} max={maxReads} />
                  <span className="font-mono tabular-nums">{fmt(author.reads)}</span>
                </span>
              </td>
              <td className="px-2 py-2.5 text-right font-mono tabular-nums">{fmt(author.fires)}</td>
              <td className="px-2 py-2.5 text-right font-mono tabular-nums">{fmt(author.reviews)}</td>
              <td className="text-muted-foreground px-4 py-2.5 text-right text-[12px] whitespace-nowrap sm:pr-0">
                {author.lastActive ? timeAgo(author.lastActive) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** "Амжилтгүй" label; hovering or focusing it shows what went wrong. */
function FailedRun({ run }: { run: Insights["agent"]["runs"][number] }) {
  const lines = [run.error, ...(run.details?.failures ?? [])].filter((line, index, all) => line && all.indexOf(line) === index)
  return (
    <span className="group relative">
      <button
        type="button"
        aria-describedby={`run-error-${run.id}`}
        className="bg-foreground/[0.07] text-muted-foreground hover:text-foreground focus-visible:text-foreground cursor-help rounded-full px-2 py-0.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
      >
        Амжилтгүй
      </button>
      <span
        role="tooltip"
        id={`run-error-${run.id}`}
        className="bg-popover text-popover-foreground pointer-events-none invisible absolute right-0 bottom-full z-20 mb-2 w-80 rounded-lg border p-3 text-left text-[12px] leading-relaxed opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {lines.length ? (
          <span className="flex flex-col gap-1.5">
            {lines.map((line) => (
              <span key={line} className="break-words">
                {line}
              </span>
            ))}
          </span>
        ) : (
          "Шалтгаан бүртгэгдээгүй."
        )}
      </span>
    </span>
  )
}

/** Past agent runs, folded away by default; failures are just marked, with the reason on hover. */
function RunHistory({ runs }: { runs: Insights["agent"]["runs"] }) {
  const [open, setOpen] = useState(false)
  if (runs.length === 0) return <p className="text-muted-foreground mt-4 text-[13px]">Агент одоогоор ажиллаагүй байна.</p>
  return (
    <div className="mt-4 border-t pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[12px]"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        Ажиллагааны түүх ({runs.length})
      </button>
      {open ? (
        <ul className="mt-2 divide-y text-[13px]">
          {runs.map((run) => (
            <li key={run.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                {timeAgo(run.startedAt)} <span className="text-muted-foreground">· {run.trigger === "cron" ? "автомат" : "гараар"}</span>
              </span>
              {run.error && !run.created ? (
                <FailedRun run={run} />
              ) : (
                <span className="text-muted-foreground font-mono text-[12px] tabular-nums">{fmt(run.created)} нэмсэн</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function InsightsPage() {
  const { backend, member } = useTeam()
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!canManageTeam(member)) return
    backend.insights().then(setData, (failure: Error) => setError(failure.message))
  }, [backend, member])

  const view = useMemo(() => {
    if (!data) return null
    const { readers } = data
    const ages: Datum[] = ageOrder.map((bucket) => ({ key: bucket, label: ageLabel(bucket), value: readers.ages[bucket] ?? 0 }))
    const genders: Datum[] = Object.entries(readers.genders).map(([key, value]) => ({ key, label: genderName(key), value }))
    const regions: Datum[] = Object.entries(readers.regions).map(([key, value]) => ({ key, label: regionLabel(key), value }))
    const weeks: Datum[] = readers.weeks.map((week) => ({ key: week.week, label: shortDate(week.week), value: week.n }))
    const reading: Datum[] = data.reading.map((day) => ({ key: day.day, label: day.day.replace(/-/g, "."), value: day.reads, detail: `${fmt(day.readers)} уншигч` }))
    const reads30 = data.reading.reduce((sum, day) => sum + day.reads, 0)
    const known = readers.total - (readers.regions.unknown ?? 0)
    return { ages, genders, regions, weeks, reading, reads30, known }
  }, [data])

  if (!canManageTeam(member)) return <Navigate to="/admin" replace />

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Зөвхөн админ</p>
          <h1 className="font-news mt-1 text-3xl">Хяналт</h1>
          <p className="text-muted-foreground mt-1 text-[14px]">Уншигчид, багийн явц, мэдээний агентын ажил.</p>
        </div>
        <p className="text-muted-foreground flex max-w-sm items-start gap-1.5 text-[12px] leading-relaxed">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Нас, хүйс, байршлыг зөвхөн нэгтгэсэн тоогоор харуулна. Хувь хүний мэдээлэл энд гарахгүй.
        </p>
      </header>

      {backend.mode === "demo" ? <Notice>Демо горим: уншигчдын тоо жишээ өгөгдөл. Багийн явц энэ хөтөч дээрх нийтлэлээс тооцогдоно.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <p className="text-muted-foreground text-sm">Ачаалж байна…</p> : null}

      {data && view ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Бүртгэлтэй уншигч" value={fmt(data.readers.total)} note={`+${fmt(data.readers.new7)} энэ 7 хоногт`} />
            <StatTile label="Шинэ уншигч · 30 хоног" value={fmt(data.readers.new30)} />
            <StatTile label="Идэвхтэй уншигч · 30 хоног" value={fmt(data.readers.active30)} note={`${percent(data.readers.active30, data.readers.total)} нь уншсан`} />
            <StatTile label="Уншилт · 30 хоног" value={fmt(view.reads30)} />
          </div>

          <ChartCard title="Өдөр бүрийн уншилт" subtitle="Сүүлийн 30 хоног · эцэс хүртэл уншсан тойм" table={view.reading}>
            <ReadsLine points={data.reading} />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Насны бүлэг" subtitle="Бүртгэлтэй уншигчид" table={view.ages}>
              <Columns data={view.ages} unit="уншигч" />
            </ChartCard>
            <ChartCard title="Шинэ бүртгэл" subtitle="7 хоног бүр · сүүлийн 12 долоо хоног" table={view.weeks}>
              <Columns data={view.weeks} unit="шинэ уншигч" labelEvery={2} />
            </ChartCard>
            <ChartCard title="Байршил" subtitle={`Профайлдаа сонгосон · ${percent(view.known, data.readers.total)} нь хариулсан`} table={view.regions}>
              <RankBars data={view.regions} />
            </ChartCard>
            <ChartCard title="Хүйс" subtitle="Бүртгэлтэй уншигчид" table={view.genders}>
              <RankBars data={view.genders} />
            </ChartCard>
          </div>

          <section className="bg-card rounded-xl border p-4 sm:p-5">
            <h2 className="text-[14px] font-semibold">Багийн явц</h2>
            <p className="text-muted-foreground mt-0.5 mb-4 text-[12px]">
              Гишүүн бүрийн нийтлэл, хянасан шийдвэр, уншигчийн хариу. {Object.values(roleLabel).join(", ")} бүгд.
            </p>
            <AuthorTable authors={data.authors} />
          </section>

          <section className="bg-card rounded-xl border p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold">
              <Bot className="size-4" />
              Мэдээний агент
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatTile label="Авах хүнээ хүлээж буй" value={fmt(data.agent.waiting)} />
              <StatTile label="Засварлаж буй" value={fmt(data.agent.claimed)} />
              <StatTile label="Нийтлэгдсэн" value={fmt(data.agent.published)} />
            </div>
            <RunHistory runs={data.agent.runs} />
          </section>
        </>
      ) : null}
    </div>
  )
}
