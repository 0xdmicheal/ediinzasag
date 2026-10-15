// Link previews for shared links. Facebook, Messenger, Telegram, X and the
// rest read <meta property="og:*"> from the raw HTML and never run the app.
// GitHub Pages only has dist/index.html, so every other path came back as a
// 404 (with the site-wide og.png): some apps then show no preview at all.
// After `vite build` this writes one HTML file per page (the same app shell
// with that page's title, summary and image in the head); GitHub Pages serves
// /story/<slug> from dist/story/<slug>.html with status 200 and the app takes
// over as usual.
//
// Pages: articles (built in + published from the admin, read with the public
// anon key; the Pages workflow reruns on a schedule so new ones get theirs),
// newsletter letters, tag pages and the fixed sections.
// Usage: node scripts/og-pages.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createServer } from "vite"

const SITE = "https://ediinzasag.mn"
const DIST = new URL("../dist/", import.meta.url)
const SITE_IMAGE = { image: `${SITE}/og.png`, size: [1200, 630] }
const SITE_DEK = "Эдийн засаг is easy. Монголын эдийн засаг, дэлхийн зах зээлийн тойм."

const escape = (text) =>
  String(text ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char])

const absolute = (src) => (/^https?:\/\//.test(src) ? src : `${SITE}/${src.replace(/^\//, "")}`)

/** Site content, loaded through Vite so the "@/" imports resolve. */
async function siteContent() {
  const vite = await createServer({ logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom", optimizeDeps: { noDiscovery: true } })
  try {
    const { stories, storyArt, tagsOf, topicLabel, deskLabel } = await vite.ssrLoadModule("/src/content/stories.ts")
    const { substackPosts } = await vite.ssrLoadModule("/src/content/substack.posts.ts")
    return { stories, storyArt, tagsOf, labels: { ...topicLabel, ...deskLabel }, letters: substackPosts }
  } finally {
    await vite.close()
  }
}

/** Published admin articles and the tag list; empty without Supabase settings (demo builds). */
async function supabaseContent() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return { articles: [], tags: [] }
  const get = async (path) => {
    const response = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`Supabase ${path}: HTTP ${response.status}`)
    return response.json()
  }
  const [articles, tags] = await Promise.all([
    get("articles?select=slug,title,dek,cover_url,cover_alt,published_at,tags&status=eq.published"),
    get("tags?select=slug,label"),
  ])
  return { articles, tags }
}

function pageFor(shell, page) {
  const url = `${SITE}/${page.path}`
  const title = escape(page.title)
  const dek = escape(page.dek || SITE_DEK)
  const image = escape(page.image)
  const tags = [
    `<meta name="description" content="${dek}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${page.article ? "article" : "website"}" />`,
    `<meta property="og:site_name" content="EZ Эдийн засаг" />`,
    `<meta property="og:locale" content="mn_MN" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${dek}" />`,
    `<meta property="og:image" content="${image}" />`,
    ...(page.alt ? [`<meta property="og:image:alt" content="${escape(page.alt)}" />`] : []),
    ...(page.size ? [`<meta property="og:image:width" content="${page.size[0]}" />`, `<meta property="og:image:height" content="${page.size[1]}" />`] : []),
    ...(page.date ? [`<meta property="article:published_time" content="${escape(page.date)}" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@ezediinzasag" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${dek}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<title>${title === "EZ Эдийн засаг" ? title : `${title} · EZ Эдийн засаг`}</title>`,
  ].join("\n    ")
  return shell
    .replace(/\s*<meta\s+(?:property="og:|name="twitter:|name="description")[^>]*>/g, "")
    .replace(/\s*<title>[^<]*<\/title>/, "")
    .replace("</head>", `  ${tags}\n  </head>`)
}

const shell = await readFile(new URL("index.html", DIST), "utf8")
const [site, remote] = await Promise.all([siteContent(), supabaseContent()])
const pages = new Map()
const add = (page) => pages.set(page.path, page)

// Fixed sections (login/account too: a shared link should still answer 200).
for (const [path, title, dek] of [
  ["mongolia", "Монгол", "Монголын эдийн засгийн мэдээ, тойм."],
  ["world", "Дэлхий", "Дэлхийн эдийн засаг, зах зээлийн мэдээ."],
  ["markets", "Ханш, зах зээл", "Валютын ханш, түүхий эд, хувьцаа, эдийн засгийн болон ашгийн тайлангийн календарь."],
  ["ez-talk", "EZ Talk", "Nio, Ulemj нарын видео подкаст."],
  ["ez-edu", "EZ Edu", "Эдийн засгийн хичээл."],
  ["newsletter", "Нийтлэл", "Долоо хоногийн захидал."],
  ["about", "Бидний тухай", "ediinzasag.mn, нийтлэл, EZ Talk дахь зарын байршил. Брэндээ эдийн засгийн уншигчдад хүргэнэ."],
  ["design", "Дизайн систем", ""],
  ["login", "Нэвтрэх", ""],
  ["signup", "Бүртгүүлэх", ""],
  ["account", "Миний бүртгэл", ""],
]) add({ path, title, dek, ...SITE_IMAGE })

// Tag pages: labels from the admin's tag list, then the built-in topics and desks.
const tagLabels = new Map([...Object.entries(site.labels), ...remote.tags.map((tag) => [tag.slug, tag.label])])
const usedTags = new Set([...site.stories.flatMap(site.tagsOf), ...remote.articles.flatMap((article) => article.tags ?? []), ...tagLabels.keys()])
for (const slug of usedTags) add({ path: `tag/${slug}`, title: `#${tagLabels.get(slug) ?? slug}`, dek: "", ...SITE_IMAGE })

// Newsletter letters.
for (const letter of site.letters) {
  add({ path: `letter/${letter.slug}`, title: letter.title, dek: letter.excerpt, image: letter.image || SITE_IMAGE.image, size: letter.image ? null : SITE_IMAGE.size, date: letter.date, article: true })
}

// Articles: built in first, then admin ones (an admin article with the same slug replaces it on the site, so here too).
for (const story of site.stories) {
  const art = site.storyArt(story.slug)
  add({ path: `story/${story.slug}`, title: story.title, dek: story.dek, image: absolute(art.src), alt: art.alt, size: [1280, 720], date: story.date, article: true })
}
for (const row of remote.articles) {
  add({
    path: `story/${row.slug}`,
    title: row.title,
    dek: row.dek,
    image: row.cover_url ? absolute(row.cover_url) : SITE_IMAGE.image,
    alt: row.cover_alt || row.title,
    size: row.cover_url ? null : SITE_IMAGE.size,
    date: row.published_at,
    article: true,
  })
}

for (const page of pages.values()) {
  const file = new URL(`${page.path}.html`, DIST)
  await mkdir(new URL(".", file), { recursive: true })
  await writeFile(file, pageFor(shell, page))
}
const count = (prefix) => [...pages.keys()].filter((path) => path.startsWith(prefix)).length
console.log(`og-pages: ${pages.size} pages (${count("story/")} articles, ${remote.articles.length} from the admin; ${count("letter/")} letters; ${count("tag/")} tags)`)
