import { useLayoutEffect, useRef } from "react"

/**
 * The page ground: flat paper (#e0e0e0 light, #121212 dark, see .ez-ambient in
 * index.css) with a grain tile on top. The grain scrolls with the page, like
 * paper under the text, so the ground never looks pinned to the screen.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ez-ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <NoiseTexture />
    </div>
  )
}

/**
 * A live turbulence filter has to be redrawn whenever the menu blurs the page
 * or the theme snapshots it, which stalls a phone. This tile is painted once
 * and then only shifted.
 */
let grainTile = ""

function noiseTile() {
  if (grainTile) return grainTile
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  const image = ctx.createImageData(size, size)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const speck = Math.random()
    data[i] = data[i + 1] = data[i + 2] = 0
    data[i + 3] = speck < 0.55 ? 0 : Math.round((speck - 0.55) * 170)
  }
  ctx.putImageData(image, 0, 0)
  grainTile = canvas.toDataURL("image/png")
  return grainTile
}

/**
 * Follows the page's own scroll, not an animation, so it runs for everyone,
 * reduced-motion settings included. One background-position write per frame.
 */
function NoiseTexture() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    let frame = 0
    const place = () => {
      frame = 0
      if (ref.current) ref.current.style.backgroundPosition = `0 ${-(window.scrollY % 128)}px`
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(place)
    }
    place()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [])
  return (
    <div
      ref={ref}
      className="ez-noise pointer-events-none absolute inset-0 size-full select-none"
      style={{ backgroundImage: `url("${noiseTile()}")` }}
    />
  )
}
