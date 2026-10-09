import { useId, useLayoutEffect, useRef } from "react"

type ThemeName = "light" | "dark"
type RGB = readonly [number, number, number]

type Orb = {
  rgb: RGB
  alpha: number
  /** Home position, as a fraction of the viewport. */
  x: number
  y: number
  /** Radius, as a fraction of the longer viewport edge. */
  radius: number
  /** Idle orbit, radians per second. */
  speed: number
  phase: number
  /** Idle wander, as a fraction of the viewport. */
  wander: number
  /** Upward shift, in viewport heights, for each viewport scrolled. */
  parallax: number
}

/**
 * Light pages sit on a soft colour field. Four washes — purple, gold, coral,
 * and an ink shadow — drift on their own, lean toward the pointer, and shear
 * apart as the page scrolls. A paper scrim keeps Gray 600 and Blue 600 at or
 * above 4.5:1. Dark pages are a flat #121212; fractal noise on top is the
 * only texture. Still when the reader asks for reduced motion or reduced transparency.
 */
const LAYOUT: readonly Omit<Orb, "rgb" | "alpha">[] = [
  { x: 0.18, y: 0.14, radius: 0.82, speed: 0.22, phase: 0.4, wander: 0.075, parallax: 0.2 },
  { x: 0.9, y: 0.28, radius: 0.74, speed: 0.15, phase: 1.7, wander: 0.07, parallax: 0.32 },
  { x: 0.42, y: 0.78, radius: 0.7, speed: 0.18, phase: 2.9, wander: 0.08, parallax: 0.14 },
  { x: 0.08, y: 0.92, radius: 0.6, speed: 0.12, phase: 4.3, wander: 0.05, parallax: 0.38 },
]

// Light values are the hero hues, held pale enough to read black and blue type on.
const LIGHT_RGB: readonly RGB[] = [
  [89, 73, 234],
  [255, 201, 96],
  [254, 93, 93],
  [36, 28, 72],
]
const LIGHT_ALPHA = [0.5, 0.72, 0.5, 0.16] as const

const LIGHT_GROUND = "#e0e0e0"
const DARK_GROUND = "#121212"
const LIGHT_SCRIM = "rgba(224, 224, 224, 0.96)"

function palette(): Orb[] {
  return LAYOUT.map((orb, index) => ({ ...orb, rgb: LIGHT_RGB[index], alpha: LIGHT_ALPHA[index] }))
}

function paint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: ThemeName,
  time: number,
  scroll: number,
  pointerX: number,
  pointerY: number,
  still: boolean,
) {
  ctx.globalCompositeOperation = "source-over"
  if (theme === "dark") {
    ctx.fillStyle = DARK_GROUND
    ctx.fillRect(0, 0, width, height)
    return
  }

  ctx.fillStyle = LIGHT_GROUND
  ctx.fillRect(0, 0, width, height)

  const span = Math.max(width, height)
  const spin = still ? 0 : time * 0.045 + scroll * 0.00015

  for (const orb of palette()) {
    const dx = orb.x - 0.5
    const dy = orb.y - 0.5
    const cos = Math.cos(spin)
    const sin = Math.sin(spin)
    let fx = 0.5 + dx * cos - dy * sin
    let fy = 0.5 + dx * sin + dy * cos
    if (!still) {
      const idle = time * orb.speed
      fx += Math.sin(idle + orb.phase) * orb.wander + pointerX * 0.14 + Math.sin(scroll / 640 + orb.phase) * 0.07
      fy += Math.cos(idle * 0.8 + orb.phase) * orb.wander * 0.8 + pointerY * 0.1 - (scroll * orb.parallax) / height
    }
    const x = fx * width
    const y = fy * height
    const radius = orb.radius * span
    const [red, green, blue] = orb.rgb
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${orb.alpha})`)
    gradient.addColorStop(0.38, `rgba(${red}, ${green}, ${blue}, ${(orb.alpha * 0.55).toFixed(3)})`)
    gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  ctx.fillStyle = LIGHT_SCRIM
  ctx.fillRect(0, 0, width, height)
}

export function AmbientBackground({ theme }: { theme: ThemeName }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    const finePointer = window.matchMedia("(pointer: fine)")
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const reduceTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)")
    const moreContrast = window.matchMedia("(prefers-contrast: more)")
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    let cssWidth = 0
    let cssHeight = 0
    let dpr = 1
    let frame = 0
    let last = 0
    let alive = true

    function still() {
      return reduceMotion.matches || reduceTransparency.matches || moreContrast.matches
    }

    function resize() {
      cssWidth = window.innerWidth
      cssHeight = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, finePointer.matches ? 1.35 : 1)
      canvas!.width = Math.max(1, Math.round(cssWidth * dpr))
      canvas!.height = Math.max(1, Math.round(cssHeight * dpr))
    }

    function render(now: number) {
      if (!alive || cssWidth < 1 || cssHeight < 1) return
      const frozen = still()
      if (!frozen) {
        pointer.x += (pointer.tx - pointer.x) * 0.05
        pointer.y += (pointer.ty - pointer.y) * 0.05
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      paint(
        ctx!,
        cssWidth,
        cssHeight,
        theme,
        frozen ? 0 : now / 1000,
        frozen ? 0 : window.scrollY,
        frozen ? 0 : pointer.x,
        frozen ? 0 : pointer.y,
        frozen,
      )
    }

    function loop(now: number) {
      if (!alive) return
      if (theme === "dark" || document.hidden || still()) return
      if (now - last >= 32) {
        last = now
        render(now)
      }
      frame = window.requestAnimationFrame(loop)
    }

    function start() {
      window.cancelAnimationFrame(frame)
      resize()
      render(performance.now())
      if (theme !== "dark" && !document.hidden && !still()) frame = window.requestAnimationFrame(loop)
    }

    function onPointer(event: PointerEvent) {
      if (!finePointer.matches || still()) return
      pointer.tx = event.clientX / window.innerWidth - 0.5
      pointer.ty = event.clientY / window.innerHeight - 0.5
    }

    function onScroll() {
      if (!alive || still()) return
      const now = performance.now()
      if (now - last < 32) return
      last = now
      render(now)
    }

    function onVisibility() {
      if (document.hidden) {
        window.cancelAnimationFrame(frame)
        return
      }
      start()
    }

    start()
    window.addEventListener("resize", start)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("pointermove", onPointer, { passive: true })
    document.addEventListener("visibilitychange", onVisibility)
    reduceMotion.addEventListener("change", start)
    reduceTransparency.addEventListener("change", start)
    moreContrast.addEventListener("change", start)
    finePointer.addEventListener("change", start)

    return () => {
      alive = false
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", start)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("pointermove", onPointer)
      document.removeEventListener("visibilitychange", onVisibility)
      reduceMotion.removeEventListener("change", start)
      reduceTransparency.removeEventListener("change", start)
      moreContrast.removeEventListener("change", start)
      finePointer.removeEventListener("change", start)
    }
  }, [theme])

  return (
    <div aria-hidden className="ez-ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <canvas ref={canvasRef} className="ez-ambient-canvas" />
      <NoiseTexture />
    </div>
  )
}

/** Fractal grain over the page. On dark it is the only texture on #121212. */
function NoiseTexture() {
  const rawId = useId()
  const filterId = `ez-noise-${rawId.replace(/:/g, "")}`
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full opacity-[0.12] select-none dark:opacity-30"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id={filterId}>
        <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="6" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.15" />
          <feFuncG type="linear" slope="0.15" />
          <feFuncB type="linear" slope="0.15" />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity="0.22" />
    </svg>
  )
}
