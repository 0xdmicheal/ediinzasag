// Link previews for shared articles. Facebook, Messenger, Telegram, X and the
// rest read <meta property="og:*"> from the raw HTML and never run the app, so
// every /story/<slug> link used to show the site-wide og.png. After
// `vite build` this writes dist/story/<slug>.html: the same app shell with the
// article's headline, summary and cover in the head. GitHub Pages serves
// /story/<slug> from that file, and the app takes over as usual.
//
// Covers both the stories built into the site and the articles published from
// the admin (read with the public anon key; the Pages workflow reruns on a
// schedule so new articles get their preview). Usage: node scripts/og-pages.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createServer } from "vite"

const SITE = "https://ediinzasag.mn"
const DIST = new URL("../dist/", import.meta.url)

const escape = (text) =>
  String(text ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char])

const absolute = (src) => (/^https?:\/\//.test(src) ? src : `${SITE}/${src.replace(/^\//, "")}`)

/** Built-in stories, loaded through Vite so the "@/" imports resolve. */
async function builtInStories() {
  const vite = await createServer({ logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom", optimizeDeps: { noDiscovery: true } })
  try {
    const { stories, storyArt } = await vite.ssrLoadModule("/src/content/stories.ts")
    return stories.map((story) => {
      const art = storyArt(story.slug)
      return { slug: story.slug, title: story.title, dek: story.dek, image: absolute(art.src), alt: art.alt, date: story.date, size: [1280, 720] }
    })
  } finally {
    await vite.close()
  }
}

/** Articles published from the admin; empty without Supabase settings (demo builds). */
async function publishedArticles() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return []
  const response = await fetch(`${url}/rest/v1/articles?select=slug,title,dek,cover_url,cover_alt,published_at&status=eq.published`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Supabase articles: HTTP ${response.status}`)
  const rows = await response.json()
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    dek: row.dek,
    image: row.cover_url ? absolute(row.cover_url) : `${SITE}/og.png`,
    alt: row.cover_alt || row.title,
    date: row.published_at,
    size: row.cover_url ? null : [1200, 630],
  }))
}

function pageFor(shell, story) {
  const url = `${SITE}/story/${story.slug}`
  const title = escape(story.title)
  const dek = escape(story.dek)
  const image = escape(story.image)
  const tags = [
    `<meta name="description" content="${dek}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="EZ Эдийн засаг" />`,
    `<meta property="og:locale" content="mn_MN" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${dek}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:alt" content="${escape(story.alt)}" />`,
    ...(story.size ? [`<meta property="og:image:width" content="${story.size[0]}" />`, `<meta property="og:image:height" content="${story.size[1]}" />`] : []),
    ...(story.date ? [`<meta property="article:published_time" content="${escape(story.date)}" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@ezediinzasag" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${dek}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<title>${title} · EZ Эдийн засаг</title>`,
  ].join("\n    ")
  return shell
    .replace(/\s*<meta\s+(?:property="og:|name="twitter:|name="description")[^>]*>/g, "")
    .replace(/\s*<title>[^<]*<\/title>/, "")
    .replace("</head>", `  ${tags}\n  </head>`)
}

const shell = await readFile(new URL("index.html", DIST), "utf8")
const [builtIn, published] = await Promise.all([builtInStories(), publishedArticles()])
// An admin article with a built-in story's slug replaces it on the site, so it wins here too.
const bySlug = new Map([...builtIn, ...published].map((story) => [story.slug, story]))
await mkdir(new URL("story/", DIST), { recursive: true })
for (const story of bySlug.values()) {
  await writeFile(new URL(`story/${story.slug}.html`, DIST), pageFor(shell, story))
}
console.log(`og-pages: ${bySlug.size} article previews (${published.length} from the admin, ${builtIn.length} built in)`)
