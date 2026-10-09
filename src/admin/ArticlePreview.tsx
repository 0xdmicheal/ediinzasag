import { useEffect, useRef, useState } from "react"

import type { ArticleDraft, Tag } from "@/admin/types"
import { PREVIEW_DRAFT, PREVIEW_HEIGHT, PREVIEW_READY, type PreviewPayload } from "@/pages/PreviewFrame"

/**
 * How the article will read on the site: the public article page itself
 * (pages/PreviewFrame.tsx, ArticleLayout) in an iframe, so its layout,
 * breakpoints and styles are exactly the readers'. `width` renders at a fixed
 * screen width (390 phone, 1280 desktop), scaled down to fit when the space is
 * narrower; without it the frame takes the space it is given.
 */
export function ArticlePreview({
  draft,
  tags,
  authorName,
  date,
  width,
}: {
  draft: ArticleDraft
  tags: Tag[]
  authorName: string
  date: string
  width?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [space, setSpace] = useState(0)
  const [height, setHeight] = useState(800)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const node = box.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setSpace(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return
      if (event.data?.type === PREVIEW_READY) setReady(true)
      if (event.data?.type === PREVIEW_HEIGHT) setHeight(Number(event.data.height) || 800)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  // Every edit is sent straight to the frame.
  useEffect(() => {
    if (!ready) return
    const payload: PreviewPayload = { draft, tags, authorName, date, dark: document.documentElement.classList.contains("dark") }
    frame.current?.contentWindow?.postMessage({ type: PREVIEW_DRAFT, payload }, window.location.origin)
  }, [ready, draft, tags, authorName, date])

  const frameWidth = width ?? space
  const scale = width && space ? Math.min(1, space / width) : 1

  return (
    <div ref={box} className="w-full overflow-hidden" style={{ height: height * scale }}>
      {frameWidth > 0 ? (
        <iframe
          ref={frame}
          title="Нийтлэлийн урьдчилсан харагдац"
          src={`${import.meta.env.BASE_URL}preview-frame`}
          className="block origin-top-left border-0"
          style={{ width: frameWidth, height, transform: scale < 1 ? `scale(${scale})` : undefined }}
        />
      ) : null}
    </div>
  )
}
