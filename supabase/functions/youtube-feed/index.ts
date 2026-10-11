// Live YouTube feed for the EZ Talk page: a Supabase Edge Function (Deno).
//
// The site's episode list in src/content/channels.ts is a curated archive
// (episode numbers, durations, notes). This function returns the channel's
// latest uploads from YouTube's public RSS feed so new videos show up on the
// site instantly, without a redeploy. The frontend merges these on top of the
// curated list (see src/content/useEpisodes.ts).
//
// YouTube's RSS has been returning 404 for every channel (seen 2026-10-11), so
// when it fails the function falls back to the channel's /videos page for the
// newest video ids, then each watch page for title, publish date and length.
//
// Public, read-only, no secrets: neither source needs an API key. The feed is
// cached at the edge, so a burst of visitors hits YouTube at most once per
// window.
//
// Channel id: @ediinzasag -> UCAwrfICkC-LbV51GU0zMgXg. Override with the
// YT_CHANNEL_ID env var if the channel changes.
//
// Deploy: supabase functions deploy youtube-feed --no-verify-jwt

const CHANNEL_ID = Deno.env.get("YT_CHANNEL_ID") || "UCAwrfICkC-LbV51GU0zMgXg"
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
const VIDEOS_URL = `https://www.youtube.com/channel/${CHANNEL_ID}/videos`
const SCRAPE_LIMIT = 6 // watch pages fetched per refresh in the fallback
const TIMEOUT_MS = 6000
const BROWSER_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "accept-language": "en",
  // Skips the EU cookie-consent interstitial that replaces the page from some edge regions.
  cookie: "SOCS=CAI; CONSENT=YES+1",
}
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
  seconds?: number // only known from the watch-page fallback
}

async function get(url: string, headers: Record<string, string>) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal, headers })
  } finally {
    clearTimeout(timer)
  }
}

async function fromRss(): Promise<Video[]> {
  const res = await get(FEED_URL, { "user-agent": "Mozilla/5.0 (compatible; EZYouTubeFeed/1.0; +https://ediinzasag.mn)" })
  if (!res.ok) throw new Error(`YouTube feed ${res.status}`)
  return parse(await res.text())
}

/** JSON-string literal value of `"key":"..."` in a page, unescaped. */
function field(html: string, key: string) {
  const raw = html.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`))?.[1]
  return raw == null ? undefined : (JSON.parse(`"${raw}"`) as string)
}

async function watchPage(id: string): Promise<Video | null> {
  const res = await get(`https://www.youtube.com/watch?v=${id}`, BROWSER_HEADERS)
  if (!res.ok) return null
  const html = await res.text()
  // videoDetails holds this video's own title; the first "title" in the page can be something else.
  const details = html.slice(html.indexOf('"videoDetails":'))
  const title = field(details, "title")
  const published = field(html, "publishDate") ?? field(html, "uploadDate")
  const seconds = Number(field(details, "lengthSeconds"))
  if (!title || !published) return null
  return {
    id,
    title: title.trim(),
    href: `https://www.youtube.com/watch?v=${id}`,
    date: published.slice(0, 10).replace(/-/g, "."),
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
  }
}

async function fromChannelPage(): Promise<Video[]> {
  const res = await get(VIDEOS_URL, BROWSER_HEADERS)
  if (!res.ok) throw new Error(`YouTube channel page ${res.status}`)
  const html = await res.text()
  const ids = [...new Set([...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((match) => match[1]))].slice(0, SCRAPE_LIMIT)
  const videos = (await Promise.all(ids.map((id) => watchPage(id).catch(() => null)))).filter(
    (video): video is Video => video !== null,
  )
  if (videos.length === 0) throw new Error("YouTube channel page had no readable videos")
  return videos.sort((a, b) => b.date.localeCompare(a.date))
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
    let videos: Video[]
    let source = "rss"
    try {
      videos = await fromRss()
    } catch {
      videos = await fromChannelPage()
      source = "channel-page"
    }
    return json(
      { videos, source, fetchedAt: new Date().toISOString() },
      200,
      { "cache-control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    return json({ error: message, videos: [] }, 502)
  }
})
