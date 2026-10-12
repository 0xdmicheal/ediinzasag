import type { Desk } from "@/admin/types"
import { publicUrl } from "@/lib/public-url"

/*
 * Social posters for an article, drawn on a canvas in the browser so they cost
 * nothing to make and come out at the exact pixel sizes the networks want.
 * The newsroom's fixed design: full-bleed photo, a dark fade from the bottom,
 * the headline in Geologica Medium (Canva 40; parts marked *like this* in Blue 500),
 * the white logo under it on the right, and the date in Geologica ExtraLight
 * (Canva 15.3). Only the photo (position, zoom) and the fade can be changed in
 * PosterDialog; everything else sits where the design puts it.
 */

export type PosterFormat = "post" | "story"
export type PosterLang = "mn" | "en"

export const posterFormats: Record<PosterFormat, { width: number; height: number; label: string; hint: string }> = {
  post: { width: 1080, height: 1350, label: "Пост 4:5", hint: "Facebook, Instagram, X · 2160×2700" },
  story: { width: 1080, height: 1920, label: "Стори 9:16", hint: "Instagram, Facebook story · 2160×3840" },
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

/** The parts a person may change: the photo and the fade. */
export interface PosterLayout {
  /** Photo offset from centred cover-fit, and zoom (1 = just covers the poster). */
  photo: { x: number; y: number; scale: number }
  /** Dark fade from the bottom: how dark (0–1) and how far up (share of the height). */
  fade: { amount: number; height: number }
}

/**
 * The fixed design, in poster pixels (measured from the newsroom's Canva
 * template, 1080px wide). The headline box's bottom edge is fixed, so longer
 * headlines grow upward; the logo sits under the box's right end.
 */
const design: Record<PosterFormat, { headlineBottom: number; dateBaseline: number }> = {
  post: { headlineBottom: 1190, dateBaseline: 1301 },
  story: { headlineBottom: 1644, dateBaseline: 1766 },
}
const MARGIN = 110
// Canva's 40 / 15.3 measure 1.267× larger in the exported 1080px poster: 50.7px and 19.4px here.
const HEADLINE = { size: 50.7, lineHeight: 53, width: 733 }
/** The last line's baseline sits this far above the box's bottom edge (where the logo starts). */
const LAST_BASELINE = 16
const LOGO_H = 50
const DATE_SIZE = 19.4

export interface PosterContent {
  headline: string
  date: string
  coverUrl: string
}

export interface PosterAssets {
  cover: HTMLImageElement | null
  logo: HTMLImageElement | null
}


const BRAND = "#298dff"
const WHITE = "#ffffff"
const FONT = '"Geologica Variable", "Segoe UI", sans-serif'
export function defaultLayout(): PosterLayout {
  return { photo: { x: 0, y: 0, scale: 1 }, fade: { amount: 0.85, height: 0.6 } }
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
  await Promise.all([document.fonts.load(`500 51px ${FONT}`, sample), document.fonts.load(`200 19px ${FONT}`, sample)])
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
export function words(text: string) {
  const result: { text: string; blue: boolean }[] = []
  text.split(/(\*[^*]+\*)/).forEach((part) => {
    const blue = /^\*[^*]+\*$/.test(part)
    for (const word of (blue ? part.slice(1, -1) : part).split(/\s+/)) if (word) result.push({ text: word, blue })
  })
  return result
}

/** The headline back as text, each blue word wrapped in *stars*: what PosterDialog's word chips write. */
export function joinWords(list: { text: string; blue: boolean }[]) {
  return list.map((word) => (word.blue ? `*${word.text}*` : word.text)).join(" ")
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

/**
 * Keeps the photo covering the whole poster: zoom never below 1 (just covers),
 * and the offset never far enough to show an edge. The editor runs every drag
 * and zoom through this; drawPoster does too, for layouts saved before.
 */
export function clampPhoto(image: HTMLImageElement | null, format: PosterFormat, photo: PosterLayout["photo"]): PosterLayout["photo"] {
  const scale = Math.max(1, photo.scale)
  if (!image) return { ...photo, scale }
  const { width, height } = posterFormats[format]
  const fit = Math.max(width / image.naturalWidth, height / image.naturalHeight) * scale
  const spareX = (image.naturalWidth * fit - width) / 2
  const spareY = (image.naturalHeight * fit - height) / 2
  const within = (value: number, limit: number) => Math.round(Math.min(limit, Math.max(-limit, value)))
  return { scale, x: within(photo.x, spareX), y: within(photo.y, spareY) }
}

function photoBox(image: HTMLImageElement, format: PosterFormat, layoutPhoto: PosterLayout["photo"]) {
  const { width, height } = posterFormats[format]
  const photo = clampPhoto(image, format, layoutPhoto)
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * photo.scale
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  return { x: (width - w) / 2 + photo.x, y: (height - h) / 2 + photo.y, w, h }
}

/** Draws a poster. Synchronous: load the photo, logo and fonts once with loadPosterAssets. */
export function drawPoster(ctx: CanvasRenderingContext2D, format: PosterFormat, content: PosterContent, layout: PosterLayout, assets: PosterAssets) {
  const { width, height } = posterFormats[format]
  const { headlineBottom, dateBaseline } = design[format]

  ctx.fillStyle = "#16181c"
  ctx.fillRect(0, 0, width, height)
  if (assets.cover) {
    const photo = photoBox(assets.cover, format, layout.photo)
    ctx.drawImage(assets.cover, photo.x, photo.y, photo.w, photo.h)
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
  ctx.font = `500 ${HEADLINE.size}px ${FONT}`
  const lines = wrap(ctx, content.headline.trim() || "Гарчиг", HEADLINE.width)
  const space = ctx.measureText(" ").width
  lines.forEach((line, index) => {
    let x = MARGIN
    const y = headlineBottom - LAST_BASELINE - (lines.length - 1 - index) * HEADLINE.lineHeight
    line.forEach((word) => {
      ctx.fillStyle = word.blue ? BRAND : WHITE
      ctx.fillText(word.text, x, y)
      x += ctx.measureText(word.text).width + space
    })
  })

  if (assets.logo) {
    const w = LOGO_H * (assets.logo.naturalWidth / assets.logo.naturalHeight)
    ctx.drawImage(assets.logo, width - MARGIN - w, headlineBottom, w, LOGO_H)
  }

  if (content.date.trim()) {
    ctx.font = `200 ${DATE_SIZE}px ${FONT}`
    ctx.fillStyle = WHITE
    ctx.textAlign = "center"
    ctx.fillText(content.date, width / 2, dateBaseline)
    ctx.textAlign = "left"
  }
}

/** Renders one poster at full size for download. */
/** Downloads are drawn at twice the design size (2160×2700, 2160×3840) for a sharper upload. */
export const EXPORT_SCALE = 2

/** Renders one poster for download, at EXPORT_SCALE. */
export async function renderPoster(format: PosterFormat, content: PosterContent, layout: PosterLayout, assets?: PosterAssets) {
  const { width, height } = posterFormats[format]
  const canvas = document.createElement("canvas")
  canvas.width = width * EXPORT_SCALE
  canvas.height = height * EXPORT_SCALE
  const ctx = canvas.getContext("2d")!
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
  ctx.imageSmoothingQuality = "high"
  drawPoster(ctx, format, content, layout, assets ?? (await loadPosterAssets(content.coverUrl)))
  return canvas
}

export function posterFileName(slug: string, format: PosterFormat, lang: PosterLang) {
  const { width, height } = posterFormats[format]
  return `ez-${slug || "poster"}-${lang}-${width * EXPORT_SCALE}x${height * EXPORT_SCALE}.png`
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("export failed"))), "image/png"),
  )
}
