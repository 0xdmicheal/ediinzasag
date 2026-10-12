import type { Desk } from "@/admin/types"
import { publicUrl } from "@/lib/public-url"

/*
 * Social posters for an article, drawn on a canvas in the browser so they cost
 * nothing to make and come out at the exact pixel sizes the networks want.
 * Layout: full-bleed photo, a dark fade from the bottom, the headline in
 * Geologica Medium (parts marked *like this* in Blue 500), the white logo and
 * the date in Geologica ExtraLight. Every element can be moved and scaled in
 * PosterDialog; positions are in poster pixels.
 */

export type PosterFormat = "post" | "story"
export type PosterLang = "mn" | "en"
export type PosterElement = "photo" | "headline" | "logo" | "date"

export const posterFormats: Record<PosterFormat, { width: number; height: number; label: string; hint: string }> = {
  post: { width: 1080, height: 1350, label: "Пост 1080×1350", hint: "Facebook, Instagram, X" },
  story: { width: 1080, height: 1920, label: "Стори 1080×1920", hint: "Instagram, Facebook story" },
}

/** What the editor opens the dialog with. */
export interface PosterInput {
  title: string
  dek: string
  desk: Desk
  coverUrl: string
  /** ISO date the poster shows; today when empty. */
  date?: string
}

export interface PosterLayout {
  /** Photo offset from centred cover-fit, and zoom (1 = just covers the poster). */
  photo: { x: number; y: number; scale: number }
  /** Bottom-left of the headline block (more lines grow upward), its wrap width and font size. */
  headline: { x: number; y: number; w: number; size: number }
  logo: { x: number; y: number; h: number }
  /** `x` is the date's centre. */
  date: { x: number; y: number; size: number }
  /** Dark fade from the bottom: how dark (0–1) and how far up (share of the height). */
  fade: { amount: number; height: number }
}

export interface PosterContent {
  headline: string
  date: string
  coverUrl: string
}

export interface PosterAssets {
  cover: HTMLImageElement | null
  logo: HTMLImageElement | null
}

export type Box = { x: number; y: number; w: number; h: number }

const BRAND = "#298dff"
const WHITE = "#ffffff"
const FONT = '"Geologica Variable", "Segoe UI", sans-serif'
const LOGO_RATIO = 285 / 112

export function defaultLayout(format: PosterFormat): PosterLayout {
  const { width, height } = posterFormats[format]
  const story = format === "story"
  const pad = 60
  const size = story ? 84 : 76
  // Instagram covers the bottom ~300px of a story with its own UI, so the text sits higher there.
  const headlineBottom = story ? height - 380 : height - 150
  const logoH = story ? 96 : 84
  return {
    photo: { x: 0, y: 0, scale: 1 },
    headline: { x: pad, y: headlineBottom, w: width - pad * 2 - Math.round(logoH * LOGO_RATIO) - 24, size },
    logo: { x: width - pad - Math.round(logoH * LOGO_RATIO), y: headlineBottom - logoH, h: logoH },
    date: { x: width / 2, y: story ? height - 300 : height - 64, size: 30 },
    fade: { amount: 0.85, height: story ? 0.6 : 0.62 },
  }
}

/** Today (or the given ISO date) as 2026/10/11. */
export function posterDate(iso?: string) {
  const date = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
}

/** Cyrillic sample so the browser fetches the glyph ranges with Ө and Ү, not just Latin. */
async function loadFonts() {
  const sample = "ӨөҮүАБВ EZ 0123"
  await Promise.all([document.fonts.load(`500 80px ${FONT}`, sample), document.fonts.load(`200 30px ${FONT}`, sample)])
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

export async function loadPosterAssets(coverUrl: string): Promise<PosterAssets> {
  const [cover, logo] = await Promise.all([
    coverUrl ? loadImage(coverUrl).catch(() => null) : Promise.resolve(null),
    loadImage(publicUrl("brand/logo-white.png")).catch(() => null),
    loadFonts().catch(() => undefined),
  ])
  return { cover, logo }
}

/** "*5.73* хувь" → [{ text: "5.73", blue: true }, { text: "хувь", blue: false }], one entry per word. */
function words(text: string) {
  const result: { text: string; blue: boolean }[] = []
  text.split(/(\*[^*]+\*)/).forEach((part) => {
    const blue = /^\*[^*]+\*$/.test(part)
    for (const word of (blue ? part.slice(1, -1) : part).split(/\s+/)) if (word) result.push({ text: word, blue })
  })
  return result
}

/** Word wrap into lines of words. A word wider than the line keeps its own line. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const space = ctx.measureText(" ").width
  const lines: { text: string; blue: boolean }[][] = []
  let line: { text: string; blue: boolean }[] = []
  let width = 0
  for (const word of words(text)) {
    const w = ctx.measureText(word.text).width
    if (line.length && width + space + w > maxWidth) {
      lines.push(line)
      line = []
      width = 0
    }
    width += (line.length ? space : 0) + w
    line.push(word)
  }
  if (line.length) lines.push(line)
  return lines
}

function photoBox(image: HTMLImageElement, width: number, height: number, photo: PosterLayout["photo"]): Box {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * photo.scale
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  return { x: (width - w) / 2 + photo.x, y: (height - h) / 2 + photo.y, w, h }
}

/**
 * Draws a poster and returns where each element landed, so the editor can
 * hit-test drags. Synchronous: load assets once with loadPosterAssets.
 */
export function drawPoster(ctx: CanvasRenderingContext2D, format: PosterFormat, content: PosterContent, layout: PosterLayout, assets: PosterAssets) {
  const { width, height } = posterFormats[format]
  const boxes: Record<PosterElement, Box> = {
    photo: { x: 0, y: 0, w: width, h: height },
    headline: { x: 0, y: 0, w: 0, h: 0 },
    logo: { x: 0, y: 0, w: 0, h: 0 },
    date: { x: 0, y: 0, w: 0, h: 0 },
  }

  ctx.fillStyle = "#16181c"
  ctx.fillRect(0, 0, width, height)
  if (assets.cover) {
    boxes.photo = photoBox(assets.cover, width, height, layout.photo)
    ctx.drawImage(assets.cover, boxes.photo.x, boxes.photo.y, boxes.photo.w, boxes.photo.h)
  }

  // The fade: clear at its top, `amount` black at the bottom, eased so it has no visible edge.
  const fadeTop = height * (1 - layout.fade.height)
  const gradient = ctx.createLinearGradient(0, fadeTop, 0, height)
  for (const [at, share] of [[0, 0], [0.35, 0.45], [0.7, 0.85], [1, 1]] as const) {
    gradient.addColorStop(at, `rgb(0 0 0 / ${(layout.fade.amount * share).toFixed(3)})`)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, fadeTop, width, height - fadeTop)

  ctx.textBaseline = "alphabetic"

  const { headline } = layout
  ctx.font = `500 ${headline.size}px ${FONT}`
  const lines = wrap(ctx, content.headline.trim() || "Гарчиг", headline.w)
  const lineHeight = headline.size * 1.12
  const top = headline.y - lineHeight * lines.length
  const space = ctx.measureText(" ").width
  let widest = 0
  lines.forEach((line, index) => {
    let x = headline.x
    const y = top + headline.size * 0.92 + index * lineHeight
    line.forEach((word) => {
      ctx.fillStyle = word.blue ? BRAND : WHITE
      ctx.fillText(word.text, x, y)
      x += ctx.measureText(word.text).width + space
    })
    widest = Math.max(widest, x - space - headline.x)
  })
  boxes.headline = { x: headline.x, y: top, w: Math.max(widest, 40), h: lineHeight * lines.length }

  if (assets.logo) {
    const w = layout.logo.h * (assets.logo.naturalWidth / assets.logo.naturalHeight)
    ctx.drawImage(assets.logo, layout.logo.x, layout.logo.y, w, layout.logo.h)
    boxes.logo = { x: layout.logo.x, y: layout.logo.y, w, h: layout.logo.h }
  }

  if (content.date.trim()) {
    ctx.font = `200 ${layout.date.size}px ${FONT}`
    ctx.fillStyle = WHITE
    ctx.textAlign = "center"
    ctx.fillText(content.date, layout.date.x, layout.date.y)
    ctx.textAlign = "left"
    const w = ctx.measureText(content.date).width
    boxes.date = { x: layout.date.x - w / 2, y: layout.date.y - layout.date.size, w, h: layout.date.size * 1.25 }
  }

  return boxes
}

/** Renders one poster at full size for download. */
export async function renderPoster(format: PosterFormat, content: PosterContent, layout: PosterLayout, assets?: PosterAssets) {
  const { width, height } = posterFormats[format]
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  drawPoster(canvas.getContext("2d")!, format, content, layout, assets ?? (await loadPosterAssets(content.coverUrl)))
  return canvas
}

export function posterFileName(slug: string, format: PosterFormat, lang: PosterLang) {
  const { width, height } = posterFormats[format]
  return `ez-${slug || "poster"}-${lang}-${width}x${height}.png`
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("export failed"))), "image/png"),
  )
}
