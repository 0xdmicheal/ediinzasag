import { useEffect, useRef, useState, useSyncExternalStore } from "react"

/*
 * TradingView's embeddable "Advanced Chart": candlesticks, timeframes,
 * indicators, drawing tools and symbol search, for readers who analyse charts
 * themselves. Prices and history are TradingView's own feed (live or delayed),
 * not the sourced closes shown elsewhere on /markets, and the page says so.
 *
 * The widget is a third-party script that renders an iframe. It loads only
 * when the chart nears the viewport, and is rebuilt when the symbol, the
 * site theme or the phone/desktop layout changes.
 */

const SCRIPT = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}
const isDark = () => document.documentElement.classList.contains("dark")

const PHONE = "(max-width: 640px)"
function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const isPhone = () => window.matchMedia(PHONE).matches

export function TradingViewChart({
  symbol,
  title,
  theme = "auto",
  background,
  className = "bg-card h-[440px] rounded-lg border sm:h-[560px]",
}: {
  symbol: string
  title: string
  /** "dark" pins the chart dark (the terminal panel); "auto" follows the site theme. */
  theme?: "auto" | "dark"
  /** Chart canvas colour; defaults to the site's card colour for the theme. */
  background?: string
  /** Size and frame of the chart box. */
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const siteDark = useSyncExternalStore(subscribeTheme, isDark, () => false)
  const dark = theme === "dark" || siteDark
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false)

  useEffect(() => {
    const node = host.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: "400px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = host.current
    if (!near || !node) return
    node.replaceChildren()
    const widget = document.createElement("div")
    widget.className = "tradingview-widget-container__widget"
    widget.style.height = "100%"
    widget.style.width = "100%"
    const script = document.createElement("script")
    script.type = "text/javascript"
    script.src = SCRIPT
    script.async = true
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Asia/Ulaanbaatar",
      theme: dark ? "dark" : "light",
      style: "1",
      locale: "en",
      // Match the site's cards so the chart sits in the page, not on top of it.
      backgroundColor: background ?? (dark ? "#17191d" : "#ffffff"),
      gridColor: dark ? "rgba(255, 255, 255, 0.06)" : "rgba(19, 21, 24, 0.06)",
      allow_symbol_change: true,
      hide_side_toolbar: phone,
      withdateranges: !phone,
      details: false,
      calendar: false,
      save_image: false,
      support_host: "https://www.tradingview.com",
    })
    node.append(widget, script)
    return () => node.replaceChildren()
  }, [near, symbol, dark, phone, background])

  // The widget owns `host` (React renders no children into it); the placeholder sits underneath.
  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      role="region"
      aria-label={`${title}: TradingView график`}
    >
      <p className="absolute inset-0 grid place-items-center text-sm opacity-60">График ачаалж байна…</p>
      <div ref={host} className="tradingview-widget-container absolute inset-0" />
    </div>
  )
}
