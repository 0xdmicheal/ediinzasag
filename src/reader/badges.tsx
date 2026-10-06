import { useRef, useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { ChartCandlestick, Coins, Crown, Gem, Landmark, Pickaxe, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react"
import { Popover } from "radix-ui"

import { useReader } from "@/reader/session"

/*
 * Reader badges. Each one is its own design: a different shape, colours and
 * icon. Most are bought with points (the database checks the balance, see
 * buy_badge() in supabase/schema.sql); "Анхдагч" is free and only for the
 * first 3,000 readers, numbered, so every founder badge is one of a kind.
 * Keep ids and costs in step with public.badge_catalog.
 */

export const FOUNDER_LIMIT = 3000

type Shape = "circle" | "hexagon" | "shield" | "diamond" | "octagon" | "burst" | "squircle"

export interface BadgeDef {
  id: string
  name: string
  description: string
  /** Points; null for the founder badge (free, first 3,000 readers). */
  cost: number | null
  icon: LucideIcon
  shape: Shape
  /** Gradient stops, light to dark. */
  colors: [string, string, string]
}

export const badges: BadgeDef[] = [
  {
    id: "founder",
    name: "Анхдагч",
    description: "Сайтын анхны уншигчдын тэмдэг",
    cost: null,
    icon: Sparkles,
    shape: "burst",
    colors: ["#f9a8d4", "#a78bfa", "#38bdf8"],
  },
  { id: "tugrik", name: "Төгрөг", description: "Анхны тэмдэг", cost: 50, icon: Coins, shape: "circle", colors: ["#6ee7b7", "#10b981", "#047857"] },
  { id: "copper", name: "Зэс", description: "Оюу толгойн гялбаа", cost: 150, icon: Pickaxe, shape: "hexagon", colors: ["#fdba74", "#ea580c", "#9a3412"] },
  { id: "candle", name: "Ногоон лаа", description: "Өсөлтийн өдөр", cost: 250, icon: ChartCandlestick, shape: "squircle", colors: ["#bef264", "#65a30d", "#3f6212"] },
  { id: "bull", name: "Бух", description: "Зах зээл өсөхөд", cost: 400, icon: TrendingUp, shape: "shield", colors: ["#86efac", "#16a34a", "#14532d"] },
  { id: "bear", name: "Баавгай", description: "Зах зээл унахад", cost: 400, icon: TrendingDown, shape: "shield", colors: ["#fda4af", "#e11d48", "#881337"] },
  { id: "gold", name: "Алт", description: "Нөөцийн хаан", cost: 700, icon: Gem, shape: "diamond", colors: ["#fef08a", "#f59e0b", "#b45309"] },
  { id: "eurobond", name: "Евробонд", description: "Гадаад зах зээлд", cost: 1000, icon: Landmark, shape: "octagon", colors: ["#93c5fd", "#2563eb", "#1e3a8a"] },
  { id: "economist", name: "Эдийн засагч", description: "Хамгийн дээд тэмдэг", cost: 1500, icon: Crown, shape: "burst", colors: ["#f0abfc", "#c026d3", "#581c87"] },
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
const iconScale: Record<Shape, number> = { circle: 0.46, squircle: 0.48, hexagon: 0.44, octagon: 0.46, diamond: 0.36, shield: 0.42, burst: 0.38 }

/** Not owned yet: still in colour (it is a shop), just softer. */
const lockedFilter = "saturate(0.55) opacity(0.6)"

/** The badge itself: shaped gradient, an inner bevel, a shine and the icon. Not-yet-owned badges are softened. */
export function BadgeArt({ id, size = 56, locked = false }: { id: string; size?: number; locked?: boolean }) {
  const badge = badgeById.get(id)
  if (!badge) return null
  const [light, mid, dark] = badge.colors
  const Icon = badge.icon
  const founder = badge.id === "founder"
  const outer: CSSProperties = {
    width: size,
    height: size,
    clipPath: clip[badge.shape],
    background: founder
      ? `conic-gradient(from 210deg, ${light}, ${mid}, ${dark}, #fde68a, ${light})`
      : `linear-gradient(145deg, ${light}, ${mid} 55%, ${dark})`,
    filter: locked ? lockedFilter : undefined,
  }
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden>
      <span className={`absolute ${founder && !locked ? "ez-holo" : ""}`} style={outer} />
      {/* Inner bevel: the same shape, slightly smaller, darker. */}
      <span
        className="absolute"
        style={{
          width: size * 0.78,
          height: size * 0.78,
          clipPath: clip[badge.shape],
          background: `radial-gradient(circle at 35% 30%, ${mid}, ${dark})`,
          filter: locked ? lockedFilter : undefined,
        }}
      />
      {/* Shine. */}
      <span
        className="absolute"
        style={{
          width: size,
          height: size,
          clipPath: clip[badge.shape],
          background: "linear-gradient(160deg, rgb(255 255 255 / 0.45), transparent 42%)",
        }}
      />
      {/* Every layer is absolutely stacked in the same box, the icon on top, centred. */}
      <span className="absolute inset-0 grid place-items-center">
        <Icon
          className="text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.35)]"
          style={{ width: size * iconScale[badge.shape], height: size * iconScale[badge.shape], opacity: locked ? 0.85 : 1 }}
          strokeWidth={2.25}
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
