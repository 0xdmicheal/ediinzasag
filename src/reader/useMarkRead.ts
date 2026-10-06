import { useEffect } from "react"

import { useReader } from "@/reader/session"
import type { ReadTags } from "@/reader/types"

/**
 * Counts a story as read once the reader scrolls to the element with this id
 * (the sources box at the end of the article). Signed-out readers are skipped.
 */
export function useMarkReadAtEnd(slug: string | undefined, endId: string, tags?: ReadTags) {
  const { reader, reads, markRead } = useReader()
  const alreadyRead = Boolean(slug && reads.some((entry) => entry.slug === slug))
  const signedIn = Boolean(reader)
  const desk = tags?.desk
  const topic = tags?.topic

  useEffect(() => {
    if (!slug || !signedIn || alreadyRead) return
    const end = document.getElementById(endId)
    if (!end) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        markRead(slug, { desk, topic })
        observer.disconnect()
      }
    })
    observer.observe(end)
    return () => observer.disconnect()
  }, [slug, endId, signedIn, alreadyRead, markRead, desk, topic])
}
