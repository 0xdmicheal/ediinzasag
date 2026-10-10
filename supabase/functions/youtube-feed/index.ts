// Live YouTube feed for the EZ Talk page: a Supabase Edge Function (Deno).
//
// The site's episode list in src/content/channels.ts is a curated archive
// (episode numbers, durations, notes). This function returns the channel's
// latest uploads from YouTube's public RSS feed so new videos show up on the
// site instantly, without a redeploy. The frontend merges these on top of the
// curated list (see src/content/useEpisodes.ts).
//
// Public, read-only, no secrets: YouTube's RSS needs no API key. The feed is
// cached at the edge, so a burst of visitors hits YouTube at most once per
// window.
//
// Channel id: @ediinzasag -> UCAwrfICkC-LbV51GU0zMgXg. Override with the
// YT_CHANNEL_ID env var if the channel changes.
//
// Deploy: supabase functions deploy youtube-feed --no-verify-jwt

const CHANNEL_ID = Deno.env.get("YT_CHANNEL_ID") || "UCAwrfICkC-LbV51GU0zMgXg"
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
const TIMEOUT_MS = 6000
const CACHE_SECONDS = 1800 // 30 min: new uploads appear within this window.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", ...extra },
  })

/** Minimal XML-entity decode for titles (RSS escapes & < > " '). */
function decode(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
}

interface Video {
  id: string
  title: string
  href: string
  date: string // "YYYY.MM.DD", to match the curated list's format
  thumb: string
}

function parse(xml: string): Video[] {
  const videos: Video[] = []
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
  for (const entry of entries) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1]
    if (!id || !title || !published) continue
    videos.push({
      id,
      title: decode(title).trim(),
      href: `https://www.youtube.com/watch?v=${id}`,
      date: published.slice(0, 10).replace(/-/g, "."), // 2026-10-10 -> 2026.10.10
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    })
  }
  return videos
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(FEED_URL, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; EZYouTubeFeed/1.0; +https://ediinzasag.mn)" },
    }).finally(() => clearTimeout(timer))

    if (!res.ok) return json({ error: `YouTube feed ${res.status}`, videos: [] }, 502)

    const videos = parse(await res.text())
    return json(
      { videos, fetchedAt: new Date().toISOString() },
      200,
      { "cache-control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    return json({ error: message, videos: [] }, 502)
  }
})
