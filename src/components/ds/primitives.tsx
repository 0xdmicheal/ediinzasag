import type { ReactNode } from "react"
import { cn } from "cn"
import { Lightbulb } from "lucide-react"

import { desks, type DeskId } from "@/design/desks"

/*
 * EZ design system primitives. Everything here reads colour from tokens, so
 * it works in both themes. Desk colour is used as a dot, an icon or a soft
 * tint, and always beside the desk's name.
 */

/** Soft tint of a desk colour, for chip and box backgrounds. */
export const tint = (color: string, percent: number) => `color-mix(in oklch, ${color} ${percent}%, transparent)`

export function DeskChip({ desk, size = "md", className }: { desk: DeskId; size?: "sm" | "md"; className?: string }) {
  const { label, icon: Icon, color } = desks[desk]
  return (
    <span
      className={cn(
        "font-body inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-2.5 text-ds-caption" : "h-7 px-3 text-ds-label",
        className,
      )}
      style={{ background: tint(color, 12), color: `color-mix(in oklch, ${color} 70%, var(--foreground))` }}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} style={{ color }} strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  )
}

export function DeskDot({ desk }: { desk: DeskId }) {
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: desks[desk].color }} />
}

/**
 * "Энгийнээр": the signature plain-language takeaway. Only ever filled from
 * existing text (a story's summary, a figure from the data), never invented.
 */
export function SimplyBox({
  desk = "markets",
  children,
  className,
}: {
  desk?: DeskId
  children: ReactNode
  className?: string
}) {
  const { color } = desks[desk]
  return (
    <aside
      className={cn("font-body flex gap-3 rounded-lg p-4 sm:p-5", className)}
      style={{ background: tint(color, 9) }}
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full"
        style={{ background: tint(color, 18), color }}
        aria-hidden
      >
        <Lightbulb className="size-4" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p
          className="text-ds-caption font-semibold tracking-[0.12em] uppercase"
          style={{ color: `color-mix(in oklch, ${color} 70%, var(--foreground))` }}
        >
          Энгийнээр
        </p>
        <p className="text-ds-body text-foreground mt-1">{children}</p>
      </div>
    </aside>
  )
}

type ButtonTone = "primary" | "secondary" | "ghost"

const buttonTone: Record<ButtonTone, string> = {
  primary: "bg-brand text-brand-foreground hover:brightness-95",
  secondary: "bg-foreground text-background hover:opacity-90",
  ghost: "border border-foreground/20 text-foreground hover:bg-foreground/5",
}

export function buttonClass(tone: ButtonTone = "primary", size: "md" | "lg" = "md") {
  return cn(
    "font-body inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    size === "lg" ? "h-12 px-6 text-ds-body" : "h-10 px-4 text-ds-label",
    buttonTone[tone],
  )
}
