import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Download, ImageUp, RotateCcw, Undo2, X } from "lucide-react"
import { cn } from "cn"

import {
  canvasToBlob,
  clampPhoto,
  defaultLayout,
  drawPoster,
  joinWords,
  loadPosterAssets,
  posterDate,
  posterFileName,
  posterFormats,
  renderPoster,
  type PosterAssets,
  type PosterFormat,
  type PosterInput,
  type PosterLang,
  type PosterLayout,
  words,
} from "@/admin/posters"
import { buttonClass, inputClass, Notice } from "@/admin/ui"

const formats = Object.keys(posterFormats) as PosterFormat[]
const langs: { key: PosterLang; label: string }[] = [
  { key: "mn", label: "Монгол" },
  { key: "en", label: "English" },
]
const ZOOM = { min: 1, max: 4 }

interface Saved {
  text: Record<PosterLang, string>
  date: string
  layouts: Record<PosterFormat, PosterLayout>
}

const storageKey = (slug: string) => `ez-poster-v3-${slug || "draft"}`

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

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[12px]">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground font-mono">{Math.round(value * 100)}%</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-[var(--brand)]" />
    </label>
  )
}

/**
 * The poster editor. The design is fixed (posters.ts); a person only frames the
 * photo (drag to move, scroll or slider to zoom) and sets the fade, and writes
 * the Mongolian and English headlines. Text, date and framing are remembered
 * per article in this browser.
 */
export function PosterDialog({ input, slug, coverCleared, onClose }: { input: PosterInput; slug: string; coverCleared: boolean; onClose: () => void }) {
  const [saved] = useState(() => loadSaved(slug))
  const [format, setFormat] = useState<PosterFormat>("post")
  const [lang, setLang] = useState<PosterLang>("mn")
  const [text, setText] = useState<Record<PosterLang, string>>(saved.text ?? { mn: input.title, en: "" })
  const [date, setDate] = useState(saved.date ?? posterDate(input.date))
  const [layouts, setLayouts] = useState<Record<PosterFormat, PosterLayout>>(() => saved.layouts ?? { post: defaultLayout(), story: defaultLayout() })
  const [assets, setAssets] = useState<PosterAssets | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  /** A photo someone picked for this poster only; the article's cover is left as it is. */
  const [upload, setUpload] = useState<{ url: string; name: string } | null>(null)
  const coverUrl = upload?.url ?? input.coverUrl
  const fileRef = useRef<HTMLInputElement>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ startX: number; startY: number; from: PosterLayout["photo"] } | null>(null)

  const layout = layouts[format]
  const setLayout = useCallback((next: (current: PosterLayout) => PosterLayout) => setLayouts((all) => ({ ...all, [format]: next(all[format]) })), [format])
  const cover = assets?.cover ?? null
  /** Every move and zoom goes through clampPhoto, so the photo always fills the poster. */
  const setPhoto = useCallback(
    (next: (photo: PosterLayout["photo"]) => PosterLayout["photo"]) => setLayout((current) => ({ ...current, photo: clampPhoto(cover, format, next(current.photo)) })),
    [setLayout, cover, format],
  )
  const zoomTo = useCallback((scale: number) => setPhoto((photo) => ({ ...photo, scale: Math.min(ZOOM.max, Math.max(ZOOM.min, scale)) })), [setPhoto])

  function pickPhoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) return setError("Зөвхөн зураг оруулна уу (JPG, PNG, WebP).")
    if (file.size > 20_000_000) return setError("Зураг 20MB-аас бага байх ёстой.")
    setError("")
    // A data URL, so the canvas stays exportable (no cross-site image).
    const reader = new FileReader()
    reader.onload = () => {
      setUpload({ url: String(reader.result), name: file.name })
      setLayouts((all) => ({ post: { ...all.post, photo: defaultLayout().photo }, story: { ...all.story, photo: defaultLayout().photo } }))
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    let cancelled = false
    loadPosterAssets(coverUrl).then((loaded) => !cancelled && setAssets(loaded))
    return () => {
      cancelled = true
    }
  }, [coverUrl])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify({ text, date, layouts } satisfies Saved))
    } catch {
      // Private mode or full storage: the editor still works, it just won't remember.
    }
  }, [slug, text, date, layouts])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets) return
    drawPoster(canvas.getContext("2d")!, format, { headline: text[lang], date, coverUrl }, layout, assets)
  }, [assets, format, layout, text, lang, date, coverUrl])

  const toPoster = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { width, height } = posterFormats[format]
    return { x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = toPoster(event)
    drag.current = { startX: point.x, startY: point.y, from: layout.photo }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return
    const point = toPoster(event)
    const { startX, startY, from } = drag.current
    setPhoto((photo) => ({ ...photo, x: from.x + point.x - startX, y: from.y + point.y - startY }))
  }

  // Wheel zooms the photo. Not a React handler: those are passive and can't stop the page scrolling.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomTo(layout.photo.scale * (event.deltaY < 0 ? 1.04 : 1 / 1.04))
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [layout.photo.scale, zoomTo])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function download(which: { format: PosterFormat; lang: PosterLang }[]) {
    setBusy(true)
    setError("")
    try {
      for (const item of which) {
        const canvas = await renderPoster(item.format, { headline: text[item.lang], date, coverUrl }, layouts[item.format], assets ?? undefined)
        save(await canvasToBlob(canvas), posterFileName(slug, item.format, item.lang))
      }
    } catch {
      // A cover from a site without CORS headers taints the canvas, so the browser refuses to export it.
      setError("Постер хадгалж чадсангүй. Нүүр зургийг сайт руу (Supabase) дахин оруулаад оролдоно уу.")
    } finally {
      setBusy(false)
    }
  }

  const headlineWords = words(text[lang])
  function toggleWord(index: number) {
    setText((all) => ({ ...all, [lang]: joinWords(words(all[lang]).map((word, i) => (i === index ? { ...word, blue: !word.blue } : word))) }))
  }

  const everything = formats.flatMap((f) => langs.filter((l) => text[l.key].trim()).map((l) => ({ format: f, lang: l.key })))
  const { width, height, label, hint } = posterFormats[format]

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
            aria-label={`${label} урьдчилан харах: зургийг чирж зөөнө, хулганы дугуйгаар томруулна`}
            className={cn("max-h-full max-w-full touch-none rounded-lg shadow-lg", assets ? "cursor-grab active:cursor-grabbing" : "animate-pulse")}
            style={{ aspectRatio: `${width} / ${height}`, height: "min(100%, calc(100svh - 9rem))" }}
          />
          <p className="text-muted-foreground text-[12px]">
            {label} · {hint}. Зургийг чирж байрлуулна, хулганы дугуйгаар томруулна.
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
          </label>

          {headlineWords.length ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium">Цэнхэр болгох үг</span>
              <div className="flex flex-wrap gap-1.5">
                {headlineWords.map((word, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={word.blue}
                    onClick={() => toggleWord(index)}
                    className={cn(
                      "h-7 rounded-md border px-2 text-[13px] transition-colors",
                      word.blue ? "border-transparent bg-[#298dff] text-white" : "hover:bg-foreground/5",
                    )}
                  >
                    {word.text}
                  </button>
                ))}
              </div>
              <span className="text-muted-foreground text-[11px]">Үг дээр дарж цэнхэр болгоно, дахин дарвал буцна. 4 мөрөөс урт гарчиг дээшээ нэмэгдэнэ.</span>
            </div>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium">Огноо</span>
            <input value={date} onChange={(event) => setDate(event.target.value)} placeholder="2026/10/11" className={inputClass} />
          </label>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-medium">Зураг</span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className={cn(buttonClass.ghost, "h-8 px-3 text-[12px]")}>
                <ImageUp className="size-3.5" />
                {upload ? "Өөр зураг" : "Зураг солих"}
              </button>
              {upload ? (
                <button type="button" onClick={() => setUpload(null)} className={cn(buttonClass.ghost, "h-8 px-3 text-[12px]")}>
                  <Undo2 className="size-3.5" />
                  Нийтлэлийн зураг
                </button>
              ) : null}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => {
                pickPhoto(event.target.files?.[0])
                event.target.value = ""
              }} />
            </div>
            {upload ? <span className="text-muted-foreground truncate text-[11px]">Зөвхөн постерт: {upload.name}</span> : null}
            <Slider label="Томруулах" value={layout.photo.scale} min={ZOOM.min} max={ZOOM.max} step={0.01} onChange={zoomTo} />
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-medium">Харанхуй сүүдэр</span>
            <Slider label="Бараан" value={layout.fade.amount} min={0} max={1} step={0.01} onChange={(value) => setLayout((current) => ({ ...current, fade: { ...current.fade, amount: value } }))} />
            <Slider label="Өндөр" value={layout.fade.height} min={0.1} max={1} step={0.01} onChange={(value) => setLayout((current) => ({ ...current, fade: { ...current.fade, height: value } }))} />
          </div>

          <button type="button" onClick={() => setLayout(() => defaultLayout())} className={cn(buttonClass.ghost, "self-start")}>
            <RotateCcw className="size-4" />
            Зураг, сүүдрийг анхны болгох
          </button>

          {error ? <Notice tone="error">{error}</Notice> : null}
          {!coverUrl ? <Notice>Зураггүй байна. "Зураг солих"-оор постерт зураг нэмнэ үү.</Notice> : null}
          {coverUrl && assets && !assets.cover ? <Notice tone="error">Зургийг ачаалж чадсангүй.</Notice> : null}
          {!upload && input.coverUrl && !coverCleared ? (
            <Notice tone="error">Агентын оруулсан зургийг ашиглах эрхийг баталгаажуулаагүй байна. Сошиалд тавихаас өмнө шалгана уу.</Notice>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
