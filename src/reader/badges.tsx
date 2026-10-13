import { useRef, useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { ChartCandlestick, Coins, Crown, Fuel, Gem, Landmark, Mountain, Pickaxe, Rocket, Route, Sparkles, TrainFront, TrendingDown, TrendingUp, Wheat, Wind, type LucideIcon } from "lucide-react"
import { Popover } from "radix-ui"

import { useReader } from "@/reader/session"

/*
 * Reader badges. Each one is its own design: a shape, colours and an icon, set
 * in a metal rim whose finish shows how rare it is. They are bought with points
 * (the database checks the balance, see buy_badge() in supabase/schema.sql);
 * "Анхдагч" is free and only for the first 3,000 readers, numbered, so every
 * founder badge is one of a kind. Keep ids and costs in step with
 * public.badge_catalog.
 */

export const FOUNDER_LIMIT = 3000

type Shape = "circle" | "hexagon" | "shield" | "diamond" | "octagon" | "burst" | "squircle"

export type Rarity = "common" | "rare" | "epic" | "legendary"

export const rarityLabel: Record<Rarity, string> = { common: "Энгийн", rare: "Ховор", epic: "Эрхэм", legendary: "Домог" }

/** Rim metal per rarity: brushed steel, gold, violet gold, and a holographic sweep for legends. */
const rim: Record<Rarity, string> = {
  common: "conic-gradient(from 200deg, #f1f5f9, #94a3b8, #e2e8f0, #64748b, #f1f5f9)",
  rare: "conic-gradient(from 200deg, #fff7cc, #d4a017, #fde68a, #92650a, #fff7cc)",
  epic: "conic-gradient(from 200deg, #f5d0fe, #a855f7, #fde68a, #6b21a8, #f5d0fe)",
  legendary: "conic-gradient(from 0deg, #f9a8d4, #a78bfa, #38bdf8, #6ee7b7, #fde68a, #f9a8d4)",
}

export interface BadgeDef {
  id: string
  name: string
  description: string
  /** Points; null for the founder badge (free, first 3,000 readers). */
  cost: number | null
  icon: LucideIcon
  shape: Shape
  rarity: Rarity
  /** Face gradient stops, light to dark. */
  colors: [string, string, string]
}

export const badges: BadgeDef[] = [
  { id: "founder", name: "Анхдагч", description: "Сайтын анхны уншигчдын тэмдэг", cost: null, icon: Sparkles, shape: "burst", rarity: "legendary", colors: ["#f9a8d4", "#a78bfa", "#38bdf8"] },
  { id: "tugrik", name: "Төгрөг", description: "Анхны тэмдэг", cost: 200, icon: Coins, shape: "circle", rarity: "common", colors: ["#6ee7b7", "#10b981", "#047857"] },
  { id: "copper", name: "Зэс", description: "Оюу толгойн гялбаа", cost: 500, icon: Pickaxe, shape: "hexagon", rarity: "common", colors: ["#fdba74", "#ea580c", "#9a3412"] },
  { id: "candle", name: "Ногоон лаа", description: "Өсөлтийн өдөр", cost: 900, icon: ChartCandlestick, shape: "squircle", rarity: "common", colors: ["#bef264", "#65a30d", "#3f6212"] },
  { id: "wheat", name: "Улаан буудай", description: "Атар газрын ургац", cost: 700, icon: Wheat, shape: "circle", rarity: "common", colors: ["#fde68a", "#ca8a04", "#713f12"] },
  { id: "coal", name: "Нүүрс", description: "Тавантолгойн хар алт", cost: 1200, icon: Mountain, shape: "octagon", rarity: "rare", colors: ["#cbd5e1", "#475569", "#0f172a"] },
  { id: "bull", name: "Бух", description: "Зах зээл өсөхөд", cost: 1800, icon: TrendingUp, shape: "shield", rarity: "rare", colors: ["#86efac", "#16a34a", "#14532d"] },
  { id: "bear", name: "Баавгай", description: "Зах зээл унахад", cost: 1800, icon: TrendingDown, shape: "shield", rarity: "rare", colors: ["#fda4af", "#e11d48", "#881337"] },
  { id: "railway", name: "Төмөр зам", description: "Хилийн боомт хүртэл", cost: 2000, icon: TrainFront, shape: "shield", rarity: "rare", colors: ["#fca5a5", "#b91c1c", "#450a0a"] },
  { id: "oil", name: "Нефть", description: "Brent-ийн долгион", cost: 2500, icon: Fuel, shape: "squircle", rarity: "rare", colors: ["#fcd34d", "#b45309", "#1c1917"] },
  { id: "gold", name: "Алт", description: "Нөөцийн хаан", cost: 3500, icon: Gem, shape: "diamond", rarity: "epic", colors: ["#fef08a", "#f59e0b", "#b45309"] },
  { id: "silkroad", name: "Торгоны зам", description: "Худалдааны их зам", cost: 5000, icon: Route, shape: "hexagon", rarity: "epic", colors: ["#5eead4", "#0d9488", "#134e4a"] },
  { id: "windfarm", name: "Салхин парк", description: "Говийн ногоон эрчим хүч", cost: 4500, icon: Wind, shape: "octagon", rarity: "epic", colors: ["#a5f3fc", "#0891b2", "#164e63"] },
  { id: "eurobond", name: "Евробонд", description: "Гадаад зах зээлд", cost: 6500, icon: Landmark, shape: "octagon", rarity: "epic", colors: ["#93c5fd", "#2563eb", "#1e3a8a"] },
  { id: "unicorn", name: "Юникорн", description: "Тэрбумын стартап", cost: 8000, icon: Rocket, shape: "circle", rarity: "legendary", colors: ["#fda4af", "#8b5cf6", "#1e1b4b"] },
  { id: "economist", name: "Эдийн засагч", description: "Хамгийн дээд тэмдэг", cost: 12000, icon: Crown, shape: "burst", rarity: "legendary", colors: ["#f0abfc", "#c026d3", "#581c87"] },
]

export const badgeById = new Map(badges.map((badge) => [badge.id, badge]))

const clip: Record<Shape, string> = {
  circle: "circle(50% at 50% 50%)",
  squircle: "inset(0 round 30%)",
  hexagon: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
  octagon: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
  diamond: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
  shield: "polygon(50% 0, 96% 14%, 92% 60%, 50% 100%, 8% 60%, 4% 14%)",
  burst:
    "polygon(50% 0, 61% 15%, 79% 9%, 79% 27%, 97% 33%, 87% 50%, 97% 67%, 79% 73%, 79% 91%, 61% 85%, 50% 100%, 39% 85%, 21% 91%, 21% 73%, 3% 67%, 13% 50%, 3% 33%, 21% 27%, 21% 9%, 39% 15%)",
}

/** Icon scale per shape, so it sits inside the narrower shapes. */
const iconScale: Record<Shape, number> = { circle: 0.42, squircle: 0.44, hexagon: 0.4, octagon: 0.42, diamond: 0.32, shield: 0.38, burst: 0.34 }

/** Not owned yet: still in colour (it is a shop), just softer. */
const lockedFilter = "saturate(0.45) opacity(0.55)"

/**
 * The badge: a metal rim (finish by rarity), a dark groove, the coloured face
 * with a soft dome light, an engraved inner ring, the icon, and on owned
 * badges a light that sweeps across now and then (ez-badge-shine).
 */
export function BadgeArt({ id, size = 56, locked = false }: { id: string; size?: number; locked?: boolean }) {
  const badge = badgeById.get(id)
  if (!badge) return null
  const [light, mid, dark] = badge.colors
  const Icon = badge.icon
  const shape = clip[badge.shape]
  const layer = (scale: number, background: string, extra?: CSSProperties): CSSProperties => ({
    width: size * scale,
    height: size * scale,
    clipPath: shape,
    background,
    ...extra,
  })
  const legendary = badge.rarity === "legendary"
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size, filter: locked ? lockedFilter : undefined }} aria-hidden>
      {/* Rim */}
      <span className={`absolute ${legendary && !locked ? "ez-holo" : ""}`} style={layer(1, rim[badge.rarity])} />
      {/* Groove between rim and face */}
      <span className="absolute" style={layer(0.86, `linear-gradient(160deg, ${dark}, #000)`)} />
      {/* Face with a dome light */}
      <span className="absolute" style={layer(0.8, `radial-gradient(circle at 32% 26%, ${light}, ${mid} 48%, ${dark} 100%)`)} />
      {/* Engraved inner ring */}
      <span className="absolute" style={layer(0.66, `radial-gradient(circle at 60% 70%, ${mid}, ${dark})`, { opacity: 0.55 })} />
      <span className="absolute" style={layer(0.62, `radial-gradient(circle at 34% 28%, ${light}, ${mid} 55%, ${dark})`)} />
      {/* Gloss on the upper half */}
      <span className="absolute" style={layer(1, "linear-gradient(165deg, rgb(255 255 255 / 0.5), rgb(255 255 255 / 0.08) 38%, transparent 52%)")} />
      {/* Sweep of light, owned badges only */}
      {locked ? null : (
        <span className="absolute overflow-hidden" style={{ width: size, height: size, clipPath: shape }}>
          <span className="ez-badge-shine absolute inset-y-0 -left-1/2 w-1/2" />
        </span>
      )}
      <span className="absolute inset-0 grid place-items-center">
        <Icon
          className="text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.45)]"
          style={{ width: size * iconScale[badge.shape], height: size * iconScale[badge.shape] }}
          strokeWidth={2.4}
        />
      </span>
    </span>
  )
}

/**
 * Small worn badge next to a name. Hover (or tap, or focus) shows a card with
 * the badge, its name and how to get it, plus a nudge to start collecting.
 */
export function BadgeMark({ id, memberNo, size = 18 }: { id: string; memberNo?: number | null; size?: number }) {
  const { reader, openLogin } = useReader()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const badge = badgeById.get(id)
  if (!badge) return null
  const founder = badge.id === "founder"
  const number = founder && memberNo ? `№${String(memberNo).padStart(4, "0")}` : ""
  const title = number ? `${badge.name} ${number}` : badge.name

  const show = () => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  // A short delay lets the pointer travel from the badge onto the card.
  const hide = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 140)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Тэмдэг: ${title}`}
          onPointerEnter={(event) => event.pointerType === "mouse" && show()}
          onPointerLeave={(event) => event.pointerType === "mouse" && hide()}
          className="focus-visible:ring-brand/50 inline-flex cursor-help rounded-full align-middle outline-none focus-visible:ring-2"
        >
          <BadgeArt id={id} size={size} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={show}
          onPointerLeave={hide}
          className="bg-background text-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 z-[120] w-64 rounded-xl border p-3 text-left shadow-xl"
        >
          <div className="flex items-center gap-3">
            <BadgeArt id={id} size={44} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">
                {badge.name}
                {number ? <span className="text-muted-foreground ml-1.5 font-mono text-[12px] font-normal">{number}</span> : null}
              </p>
              <p className="text-muted-foreground text-[12px] leading-snug">{badge.description}</p>
            </div>
          </div>
          <p className="bg-muted mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium">
            {founder ? (
              <>
                <Sparkles className="size-3.5 shrink-0 text-violet-500" />
                Эхний {FOUNDER_LIMIT.toLocaleString("en-US")} уншигчид үнэгүй
              </>
            ) : (
              <>
                <Coins className="size-3.5 shrink-0 text-amber-500" />
                <span>
                  <strong className="tabular-nums">{badge.cost}</strong> оноогоор авна
                </span>
              </>
            )}
          </p>
          {reader ? (
            <Link to="/account" className="text-muted-foreground hover:text-foreground mt-2 block text-[12px] underline-offset-2 hover:underline">
              Миний оноо, тэмдгүүд →
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openLogin()
              }}
              className="bg-foreground text-background hover:bg-foreground/85 mt-2 w-full rounded-full py-1.5 text-[12px] font-semibold transition-colors"
            >
              Нэвтэрч оноо цуглуулах
            </button>
          )}
          <Popover.Arrow className="fill-background" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
