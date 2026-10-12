import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Download, RotateCcw, X } from "lucide-react"
import { cn } from "cn"

import {
  canvasToBlob,
  defaultLayout,
  drawPoster,
  loadPosterAssets,
  posterDate,
  posterFileName,
  posterFormats,
  renderPoster,
  type Box,
  type PosterAssets,
  type PosterElement,
  type PosterFormat,
  type PosterInput,
  type PosterLang,
  type PosterLayout,
} from "@/admin/posters"
import { buttonClass, inputClass, Notice } from "@/admin/ui"

const formats = Object.keys(posterFormats) as PosterFormat[]
const langs: { key: PosterLang; label: string }[] = [
  { key: "mn", label: "Монгол" },
  { key: "en", label: "English" },
]
const elementLabels: Record<PosterElement, string> = { photo: "Зураг", headline: "Гарчиг", logo: "Лого", date: "Огноо" }

/** What each element's size slider changes, and its range. */
const sizeOf: Record<PosterElement, { get: (layout: PosterLayout) => number; set: (layout: PosterLayout, value: number) => PosterLayout; min: number; max: number; step: number }> = {
  photo: { get: (l) => l.photo.scale, set: (l, v) => ({ ...l, photo: { ...l.photo, scale: v } }), min: 1, max: 4, step: 0.01 },
  headline: { get: (l) => l.headline.size, set: (l, v) => ({ ...l, headline: { ...l.headline, size: v } }), min: 28, max: 180, step: 1 },
  logo: { get: (l) => l.logo.h, set: (l, v) => ({ ...l, logo: { ...l.logo, h: v } }), min: 30, max: 360, step: 1 },
  date: { get: (l) => l.date.size, set: (l, v) => ({ ...l, date: { ...l.date, size: v } }), min: 14, max: 120, step: 1 },
}

function move(layout: PosterLayout, element: PosterElement, from: PosterLayout, dx: number, dy: number): PosterLayout {
  const shift = <T extends { x: number; y: number }>(value: T) => ({ ...value, x: Math.round(value.x + dx), y: Math.round(value.y + dy) })
  return { ...layout, [element]: shift(from[element]) }
}

const clampSize = (element: PosterElement, value: number) => Math.min(sizeOf[element].max, Math.max(sizeOf[element].min, value))

interface Saved {
  text: Record<PosterLang, string>
  date: string
  layouts: Record<PosterFormat, PosterLayout>
}

const storageKey = (slug: string) => `ez-poster-v2-${slug || "draft"}`

function loadSaved(slug: string): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(slug)) ?? "{}") as Partial<Saved>
  } catch {
    return {}
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: { key: T; label: string }[]; onChange: (key: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="bg-muted grid auto-cols-fr grid-flow-col gap-1 rounded-full p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "h-8 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
            value === option.key ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, format = (v) => String(Math.round(v)) }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; format?: (value: number) => string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[12px]">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground font-mono">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-[var(--brand)]" />
    </label>
  )
}

/**
 * The poster editor: drag the photo, headline, logo or date to move it, scroll
 * (or use the slider) to scale it. Separate Mongolian and English headlines;
 * text, date and layout are remembered per article in this browser.
 */
export function PosterDialog({ input, slug, coverCleared, onClose }: { input: PosterInput; slug: string; coverCleared: boolean; onClose: () => void }) {
  const [saved] = useState(() => loadSaved(slug))
  const [format, setFormat] = useState<PosterFormat>("post")
  const [lang, setLang] = useState<PosterLang>("mn")
  const [text, setText] = useState<Record<PosterLang, string>>(saved.text ?? { mn: input.title, en: "" })
  const [date, setDate] = useState(saved.date ?? posterDate(input.date))
  const [layouts, setLayouts] = useState<Record<PosterFormat, PosterLayout>>(
    () => saved.layouts ?? { post: defaultLayout("post"), story: defaultLayout("story") },
  )
  const [selected, setSelected] = useState<PosterElement>("headline")
  const [assets, setAssets] = useState<PosterAssets | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxes = useRef<Record<PosterElement, Box> | null>(null)
  const drag = useRef<{ element: PosterElement; startX: number; startY: number; from: PosterLayout } | null>(null)

  const layout = layouts[format]
  const setLayout = useCallback((next: (current: PosterLayout) => PosterLayout) => setLayouts((all) => ({ ...all, [format]: next(all[format]) })), [format])

  useEffect(() => {
    let cancelled = false
    loadPosterAssets(input.coverUrl).then((loaded) => !cancelled && setAssets(loaded))
    return () => {
      cancelled = true
    }
  }, [input.coverUrl])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify({ text, date, layouts } satisfies Saved))
    } catch {
      // Private mode or full storage: the editor still works, it just won't remember.
    }
  }, [slug, text, date, layouts])

  // Redraw the preview, then outline the selected element (the outline is never exported).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets) return
    const ctx = canvas.getContext("2d")!
    boxes.current = drawPoster(ctx, format, { headline: text[lang], date, coverUrl: input.coverUrl }, layout, assets)
    if (selected !== "photo") {
      const box = boxes.current[selected]
      ctx.save()
      ctx.strokeStyle = "#298dff"
      ctx.lineWidth = 4
      ctx.setLineDash([14, 10])
      ctx.strokeRect(box.x - 10, box.y - 10, box.w + 20, box.h + 20)
      ctx.restore()
    }
  }, [assets, format, layout, text, lang, date, input.coverUrl, selected])

  const toPoster = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { width, height } = posterFormats[format]
    return { x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height }
  }

  const hit = (x: number, y: number): PosterElement => {
    const pad = 16
    for (const element of ["headline", "logo", "date"] as const) {
      const box = boxes.current?.[element]
      if (box && box.w && x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad) return element
    }
    return "photo"
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = toPoster(event)
    const element = hit(point.x, point.y)
    setSelected(element)
    drag.current = { element, startX: point.x, startY: point.y, from: layout }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return
    const point = toPoster(event)
    const { element, startX, startY, from } = drag.current
    setLayout((current) => move(current, element, from, point.x - startX, point.y - startY))
  }

  // Wheel to scale whatever is under the cursor. Not a React handler: those are passive and can't stop the page scrolling.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = toPoster(event)
      const element = hit(point.x, point.y)
      setSelected(element)
      const factor = event.deltaY < 0 ? 1.04 : 1 / 1.04
      setLayout((current) => sizeOf[element].set(current, clampSize(element, sizeOf[element].get(current) * factor)))
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  })

  // Arrow keys nudge the selected element (Shift: 10px); Escape closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose()
      const target = event.target as HTMLElement
      if (target.closest("input, textarea")) return
      const step = event.shiftKey ? 10 : 2
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
      if (!delta) return
      event.preventDefault()
      setLayout((current) => move(current, selected, current, delta[0], delta[1]))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, selected, setLayout])

  async function download(which: { format: PosterFormat; lang: PosterLang }[]) {
    setBusy(true)
    setError("")
    try {
      for (const item of which) {
        const canvas = await renderPoster(item.format, { headline: text[item.lang], date, coverUrl: input.coverUrl }, layouts[item.format], assets ?? undefined)
        save(await canvasToBlob(canvas), posterFileName(slug, item.format, item.lang))
      }
    } catch {
      // A cover from a site without CORS headers taints the canvas, so the browser refuses to export it.
      setError("Постер хадгалж чадсангүй. Нүүр зургийг сайт руу (Supabase) дахин оруулаад оролдоно уу.")
    } finally {
      setBusy(false)
    }
  }

  const everything = formats.flatMap((f) => langs.filter((l) => text[l.key].trim()).map((l) => ({ format: f, lang: l.key })))
  const { width, height, label, hint } = posterFormats[format]
  const size = sizeOf[selected]

  return (
    <div role="dialog" aria-modal="true" aria-label="Сошиал постер" className="bg-muted fixed inset-0 z-40 flex flex-col">
      <div className="bg-background flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <p className="text-[13px] font-medium">Сошиал постер</p>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" disabled={busy || !assets || !text[lang].trim()} onClick={() => download([{ format, lang }])} className={buttonClass.ghost}>
            <Download className="size-4" />
            Энэ постер
          </button>
          <button type="button" disabled={busy || !assets || !everything.length} onClick={() => download(everything)} className={buttonClass.brand}>
            <Download className="size-4" />
            Бүгдийг татах ({everything.length})
          </button>
          <button type="button" onClick={onClose} aria-label="Хаах" className={buttonClass.ghost}>
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 sm:p-6">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            aria-label={`${label} урьдчилан харах: чирж зөөнө, хулганы дугуйгаар томруулна`}
            className={cn("max-h-full max-w-full touch-none rounded-lg shadow-lg", assets ? "cursor-move" : "animate-pulse")}
            style={{ aspectRatio: `${width} / ${height}`, height: "min(100%, calc(100svh - 9rem))" }}
          />
          <p className="text-muted-foreground text-[12px]">
            {label} · {hint}. Чирж зөөнө, хулганы дугуйгаар томруулна/жижигрүүлнэ, сумаар нарийн зөөнө.
          </p>
        </div>

        <aside className="bg-background flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-t p-5 lg:w-[340px] lg:border-t-0 lg:border-l">
          <Tabs label="Хэмжээ" value={format} onChange={setFormat} options={formats.map((key) => ({ key, label: posterFormats[key].label.split(" ")[0] }))} />
          <Tabs label="Хэл" value={lang} onChange={setLang} options={langs} />

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium">{lang === "mn" ? "Гарчиг" : "Headline (English)"}</span>
            <textarea
              value={text[lang]}
              onChange={(event) => setText((all) => ({ ...all, [lang]: event.target.value }))}
              rows={4}
              placeholder={lang === "en" ? "The yield on the U.S. 30-year bond reached *5.73* percent…" : "Гарчиг"}
              className={cn(inputClass, "resize-y")}
            />
            <span className="text-muted-foreground text-[11px]">*од* дотор бичсэн хэсэг цэнхэр болно, жишээ нь *5.73*.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium">Огноо</span>
            <input value={date} onChange={(event) => setDate(event.target.value)} placeholder="2026/10/11" className={inputClass} />
          </label>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-medium">Сонгосон: {elementLabels[selected]}</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(elementLabels) as PosterElement[]).map((element) => (
                <button
                  key={element}
                  type="button"
                  onClick={() => setSelected(element)}
                  className={cn(
                    "h-7 rounded-full border px-3 text-[12px] transition-colors",
                    selected === element ? "bg-foreground text-background border-transparent" : "hover:bg-foreground/5",
                  )}
                >
                  {elementLabels[element]}
                </button>
              ))}
            </div>
            <Slider
              label={selected === "photo" ? "Томруулах" : "Хэмжээ"}
              value={size.get(layout)}
              min={size.min}
              max={size.max}
              step={size.step}
              format={selected === "photo" ? (v) => `${Math.round(v * 100)}%` : undefined}
              onChange={(value) => setLayout((current) => size.set(current, value))}
            />
            {selected === "headline" ? (
              <Slider
                label="Мөрийн өргөн"
                value={layout.headline.w}
                min={240}
                max={width - 40}
                step={2}
                onChange={(value) => setLayout((current) => ({ ...current, headline: { ...current.headline, w: value } }))}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-medium">Харанхуй сүүдэр</span>
            <Slider label="Бараан" value={layout.fade.amount} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => setLayout((current) => ({ ...current, fade: { ...current.fade, amount: value } }))} />
            <Slider label="Өндөр" value={layout.fade.height} min={0.1} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => setLayout((current) => ({ ...current, fade: { ...current.fade, height: value } }))} />
          </div>

          <button type="button" onClick={() => setLayout(() => defaultLayout(format))} className={cn(buttonClass.ghost, "self-start")}>
            <RotateCcw className="size-4" />
            Байрлалыг анхны болгох
          </button>

          {error ? <Notice tone="error">{error}</Notice> : null}
          {!input.coverUrl ? <Notice>Нүүр зураггүй байна. Нүүр зураг нэмбэл постер илүү анхаарал татна.</Notice> : null}
          {input.coverUrl && assets && !assets.cover ? <Notice tone="error">Нүүр зургийг ачаалж чадсангүй.</Notice> : null}
          {input.coverUrl && !coverCleared ? (
            <Notice tone="error">Агентын оруулсан зургийг ашиглах эрхийг баталгаажуулаагүй байна. Сошиалд тавихаас өмнө шалгана уу.</Notice>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
