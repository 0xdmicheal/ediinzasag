import { useId } from "react"
import { cn } from "cn"

/** A month of closes as a line with a soft fill; tone is a text colour class. */
export function Sparkline({ points, tone, className = "h-10 w-full" }: { points: number[]; tone: string; className?: string }) {
  const id = useId().replace(/:/g, "")
  if (points.length < 2) return <div className={className} aria-hidden />
  const low = Math.min(...points)
  const high = Math.max(...points)
  const span = high - low || 1
  const xy = points.map((value, index) => [(index / (points.length - 1)) * 100, 30 - ((value - low) / span) * 26 - 2] as const)
  const line = xy.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ")
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("overflow-visible", className, tone)} aria-hidden>
      <defs>
        <linearGradient id={`spark${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill={`url(#spark${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
