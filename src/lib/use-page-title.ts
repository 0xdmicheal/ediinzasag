import { useEffect } from "react"

const SITE = "EZ Эдийн засаг"

/** The tab title while a page is open, matching what scripts/og-pages.mjs writes into its HTML. */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return
    const before = document.title
    document.title = title === SITE ? title : `${title} · ${SITE}`
    return () => {
      document.title = before
    }
  }, [title])
}
