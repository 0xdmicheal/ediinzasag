import { motion, useReducedMotion } from "motion/react"
import { cn } from "cn"

/*
 * A desk folder, like the ones in Windows Explorer but drawn: a back panel with a tab,
 * a few sheets inside, and a front flap. Selected, the flap tips forward and the sheets
 * rise, so you can see which folder the list beside it is showing. Monochrome on purpose.
 */

const spring = { type: "spring", stiffness: 380, damping: 26 } as const

export function Folder({
  label,
  count,
  open,
  onClick,
}: {
  label: string
  count: number | undefined
  open: boolean
  onClick: () => void
}) {
  const still = useReducedMotion()
  const papers = count === undefined ? 0 : Math.min(3, count)
  return (
    <button
      type="button"
      role="tab"
      aria-selected={open}
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col items-center gap-2 rounded-xl px-2 pt-3 pb-2.5 outline-none transition-colors",
        "focus-visible:ring-foreground/20 focus-visible:ring-4",
        open ? "bg-background shadow-xs ring-1 ring-border" : "hover:bg-background/60",
      )}
    >
      <span className="relative block h-[60px] w-[76px] [perspective:400px]" aria-hidden>
        {/* Back panel with its tab. */}
        <span className={cn("absolute inset-x-0 bottom-0 top-[7px] rounded-[7px] transition-colors", open ? "bg-foreground/35" : "bg-foreground/20 group-hover:bg-foreground/25")} />
        <span className={cn("absolute top-0 left-0 h-[12px] w-[30px] rounded-t-[6px] transition-colors", open ? "bg-foreground/35" : "bg-foreground/20 group-hover:bg-foreground/25")} />
        {/* Sheets inside: one per story, up to three. */}
        {Array.from({ length: papers }, (_, index) => (
          <motion.span
            key={index}
            className="bg-background absolute bottom-[6px] h-[44px] rounded-[3px] border shadow-xs"
            style={{ left: 8 + index * 4, right: 12 - index * 2 }}
            initial={false}
            animate={{ y: open && !still ? -10 - index * 4 : -2 - index * 2, rotate: open && !still ? (index - 1) * 3 : 0 }}
            transition={spring}
          />
        ))}
        {/* Front flap: tips forward when open. */}
        <motion.span
          className={cn(
            "absolute inset-x-0 bottom-0 h-[42px] origin-bottom rounded-[7px] border backdrop-blur-[2px] transition-colors",
            open ? "bg-card/95 border-foreground/30" : "bg-card/90 border-border",
          )}
          initial={false}
          animate={{ rotateX: open && !still ? -28 : 0 }}
          transition={spring}
        />
        {count !== undefined ? (
          <span className="text-muted-foreground absolute right-1.5 bottom-1.5 text-[11px] tabular-nums">{count}</span>
        ) : null}
      </span>
      <span className={cn("text-[13px] leading-tight", open ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground")}>{label}</span>
    </button>
  )
}
