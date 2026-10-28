import { useEffect, useState } from "react"

import { episodes as curated, fetchChannelFeed, mergeEpisodes, type Episode } from "@/content/channels"

/*
 * EZ Talk episodes with the channel's latest uploads layered on top. Renders
 * immediately with the curated archive, then swaps in the merged list once the
 * youtube-feed Edge Function answers. On any failure it just keeps the archive,
 * so the page always has content. The fetch runs once per page load (shared with
 * useVideoCount); the function itself is edge-cached, so repeated visits don't
 * hammer YouTube.
 */
export function useEpisodes(): Episode[] {
  const [list, setList] = useState<Episode[]>(curated)

  useEffect(() => {
    let active = true
    fetchChannelFeed().then(({ episodes: live }) => {
      if (active && live.length) setList(mergeEpisodes(curated, live))
    })
    return () => {
      active = false
    }
  }, [])

  return list
}

/**
 * The channel's video total as YouTube shows it ("30 videos", Shorts included),
 * so the EZ Talk count matches the channel. Undefined until the feed answers or
 * when it can't report one; callers fall back to the list length.
 */
export function useVideoCount(): number | undefined {
  const [count, setCount] = useState<number>()

  useEffect(() => {
    let active = true
    fetchChannelFeed().then(({ videoCount }) => {
      if (active) setCount(videoCount)
    })
    return () => {
      active = false
    }
  }, [])

  return count
}
