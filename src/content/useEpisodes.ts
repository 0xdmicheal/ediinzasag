import { useEffect, useState } from "react"

import { episodes as curated, fetchLatestEpisodes, mergeEpisodes, type Episode } from "@/content/channels"

/*
 * EZ Talk episodes with the channel's latest uploads layered on top. Renders
 * immediately with the curated archive, then swaps in the merged list once the
 * youtube-feed Edge Function answers. On any failure it just keeps the archive,
 * so the page always has content. The fetch runs once per mount; the function
 * itself is edge-cached, so repeated visits don't hammer YouTube.
 */
export function useEpisodes(): Episode[] {
  const [list, setList] = useState<Episode[]>(curated)

  useEffect(() => {
    let active = true
    fetchLatestEpisodes().then((live) => {
      if (active && live.length) setList(mergeEpisodes(curated, live))
    })
    return () => {
      active = false
    }
  }, [])

  return list
}
