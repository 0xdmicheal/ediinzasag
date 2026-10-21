import { useCallback, useState, type MouseEvent } from "react"

/*
 * Article state for the full-size image viewer. Kept apart from Lightbox.tsx so the viewer
 * (and the animation library it uses) loads only when a reader opens an image.
 */

export interface LightboxImage {
  src: string
  alt: string
  caption?: string
  referrer?: boolean
}

/**
 * Lightbox state plus a click handler for a block of article HTML: any <img>
 * inside it opens full size (its alt, or a following <figcaption>, becomes the caption).
 */
export function useLightbox() {
  const [image, setImage] = useState<LightboxImage | null>(null)
  // Stays true after the first open, so the viewer stays mounted and can play its closing animation.
  const [opened, setOpened] = useState(false)
  if (image && !opened) setOpened(true)
  const close = useCallback(() => setImage(null), [])
  const onContentClick = useCallback((event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.tagName !== "IMG" || target.closest("a")) return
    const img = target as HTMLImageElement
    const caption = img.closest("figure")?.querySelector("figcaption")?.textContent?.trim()
    setImage({ src: img.currentSrc || img.src, alt: img.alt, caption: caption || undefined })
  }, [])
  return { image, opened, open: setImage, close, onContentClick }
}

/** Tailwind classes for article HTML whose images open in the lightbox. */
export const zoomableImages = "[&_img]:cursor-zoom-in [&_img]:transition-opacity [&_img:hover]:opacity-90"
