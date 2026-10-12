// Runs the news agent on your own computer without touching Supabase: reads every
// source, ranks the stories and drafts the top picks exactly like the real run,
// then writes news-agent-report.html instead of filing cards on the board.
//
//   npm run agent:dry-run              (no AI: keyword ranking + source cards)
//   GEMINI_API_KEY=... in .env.local   (adds Gemini's Mongolian drafts)
//
// Optional: NEWS_PER_RUN (how many picks, default 3 here: same as the live run).

Deno.env.set("NEWS_DRY_RUN", "1")
const agent = await import("./index.ts")
const { rankByRules, sourceCard } = await import("./rules.ts")

// The live tags (supabase tags table) the drafts may choose from.
const TAGS = [
  { slug: "mining", label: "Уул уурхай" },
  { slug: "fuel", label: "Шатахуун" },
  { slug: "energy", label: "Эрчим хүч" },
  { slug: "policy", label: "Мөнгөний бодлого" },
  { slug: "markets", label: "Зах зээл" },
  { slug: "china", label: "Хятад" },
  { slug: "us", label: "АНУ" },
  { slug: "europe", label: "Европ" },
  { slug: "tech", label: "Технологи" },
  { slug: "geopolitics", label: "Геополитик" },
]

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

console.log(`Provider: ${agent.PROVIDER}${agent.PROVIDER === "gemini" ? ` (${agent.GEMINI_MODEL})` : ""} · reading ${agent.FEEDS.length} sources…`)
const started = Date.now()
const feeds = await agent.readFeeds()
console.log(`${feeds.ok}/${agent.FEEDS.length} sources OK, ${feeds.items.length} fresh stories${feeds.failed.length ? ` · failed: ${feeds.failed.join(", ")}` : ""}`)

const picks =
  agent.PROVIDER === "rules"
    ? rankByRules(feeds.items, agent.PER_RUN, agent.MIN_PRIORITY).map((pick) => ({ ...pick, item: feeds.items[pick.index] }))
    : await agent.rank(feeds.items, agent.PER_RUN)
console.log(`Picked ${picks.length}. Drafting…`)

const cards = []
for (const pick of picks) {
  const page = await agent.readArticle(pick.item.link)
  if (agent.PROVIDER === "rules") {
    const card = sourceCard({ ...pick.item, excerpt: page.text })
    cards.push({ pick, page, title: card.title, dek: card.dek, body: card.body, tags: pick.tags ?? [], notes: [] as string[] })
  } else {
    const raw = await agent.write(pick.item, page.text, pick.why, TAGS)
    // The same clean-up the live run applies before filing the card.
    const draft = raw ? agent.polish(raw, `${pick.item.title} ${pick.item.summary} ${page.text}`) : null
    const notes = draft ? [...draft.styleNotes, ...(draft.claims ?? []).map((c) => `Баримт: ${c.claim}${c.figure ? ` (${c.figure})` : ""} · ${c.source}`)] : []
    cards.push({ pick, page, title: draft?.title ?? "(загвар бичсэнгүй)", dek: draft?.dek ?? "", body: draft?.body_html ?? "", tags: draft?.tags ?? [], notes })
  }
}

// Every fresh story with its source, so you can see what the ranking passed over.
const bySource = new Map<string, number>()
for (const item of feeds.items) bySource.set(item.source, (bySource.get(item.source) ?? 0) + 1)

const html = `<!doctype html><meta charset="utf-8"><title>News agent dry run</title>
<style>body{font:15px/1.55 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px;color:#131518;background:#f4f5f7}
article{background:#fff;border-radius:14px;padding:20px 24px;margin:18px 0;box-shadow:0 1px 3px #0001}
.meta{color:#6b7280;font-size:13px}.tag{display:inline-block;background:#e8f2ff;color:#1759c4;border-radius:99px;padding:1px 9px;margin-right:4px;font-size:12px}
img{max-width:100%;border-radius:10px;margin:8px 0}h1{font-size:24px}h2{font-size:20px;margin:6px 0}table{border-collapse:collapse;font-size:13px}td{padding:2px 12px 2px 0}</style>
<h1>News agent: dry run</h1>
<p class="meta">${new Date().toLocaleString()} · provider <b>${agent.PROVIDER}</b> · ${feeds.ok}/${agent.FEEDS.length} sources OK · ${feeds.items.length} fresh stories · ${((Date.now() - started) / 1000).toFixed(0)} s.
Nothing was written to Supabase.</p>
${feeds.failed.length ? `<p class="meta">Failed sources: ${escape(feeds.failed.join(", "))}</p>` : ""}
${cards
  .map(
    ({ pick, page, title, dek, body, tags, notes }) => `<article>
  <div class="meta">${escape(pick.item.source)} · ${pick.priority}/10 · ${escape(pick.why)} · <a href="${escape(pick.item.link)}">эх сурвалж</a></div>
  <h2>${escape(title)}</h2>
  <p><i>${escape(dek)}</i></p>
  ${tags.map((tag: string) => `<span class="tag">${escape(tag)}</span>`).join("")}
  ${page.image || pick.item.image ? `<img src="${escape(page.image || pick.item.image)}" alt="">` : ""}
  <div>${body}</div>
  ${notes.length ? `<ul class="meta">${notes.map((note: string) => `<li>${escape(note)}</li>`).join("")}</ul>` : ""}
</article>`,
  )
  .join("")}
<h2>Fresh stories by source</h2>
<table>${[...bySource].sort((a, b) => b[1] - a[1]).map(([source, n]) => `<tr><td>${escape(source)}</td><td>${n}</td></tr>`).join("")}</table>`

await Deno.writeTextFile("news-agent-report.html", html)
console.log(`Report: ${Deno.cwd()}\\news-agent-report.html`)
