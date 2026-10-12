import { deskLabel } from "@/content/stories"
import type { Desk } from "@/admin/types"
import { publicUrl } from "@/lib/public-url"

/*
 * Social posters for an article, drawn on a canvas in the browser so they cost
 * nothing to make and come out at the exact pixel sizes the networks want.
 * Brand book v2: Geologica headlines, Onest text, JetBrains Mono kickers,
 * soft black #16181C with Blue 500 #298DFF accents (large type and graphics only).
 */

export type PosterFormat = "post" | "story"

export const posterFormats: Record<PosterFormat, { width: number; height: number; label: string; hint: string }> = {
  post: { width: 1080, height: 1350, label: "Пост 1080×1350", hint: "Facebook, Instagram, X" },
  story: { width: 1080, height: 1920, label: "Стори 1080×1920", hint: "Instagram, Facebook story" },
}

export interface PosterInput {
  title: string
  dek: string
  desk: Desk
  coverUrl: string
}

const INK = "#16181c"
const TEXT = "#eef0f3"
const BRAND = "#298dff"
const HEADING = '"Geologica Variable", "Segoe UI", sans-serif'
const BODY = '"Onest Variable", "Segoe UI", sans-serif'
const MONO = '"JetBrains Mono Variable", Consolas, monospace'
const SITE = "ediinzasag.mn"

/** Cyrillic sample so the browser fetches the glyph ranges with Ө and Ү, not just Latin. */
async function loadFonts() {
  const sample = "ӨөҮүАБВ EZ"
  await Promise.all([
    document.fonts.load(`700 80px ${HEADING}`, sample),
    document.fonts.load(`400 34px ${BODY}`, sample),
    document.fonts.load(`500 28px ${MONO}`, sample),
    document.fonts.load(`600 26px ${MONO}`, sample),
  ])
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    // Covers live on ediinzasag.mn or Supabase storage, both send CORS headers; without them the canvas can't be exported.
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`image failed: ${src}`))
    image.src = src
  })
}

/** Word wrap; a word longer than the line is split by characters. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ""
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = word
    while (ctx.measureText(line).width > maxWidth && line.length > 1) {
      let cut = line.length - 1
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--
      lines.push(line.slice(0, cut))
      line = line.slice(cut)
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Trims to `max` lines, ending the last one with an ellipsis. */
function clamp(ctx: CanvasRenderingContext2D, lines: string[], max: number, maxWidth: number) {
  if (lines.length <= max) return lines
  const kept = lines.slice(0, max)
  let last = kept[max - 1]
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.replace(/\s*\S+$/, "")
  kept[max - 1] = `${last}…`
  return kept
}

/** The largest headline size (step 4px) that fits in `maxLines`. */
function fitHeadline(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, from: number, to: number) {
  for (let size = from; size >= to; size -= 4) {
    ctx.font = `700 ${size}px ${HEADING}`
    const lines = wrap(ctx, text, maxWidth)
    if (lines.length <= maxLines) return { size, lines }
  }
  ctx.font = `700 ${to}px ${HEADING}`
  return { size: to, lines: clamp(ctx, wrap(ctx, text, maxWidth), maxLines, maxWidth) }
}

/** Draws `image` to fill the box, cropped like CSS object-fit: cover (biased slightly above centre, where faces usually are). */
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  const sx = (image.naturalWidth - sw) / 2
  const sy = (image.naturalHeight - sh) * 0.4
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h)
}

function fade(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, number][]) {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1)
  for (const [at, alpha] of stops) gradient.addColorStop(at, `rgb(22 24 28 / ${alpha})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, y0, ctx.canvas.width, y1 - y0)
}

/** Renders one poster and returns the canvas (call `toBlob` on it to save). */
export async function renderPoster(input: PosterInput, format: PosterFormat) {
  const { width, height } = posterFormats[format]
  const story = format === "story"
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  const [cover, logo] = await Promise.all([
    input.coverUrl ? loadImage(input.coverUrl).catch(() => null) : Promise.resolve(null),
    loadImage(publicUrl("brand/logo-white.png")).catch(() => null),
    loadFonts().catch(() => undefined),
  ])

  const pad = 64
  const textWidth = width - pad * 2
  // Instagram covers the top ~250px and bottom ~300px of a story with its own UI.
  const top = story ? 220 : pad
  const bottom = height - (story ? 300 : pad)
  const logoHeight = 64

  // Lay the text out first (stacked upward from the footer) so the photo's shade can sit right behind it.
  const headline = fitHeadline(ctx, input.title || "Гарчиг", textWidth, story ? 6 : 5, story ? 96 : 84, story ? 60 : 52)
  const lineHeight = Math.round(headline.size * 1.12)
  const dekSize = story ? 38 : 34
  const dekLineHeight = Math.round(dekSize * 1.4)
  ctx.font = `400 ${dekSize}px ${BODY}`
  const dekLines = input.dek.trim() ? clamp(ctx, wrap(ctx, input.dek, textWidth), headline.lines.length > 3 ? 2 : 3, textWidth) : []

  const dekTop = bottom - 72 - dekLineHeight * Math.max(0, dekLines.length - 1)
  const headlineBase = dekLines.length ? dekTop - dekSize - 36 : bottom - 72
  const headlineTop = headlineBase - lineHeight * (headline.lines.length - 1)
  const kickerHeight = 48
  const kickerTop = headlineTop - headline.size - 28 - kickerHeight

  ctx.fillStyle = INK
  ctx.fillRect(0, 0, width, height)

  if (cover) {
    drawCover(ctx, cover, 0, 0, width, height)
    fade(ctx, 0, top + logoHeight + 140, [[0, 0.75], [1, 0]]) // keeps the logo readable on bright photos
    const shadeFrom = Math.max(top + logoHeight + 40, kickerTop - 320)
    fade(ctx, shadeFrom, kickerTop + 40, [[0, 0], [1, 0.88]])
    ctx.fillStyle = "rgb(22 24 28 / 0.88)"
    ctx.fillRect(0, kickerTop + 40, width, height - kickerTop - 40)
  } else {
    // No cover: a blue arc so the poster still has a shape.
    ctx.strokeStyle = BRAND
    ctx.lineWidth = 6
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(width * 0.9, story ? 520 : 300, story ? 520 : 380, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  if (logo) ctx.drawImage(logo, pad, top, (logo.naturalWidth / logo.naturalHeight) * logoHeight, logoHeight)

  ctx.textBaseline = "alphabetic"

  // Kicker: a solid Blue 500 label with black text (6.35:1), readable on any photo.
  ctx.font = `600 26px ${MONO}`
  const kicker = `${deskLabel[input.desk].toUpperCase()} · EZ ТОЙМ`
  const kickerWidth = ctx.measureText(kicker).width + 40
  ctx.fillStyle = BRAND
  ctx.beginPath()
  ctx.roundRect(pad, kickerTop, kickerWidth, kickerHeight, kickerHeight / 2)
  ctx.fill()
  ctx.fillStyle = INK
  ctx.fillText(kicker, pad + 20, kickerTop + 33)

  ctx.font = `700 ${headline.size}px ${HEADING}`
  ctx.fillStyle = TEXT
  headline.lines.forEach((line, index) => ctx.fillText(line, pad, headlineTop + index * lineHeight))

  if (dekLines.length) {
    ctx.font = `400 ${dekSize}px ${BODY}`
    ctx.globalAlpha = 0.78
    dekLines.forEach((line, index) => ctx.fillText(line, pad, dekTop + index * dekLineHeight))
    ctx.globalAlpha = 1
  }

  // Footer: site address, plus a call to read on for the story.
  ctx.font = `500 28px ${MONO}`
  ctx.globalAlpha = 0.75
  ctx.fillText(story ? `Бүтнээр нь уншаарай · ${SITE}` : SITE, pad, bottom)
  ctx.globalAlpha = 1
  ctx.fillStyle = BRAND
  ctx.fillRect(width - pad - 96, bottom - 12, 96, 6)

  return canvas
}

export function posterFileName(slug: string, format: PosterFormat) {
  const { width, height } = posterFormats[format]
  return `ez-${slug || "poster"}-${width}x${height}.png`
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("export failed"))), "image/png"),
  )
}
