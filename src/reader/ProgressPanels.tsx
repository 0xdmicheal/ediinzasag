import { useState, type CSSProperties } from "react"
import {
  Archive,
  BookMarked,
  BookOpen,
  CalendarDays,
  Coffee,
  Compass,
  Crown,
  Eye,
  Flame,
  Footprints,
  Globe2,
  Lock,
  Mail,
  Moon,
  Pickaxe,
  Sunrise,
  Trophy,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { POINTS_PER_READ, tiers, type Achievement, type AchievementIcon, type Tier, type readerProgress } from "@/reader/achievements"
import { BadgeArt, badgeById } from "@/reader/badges"
import type { OwnedBadge, PointGrant } from "@/reader/types"

type Progress = ReturnType<typeof readerProgress>

const icons: Record<AchievementIcon, LucideIcon> = {
  footprints: Footprints,
  eye: Eye,
  book: BookOpen,
  pickaxe: Pickaxe,
  archive: Archive,
  calendar: CalendarDays,
  flame: Flame,
  hundred: Trophy,
  crown: Crown,
  globe: Globe2,
  compass: Compass,
  mail: Mail,
  bookmark: BookMarked,
  moon: Moon,
  sunrise: Sunrise,
  coffee: Coffee,
}

/** Each metal: rim (conic), face (light → dark), ribbon. */
const metal: Record<Tier, { rim: string; face: [string, string, string]; ribbon: string }> = {
  bronze: {
    rim: "conic-gradient(from 210deg, #fbd5b0, #a0582a, #f0b07a, #6b3a17, #fbd5b0)",
    face: ["#f6c79a", "#b8733a", "#5c2f12"],
    ribbon: "linear-gradient(180deg, #c2410c, #7c2d12)",
  },
  silver: {
    rim: "conic-gradient(from 210deg, #ffffff, #94a3b8, #f1f5f9, #475569, #ffffff)",
    face: ["#f8fafc", "#9aa4b2", "#3f4754"],
    ribbon: "linear-gradient(180deg, #2563eb, #1e3a8a)",
  },
  gold: {
    rim: "conic-gradient(from 210deg, #fff7cc, #c99700, #ffe680, #7a4f00, #fff7cc)",
    face: ["#fff3b0", "#e2a913", "#7a4f00"],
    ribbon: "linear-gradient(180deg, #dc2626, #7f1d1d)",
  },
  legend: {
    rim: "conic-gradient(from 0deg, #f9a8d4, #a78bfa, #38bdf8, #6ee7b7, #fde68a, #f9a8d4)",
    face: ["#e9d5ff", "#7c3aed", "#1e1b4b"],
    ribbon: "linear-gradient(180deg, #a855f7, #312e81)",
  },
}

/**
 * A merit medal: a ribbon behind, a metal rim, a domed face and the icon.
 * Locked medals are greyed out with a progress ring drawn around them.
 */
function Medal({ item, size = 64 }: { item: Achievement; size?: number }) {
  const Icon = icons[item.icon]
  const tone = metal[item.tier]
  const [light, mid, dark] = tone.face
  const share = item.progress / item.goal
  const ring = (size + 10) / 2
  const circumference = 2 * Math.PI * (ring - 2)
  const disc = (scale: number, background: string): CSSProperties => ({ width: size * scale, height: size * scale, background, borderRadius: "9999px" })
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size + 10, height: size + 18 }} aria-hidden>
      {/* Ribbon tails */}
      <span
        className="absolute bottom-0"
        style={{
          width: size * 0.62,
          height: size * 0.5,
          background: tone.ribbon,
          clipPath: "polygon(0 0, 42% 0, 50% 22%, 58% 0, 100% 0, 100% 100%, 76% 80%, 50% 100%, 24% 80%, 0 100%)",
          filter: item.unlocked ? undefined : "grayscale(1) opacity(0.35)",
        }}
      />
      <span className="absolute top-0 grid place-items-center" style={{ width: size + 10, height: size + 10, filter: item.unlocked ? undefined : "grayscale(1) opacity(0.45)" }}>
        <span className={cn("absolute", item.unlocked && item.tier === "legend" && "ez-holo")} style={disc(1, tone.rim)} />
        <span className="absolute" style={disc(0.84, `linear-gradient(160deg, ${dark}, #000)`)} />
        <span className="absolute" style={disc(0.78, `radial-gradient(circle at 32% 26%, ${light}, ${mid} 50%, ${dark})`)} />
        <span className="absolute" style={disc(1, "linear-gradient(165deg, rgb(255 255 255 / 0.55), rgb(255 255 255 / 0.06) 40%, transparent 55%)")} />
        {item.unlocked ? (
          <span className="absolute overflow-hidden rounded-full" style={{ width: size, height: size }}>
            <span className="ez-badge-shine absolute inset-y-0 -left-1/2 w-1/2" />
          </span>
        ) : null}
        <Icon className="relative text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.5)]" style={{ width: size * 0.4, height: size * 0.4 }} strokeWidth={2.3} />
      </span>
      {/* Progress ring and lock for medals still to earn */}
      {item.unlocked ? null : (
        <>
          <svg className="absolute top-0 -rotate-90" width={size + 10} height={size + 10}>
            <circle cx={ring} cy={ring} r={ring - 2} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={3} />
            <circle
              cx={ring}
              cy={ring}
              r={ring - 2}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${circumference * share} ${circumference}`}
            />
          </svg>
          <span className="bg-background text-muted-foreground absolute top-0 right-0 grid size-6 place-items-center rounded-full border">
            <Lock className="size-3" />
          </span>
        </>
      )}
    </span>
  )
}

const tierOrder: Tier[] = ["bronze", "silver", "gold", "legend"]

/**
 * Гавьяа: one tab per metal, so the whole set is a click away instead of a
 * long scroll. Opens on the first metal that still has something to earn.
 */
export function MeritsSection({ progress }: { progress: Progress }) {
  const firstOpen = tierOrder.find((tier) => progress.achievements.some((item) => item.tier === tier && !item.unlocked)) ?? "bronze"
  const [tab, setTab] = useState<Tier>(firstOpen)
  const group = progress.achievements.filter((item) => item.tier === tab)

  return (
    <section aria-labelledby="merits-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="merits-heading" className="font-news text-2xl">
          Гавьяа
        </h2>
        <span className="text-muted-foreground text-[13px] tabular-nums">
          {progress.unlocked} / {progress.achievements.length} нээгдсэн
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-[13px]">Тогтмол, олон талт уншсаны шагнал. Металл хатуу байх тусам олоход хэцүү, оноо нь их.</p>

      <div role="tablist" aria-label="Металл" className="bg-muted mt-4 grid grid-cols-4 gap-1 rounded-xl p-1">
        {tierOrder.map((tier) => {
          const items = progress.achievements.filter((item) => item.tier === tier)
          const done = items.filter((item) => item.unlocked).length
          const selected = tier === tab
          return (
            <button
              key={tier}
              type="button"
              role="tab"
              id={`merit-tab-${tier}`}
              aria-selected={selected}
              aria-controls="merit-panel"
              onClick={() => setTab(tier)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 transition-colors sm:flex-row sm:justify-center sm:gap-2",
                selected ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="size-3 shrink-0 rounded-full" style={{ background: metal[tier].rim }} aria-hidden />
              <span className="text-[13px] font-semibold">{tiers[tier].label}</span>
              <span className="font-mono text-[11px] tabular-nums opacity-70">
                {done}/{items.length}
              </span>
            </button>
          )
        })}
      </div>

      <div id="merit-panel" role="tabpanel" aria-labelledby={`merit-tab-${tab}`} className="mt-4">
        <p className="text-muted-foreground mb-3 text-[12px]">Нэг бүр нь +{tiers[tab].points} оноо.</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {group.map((item) => (
            <li
              key={item.id}
              className={cn("bg-card flex flex-col items-center gap-2 rounded-2xl border p-4 text-center", item.unlocked && "shadow-[0_10px_30px_-18px_rgb(0_0_0/0.5)]")}
              aria-label={`${item.title}: ${item.unlocked ? "нээгдсэн" : `${item.progress}/${item.goal}`}`}
            >
              <Medal item={item} />
              <span className={cn("text-[14px] font-semibold", !item.unlocked && "text-muted-foreground")}>{item.title}</span>
              <span className="text-muted-foreground min-h-8 text-[12px] leading-snug">{item.description}</span>
              <span className={cn("mt-auto font-mono text-[11px] tabular-nums", item.unlocked ? "text-[var(--up)]" : "text-muted-foreground")}>
                {item.unlocked ? `+${tiers[tab].points} оноо авсан` : `${item.progress.toLocaleString("en-US")} / ${item.goal.toLocaleString("en-US")}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function dateLabel(iso: string) {
  if (!iso) return ""
  const date = new Date(iso)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
}

/** Two rows show; longer lists scroll, with a scrollbar that only appears on hover. */
const quietScroll =
  "[scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:color-mix(in_oklab,currentColor_20%,transparent)_transparent]"

const plus = (n: number) => `+${n.toLocaleString("en-US")}`
const minus = (n: number) => `−${n.toLocaleString("en-US")}`

/**
 * Оноо: what was earned, what was spent and what is left, line by line, so the
 * balance always adds up. The level follows points earned (spending never
 * lowers it).
 */
export function PointsLedger({ progress, owned, grants }: { progress: Progress; owned: OwnedBadge[] | null; grants: PointGrant[] }) {
  const spent = (owned ?? []).reduce((sum, item) => sum + item.cost, 0)
  const balance = Math.max(0, progress.points - spent)
  const income = [
    ...grants.map((grant) => ({ label: grant.note || "Бонус", value: grant.points })),
    { label: `Уншсан ${progress.earned.reads.toLocaleString("en-US")} × ${POINTS_PER_READ}`, value: progress.earned.fromReads },
    ...progress.earned.byTier
      .filter((row) => row.count > 0)
      .map((row) => ({ label: `${tiers[row.tier].label} гавьяа ${row.count} × ${tiers[row.tier].points}`, value: row.count * tiers[row.tier].points })),
  ]

  return (
    <section aria-labelledby="points-heading" className="bg-card rounded-xl border">
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="p-4 sm:p-5">
          <p className="text-muted-foreground text-[12px] font-medium">Цуглуулсан</p>
          <p className="font-news mt-1 text-2xl leading-none text-[var(--up)] tabular-nums sm:text-3xl">{plus(progress.points)}</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-muted-foreground text-[12px] font-medium">Зарцуулсан</p>
          <p className="font-news mt-1 text-2xl leading-none text-[var(--down)] tabular-nums sm:text-3xl">{owned === null ? "…" : minus(spent)}</p>
        </div>
        <div className="bg-muted/50 p-4 sm:p-5">
          <p id="points-heading" className="text-[12px] font-semibold">
            Үлдэгдэл
          </p>
          <p className="font-news mt-1 text-3xl leading-none tabular-nums sm:text-4xl">{owned === null ? "…" : balance.toLocaleString("en-US")}</p>
        </div>
      </div>

      <div className="border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[14px] font-semibold">{progress.level}</p>
          <p className="text-muted-foreground text-[12px]">
            {progress.next ? `${progress.next.label} хүртэл ${progress.next.remaining.toLocaleString("en-US")} оноо` : "Хамгийн дээд түвшин"}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Дараагийн түвшин"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((progress.next?.share ?? 1) * 100)}
          className="bg-muted mt-3 h-2.5 overflow-hidden rounded-full border"
        >
          <div className="bg-primary h-full rounded-full" style={{ width: `${(progress.next?.share ?? 1) * 100}%` }} />
        </div>
        <p className="text-muted-foreground mt-2 text-[11.5px]">Түвшин нь цуглуулсан оноогоор тогтоно, тэмдэг авахад буурахгүй.</p>
      </div>

      <div className="grid sm:grid-cols-2 sm:divide-x">
        <div className="p-4 sm:p-5">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">Хаанаас ирсэн</p>
          <ul className={`mt-2 max-h-[5.25rem] divide-y overflow-y-auto overscroll-contain pr-1 ${quietScroll}`}>
            {income.map((row, index) => (
              <li key={`${row.label}-${index}`} className="flex h-[2.625rem] items-center justify-between gap-3 text-[13px]">
                <span>{row.label}</span>
                <span className="font-mono text-[var(--up)] tabular-nums">{plus(row.value)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t p-4 sm:border-t-0 sm:p-5">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">Юунд зарцуулсан</p>
          {owned && owned.length ? (
            <ul className={`mt-2 max-h-[6.5rem] divide-y overflow-y-auto overscroll-contain pr-1 ${quietScroll}`}>
              {owned.map((item) => (
                <li key={item.id} className="flex h-[3.25rem] items-center gap-3 text-[13px]">
                  <BadgeArt id={item.id} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{badgeById.get(item.id)?.name ?? item.id} тэмдэг</span>
                    {item.at ? <span className="text-muted-foreground block font-mono text-[11px]">{dateLabel(item.at)}</span> : null}
                  </span>
                  <span className="font-mono text-[var(--down)] tabular-nums">{minus(item.cost)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-3 text-[13px]">{owned === null ? "Ачаалж байна…" : "Одоогоор тэмдэг аваагүй байна."}</p>
          )}
        </div>
      </div>

      <p className="text-muted-foreground border-t px-4 py-3 text-[12px] sm:px-5">
        Тойм, нийтлэл бүрийг эцэс хүртэл уншихад +{POINTS_PER_READ}. Гавьяа: {tierOrder.map((tier) => `${tiers[tier].label} +${tiers[tier].points}`).join(" · ")}.
      </p>
    </section>
  )
}
