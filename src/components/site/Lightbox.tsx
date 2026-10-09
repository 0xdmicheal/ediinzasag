import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, MotionConfig } from "motion/react"
import { X } from "lucide-react"

/*
 * Full-size image viewer for articles: the whole picture (object-contain, no
 * crop) on a blurred copy of itself, with rounded corners like the rest of the
 * design system. Esc, the close button or a click outside the image closes it.
 */

export interface LightboxImage {
  src: string
  alt: string
  caption?: string
  referrer?: boolean
}

export function Lightbox({ image, onClose }: { image: LightboxImage | null; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!image) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener("keydown", onKey)
      previous?.focus()
    }
  }, [image, onClose])

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {image ? (
          <motion.div
            key={image.src}
            role="dialog"
            aria-modal="true"
            aria-label={image.alt || "Зураг"}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 p-4 sm:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          >
            {/* The same picture, blurred, fills the screen behind it. */}
            <div aria-hidden className="absolute inset-0 overflow-hidden bg-black">
              <img
                src={image.src}
                alt=""
                referrerPolicy={image.referrer ? "no-referrer" : undefined}
                className="size-full scale-125 object-cover opacity-90 blur-2xl saturate-150"
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>

            <button
              ref={closeButton}
              type="button"
              aria-label="Хаах"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="size-5" />
            </button>

            <motion.img
              src={image.src}
              alt={image.alt}
              referrerPolicy={image.referrer ? "no-referrer" : undefined}
              onClick={(event: MouseEvent) => event.stopPropagation()}
              className="relative max-h-[82svh] w-auto max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/15"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            />
            {image.caption || image.alt ? (
              <p
                onClick={(event) => event.stopPropagation()}
                className="relative max-w-2xl rounded-full bg-black/35 px-4 py-1.5 text-center text-[13px] text-white/90 backdrop-blur-md"
              >
                {image.caption || image.alt}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  )
}

/**
 * Lightbox state plus a click handler for a block of article HTML: any <img>
 * inside it opens full size (its alt, or a following <figcaption>, becomes the caption).
 */
export function useLightbox() {
  const [image, setImage] = useState<LightboxImage | null>(null)
  const close = useCallback(() => setImage(null), [])
  const onContentClick = useCallback((event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.tagName !== "IMG" || target.closest("a")) return
    const img = target as HTMLImageElement
    const caption = img.closest("figure")?.querySelector("figcaption")?.textContent?.trim()
    setImage({ src: img.currentSrc || img.src, alt: img.alt, caption: caption || undefined })
  }, [])
  return { image, open: setImage, close, onContentClick }
}

/** Tailwind classes for article HTML whose images open in the lightbox. */
export const zoomableImages = "[&_img]:cursor-zoom-in [&_img]:transition-opacity [&_img:hover]:opacity-90"
