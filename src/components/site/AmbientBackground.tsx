import { useLocation } from "react-router-dom"

/**
 * Animated blue gradient behind every page, a different motion per section of
 * the site. Glass surfaces (cards, nav, ticker) blur what passes behind them.
 * Purely decorative: hidden from assistive tech and still under reduced motion.
 */
type Variant = "aurora" | "flow" | "pulse" | "calm" | "orbit"

function variantFor(pathname: string): Variant {
  const path = pathname.replace(/^\/ediinzasag/, "")
  if (path === "" || path === "/") return "aurora"
  if (path.startsWith("/markets")) return "flow"
  if (path.startsWith("/ez-talk")) return "pulse"
  if (path.startsWith("/story") || path.startsWith("/letter")) return "calm"
  return "orbit"
}

export function AmbientBackground() {
  const { pathname } = useLocation()
  const variant = variantFor(pathname)

  return (
    <div
      aria-hidden
      data-variant={variant}
      className="ez-ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* key restarts the motion when moving to a page with a different style */}
      <div key={variant} className="ez-ambient-stage">
        <span className="ez-layer ez-layer-1" />
        <span className="ez-layer ez-layer-2" />
        <span className="ez-layer ez-layer-3" />
        <span className="ez-layer ez-layer-4" />
      </div>
      <span className="ez-ambient-veil" />
    </div>
  )
}
