// Link previews and search for shared links. Facebook, Messenger, Telegram, X
// and the rest read <meta property="og:*"> from the raw HTML and never run the
// app; Bing, Yandex and Google's first pass read the raw HTML too.
// GitHub Pages only has dist/index.html, so every other path came back as a
// 404 (with the site-wide og.png): some apps then show no preview at all.
// After `vite build` this writes one HTML file per page (the same app shell
// with that page's title, summary, image and JSON-LD in the head, and the
// page's text inside #root); GitHub Pages serves /story/<slug> from
// dist/story/<slug>.html with status 200 and the app takes over as usual
// (createRoot replaces the static text).
// It also writes sitemap.xml, news-sitemap.xml (Google News, last 48 h) and
// feed.xml (RSS).
//
// Pages: articles (built in + published from the admin, read with the public
// anon key; the Pages workflow reruns on a schedule so new ones get theirs),
// newsletter letters, tag pages and the fixed sections.
// Usage: node scripts/og-pages.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createServer } from "vite"

const SITE = "https://ediinzasag.mn"
const NAME = "EZ Эдийн засаг"
const DIST = new URL("../dist/", import.meta.url)
const SITE_IMAGE = { image: `${SITE}/og.png`, size: [1200, 630] }
const SITE_DEK = "Эдийн засаг is easy. Монголын эдийн засаг, дэлхийн зах зээлийн тойм."
const LOGO = `${SITE}/brand/logo-black.png`

const escape = (text) =>
  String(text ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char])

const absolute = (src) => (/^https?:\/\//.test(src) ? src : `${SITE}/${src.replace(/^\//, "")}`)

const iso = (date) => (date ? new Date(date.length === 10 ? `${date}T08:00:00+08:00` : date).toISOString() : "")

/** Editor HTML reduced to plain text blocks and links: no scripts, styles or attributes beyond href. */
function cleanHtml(html) {
  const keep = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "strong", "em", "b", "i", "a", "br", "figcaption"])
  return String(html ?? "")
    .replace(/<(script|style|iframe|noscript|svg)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(\/?)([a-z0-9]+)([^>]*)>/gi, (_, close, tag, attrs) => {
      tag = tag.toLowerCase()
      if (!keep.has(tag)) return ""
      if (close) return `</${tag}>`
      if (tag !== "a") return `<${tag}>`
      const href = /href\s*=\s*"(https?:\/\/[^"]*)"/i.exec(attrs)?.[1]
      return href ? `<a href="${href}" rel="noopener">` : "<a>"
    })
}

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
    get("articles?select=slug,title,dek,body,desk,cover_url,cover_alt,published_at,updated_at,tags&status=eq.published"),
    get("tags?select=slug,label"),
  ])
  return { articles, tags }
}

function jsonLd(page) {
  const url = `${SITE}/${page.path}`
  const publisher = { "@type": "NewsMediaOrganization", name: NAME, url: `${SITE}/`, logo: { "@type": "ImageObject", url: LOGO } }
  if (page.home) {
    return [
      { "@context": "https://schema.org", ...publisher, sameAs: ["https://x.com/ezediinzasag", "https://niots.substack.com"] },
      { "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: `${SITE}/`, inLanguage: "mn" },
    ]
  }
  if (!page.article) return []
  return [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      mainEntityOfPage: url,
      headline: page.title.slice(0, 110),
      description: page.dek || undefined,
      image: [page.image],
      datePublished: iso(page.date),
      dateModified: iso(page.modified || page.date),
      inLanguage: "mn",
      author: page.author ? { "@type": "Person", name: page.author } : { "@type": "Organization", name: NAME, url: `${SITE}/` },
      publisher,
    },
  ]
}

/** What crawlers that never run the app read inside #root: the article itself, or the page's links. */
function staticBody(page) {
  const date = page.date ? `<p><time datetime="${escape(iso(page.date))}">${escape(page.date.slice(0, 10))}</time></p>` : ""
  const dek = page.dek ? `<p><strong>${escape(page.dek)}</strong></p>` : ""
  const links = (page.links ?? []).map((link) => `<li><a href="/${link.path}">${escape(link.title)}</a></li>`).join("")
  return [
    `<article class="ez-static">`,
    page.home ? `<p>${NAME}</p>` : `<p><a href="/">${NAME}</a></p>`,
    `<h1>${escape(page.home ? SITE_DEK : page.title)}</h1>`,
    date,
    page.home ? "" : dek,
    page.html ?? "",
    links ? `<ul>${links}</ul>` : "",
    `</article>`,
  ].join("")
}

function pageFor(shell, page) {
  const url = `${SITE}/${page.path}`
  const title = escape(page.title)
  const dek = escape(page.dek || SITE_DEK)
  const image = escape(page.image)
  const tags = [
    `<meta name="description" content="${dek}" />`,
    ...(page.noindex ? [`<meta name="robots" content="noindex, follow" />`] : [`<link rel="canonical" href="${url}" />`]),
    `<link rel="alternate" type="application/rss+xml" title="${NAME}" href="${SITE}/feed.xml" />`,
    `<meta property="og:type" content="${page.article ? "article" : "website"}" />`,
    `<meta property="og:site_name" content="${NAME}" />`,
    `<meta property="og:locale" content="mn_MN" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${dek}" />`,
    `<meta property="og:image" content="${image}" />`,
    ...(page.alt ? [`<meta property="og:image:alt" content="${escape(page.alt)}" />`] : []),
    ...(page.size ? [`<meta property="og:image:width" content="${page.size[0]}" />`, `<meta property="og:image:height" content="${page.size[1]}" />`] : []),
    ...(page.date ? [`<meta property="article:published_time" content="${escape(iso(page.date))}" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@ezediinzasag" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${dek}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...jsonLd(page).map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`),
    `<style>.ez-static{max-width:42rem;margin:0 auto;padding:2.5rem 1rem;line-height:1.7}.ez-static h1{font-size:2rem;line-height:1.25;margin:1rem 0}.ez-static p,.ez-static ul{margin:0 0 1rem}.ez-static a{text-decoration:underline}</style>`,
    `<title>${title === NAME ? title : `${title} · ${NAME}`}</title>`,
  ].join("\n    ")
  return shell
    .replace(/\s*<meta\s+(?:property="og:|name="twitter:|name="description")[^>]*>/g, "")
    .replace(/\s*<title>[^<]*<\/title>/, "")
    .replace("</head>", `  ${tags}\n  </head>`)
    .replace(`<div id="root"></div>`, `<div id="root">${staticBody(page)}</div>`)
}

const shell = await readFile(new URL("index.html", DIST), "utf8")
const [site, remote] = await Promise.all([siteContent(), supabaseContent()])
const pages = new Map()
const add = (page) => pages.set(page.path, page)

// Articles: built in first, then admin ones (an admin article with the same slug replaces it on the site, so here too).
for (const story of site.stories) {
  const art = site.storyArt(story.slug)
  add({
    path: `story/${story.slug}`,
    title: story.title,
    dek: story.dek,
    image: absolute(art.src),
    alt: art.alt,
    size: [1280, 720],
    date: story.date,
    author: story.author,
    desk: story.desk,
    tags: site.tagsOf(story),
    html: story.html ? cleanHtml(story.html) : story.paragraphs.map((text) => `<p>${escape(text)}</p>`).join(""),
    article: true,
  })
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
    modified: row.updated_at,
    desk: row.desk,
    tags: row.tags ?? [],
    html: cleanHtml(row.body),
    article: true,
  })
}
const articles = [...pages.values()].sort((a, b) => iso(b.date).localeCompare(iso(a.date)))
const linksTo = (list) => list.slice(0, 60).map(({ path, title }) => ({ path, title }))

// Newsletter letters.
for (const letter of site.letters) {
  add({
    path: `letter/${letter.slug}`,
    title: letter.title,
    dek: letter.excerpt,
    image: letter.image || SITE_IMAGE.image,
    size: letter.image ? null : SITE_IMAGE.size,
    date: letter.date,
    author: letter.author,
    html: cleanHtml(letter.html),
    article: true,
  })
}
const letters = site.letters.map((letter) => ({ path: `letter/${letter.slug}`, title: letter.title }))

// Fixed sections. Login/account answer 200 for shared links but stay out of search.
for (const [path, title, dek, extra] of [
  ["mongolia", "Монгол", "Монголын эдийн засгийн мэдээ, тойм.", { links: linksTo(articles.filter((page) => page.desk === "mongolia")) }],
  ["world", "Дэлхий", "Дэлхийн эдийн засаг, зах зээлийн мэдээ.", { links: linksTo(articles.filter((page) => page.desk === "world")) }],
  ["markets", "Ханш, зах зээл", "Валютын ханш, түүхий эд, хувьцаа, эдийн засгийн болон ашгийн тайлангийн календарь."],
  ["ez-talk", "EZ Talk", "Nio, Ulemj нарын видео подкаст."],
  ["ez-edu", "EZ Edu", "Эдийн засгийн хичээл."],
  ["newsletter", "Нийтлэл", "Долоо хоногийн захидал.", { links: letters }],
  ["about", "Бидний тухай", "ediinzasag.mn, нийтлэл, EZ Talk дахь зарын байршил. Брэндээ эдийн засгийн уншигчдад хүргэнэ."],
  ["design", "Дизайн систем", "", { noindex: true }],
  ["login", "Нэвтрэх", "", { noindex: true }],
  ["signup", "Бүртгүүлэх", "", { noindex: true }],
  ["account", "Миний бүртгэл", "", { noindex: true }],
]) add({ path, title, dek, ...SITE_IMAGE, ...extra })

// Tag pages: labels from the admin's tag list, then the built-in topics and desks.
// A tag with no articles yet is thin content: reachable, but not indexed.
const tagLabels = new Map([...Object.entries(site.labels), ...remote.tags.map((tag) => [tag.slug, tag.label])])
const usedTags = new Set([...articles.flatMap((page) => page.tags), ...tagLabels.keys()])
for (const slug of usedTags) {
  const tagged = articles.filter((page) => page.tags.includes(slug))
  add({ path: `tag/${slug}`, title: `#${tagLabels.get(slug) ?? slug}`, dek: "", ...SITE_IMAGE, links: linksTo(tagged), noindex: tagged.length === 0 })
}

for (const page of pages.values()) {
  const file = new URL(`${page.path}.html`, DIST)
  await mkdir(new URL(".", file), { recursive: true })
  await writeFile(file, pageFor(shell, page))
}

// Home: dist/index.html itself (404.html was copied from it before this runs and stays as it was).
const home = { path: "", title: NAME, dek: SITE_DEK, ...SITE_IMAGE, home: true, links: linksTo(articles) }
await writeFile(new URL("index.html", DIST), pageFor(shell, home))

// sitemap.xml: every indexable page; news-sitemap.xml: articles from the last 48 hours (Google News).
const indexable = [home, ...pages.values()].filter((page) => !page.noindex)
const newest = iso(articles[0]?.date) || new Date().toISOString()
const sitemap = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...indexable.map((page) => `  <url><loc>${SITE}/${page.path}</loc><lastmod>${iso(page.modified || page.date) || newest}</lastmod></url>`),
  `</urlset>`,
].join("\n")
const recent = articles.filter((page) => Date.now() - new Date(iso(page.date)).getTime() < 48 * 3600_000)
const newsSitemap = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`,
  ...recent.map((page) =>
    [
      `  <url><loc>${SITE}/${page.path}</loc><news:news>`,
      `<news:publication><news:name>${NAME}</news:name><news:language>mn</news:language></news:publication>`,
      `<news:publication_date>${iso(page.date)}</news:publication_date><news:title>${escape(page.title)}</news:title>`,
      `</news:news></url>`,
    ].join(""),
  ),
  `</urlset>`,
].join("\n")
const feed = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>`,
  `<title>${NAME}</title><link>${SITE}/</link><description>${escape(SITE_DEK)}</description><language>mn</language>`,
  `<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />`,
  ...articles.slice(0, 50).map((page) =>
    [
      `<item><title>${escape(page.title)}</title><link>${SITE}/${page.path}</link><guid>${SITE}/${page.path}</guid>`,
      `<pubDate>${new Date(iso(page.date)).toUTCString()}</pubDate><description>${escape(page.dek)}</description></item>`,
    ].join(""),
  ),
  `</channel></rss>`,
].join("\n")
await writeFile(new URL("sitemap.xml", DIST), sitemap)
await writeFile(new URL("news-sitemap.xml", DIST), newsSitemap)
await writeFile(new URL("feed.xml", DIST), feed)

const count = (prefix) => [...pages.keys()].filter((path) => path.startsWith(prefix)).length
console.log(`og-pages: ${pages.size} pages (${count("story/")} articles, ${remote.articles.length} from the admin; ${count("letter/")} letters; ${count("tag/")} tags); sitemap ${indexable.length} URLs, news ${recent.length}`)
