// Substack RSS relay for the site build: a Supabase Edge Function (Deno).
//
// Substack answers 403 to GitHub Actions IPs (seen 2026-10-16), so the Pages
// build could never pull new letters. scripts/pull_substack.py tries the feed
// directly first and falls back to this function, which returns the feed's
// XML unchanged.
//
// Public, read-only, no secrets: the feed itself is public. Cached briefly at
// the edge.
//
// Deploy: supabase functions deploy substack-feed --no-verify-jwt

const FEED_URL = "https://niots.substack.com/feed"
const TIMEOUT_MS = 15000
const CACHE_SECONDS = 300

Deno.serve(async () => {
  try {
    const response = await fetch(FEED_URL, {
      headers: { "user-agent": "ediinzasag-rss" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return new Response(`Substack ${response.status}`, { status: 502 })
    return new Response(await response.text(), {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": `public, max-age=${CACHE_SECONDS}`,
      },
    })
  } catch (error) {
    return new Response(`Feed fetch failed: ${error instanceof Error ? error.message : error}`, { status: 502 })
  }
})
