import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import { cn } from "cn"

import { canvasToBlob, posterFileName, posterFormats, renderPoster, type PosterFormat, type PosterInput } from "@/admin/posters"
import { buttonClass, Notice } from "@/admin/ui"

const formats = Object.keys(posterFormats) as PosterFormat[]

type Rendered = { url: string; blob: Blob } | { error: string }

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Previews the social posters for the current draft and downloads them as PNG. */
export function PosterDialog({ input, slug, coverCleared, onClose }: { input: PosterInput; slug: string; coverCleared: boolean; onClose: () => void }) {
  const [posters, setPosters] = useState<Partial<Record<PosterFormat, Rendered>>>({})

  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    for (const format of formats) {
      renderPoster(input, format)
        .then(canvasToBlob)
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          urls.push(url)
          if (!cancelled) setPosters((current) => ({ ...current, [format]: { url, blob } }))
        })
        .catch(() => {
          if (!cancelled) setPosters((current) => ({ ...current, [format]: { error: "Постер үүсгэж чадсангүй" } }))
        })
    }
    return () => {
      cancelled = true
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [input])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const ready = formats.every((format) => posters[format] && "blob" in posters[format]!)

  return (
    <div role="dialog" aria-modal="true" aria-label="Сошиал постер" className="bg-muted fixed inset-0 z-40 flex flex-col">
      <div className="bg-background flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <p className="text-[13px] font-medium">Сошиал постер</p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => formats.forEach((format) => {
              const poster = posters[format]
              if (poster && "blob" in poster) save(poster.blob, posterFileName(slug, format))
            })}
            className={buttonClass.brand}
          >
            <Download className="size-4" />
            Бүгдийг татах
          </button>
          <button type="button" onClick={onClose} aria-label="Хаах" className={buttonClass.ghost}>
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
          {!input.coverUrl ? <Notice>Нүүр зураггүй тул постер зураггүй загвараар гарлаа. Нүүр зураг нэмбэл илүү анхаарал татна.</Notice> : null}
          {input.coverUrl && !coverCleared ? (
            <Notice tone="error">Агентын оруулсан зургийг ашиглах эрхийг баталгаажуулаагүй байна. Сошиалд тавихаас өмнө шалгана уу.</Notice>
          ) : null}
          <div className="grid items-start gap-6 sm:grid-cols-2">
            {formats.map((format) => {
              const poster = posters[format]
              const { width, height, label, hint } = posterFormats[format]
              return (
                <figure key={format} className="flex flex-col gap-3">
                  <div
                    className={cn("bg-background overflow-hidden rounded-lg border shadow-sm", !poster && "animate-pulse")}
                    style={{ aspectRatio: `${width} / ${height}` }}
                  >
                    {poster && "url" in poster ? <img src={poster.url} alt={label} className="h-full w-full" /> : null}
                    {poster && "error" in poster ? <p className="text-muted-foreground p-4 text-[13px]">{poster.error}</p> : null}
                  </div>
                  <figcaption className="flex items-center gap-3">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{label}</span>
                      <span className="text-muted-foreground block text-[12px]">{hint}</span>
                    </span>
                    <button
                      type="button"
                      disabled={!poster || !("blob" in poster)}
                      onClick={() => poster && "blob" in poster && save(poster.blob, posterFileName(slug, format))}
                      className={cn(buttonClass.ghost, "ml-auto")}
                    >
                      <Download className="size-4" />
                      PNG
                    </button>
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
