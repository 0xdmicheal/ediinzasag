// Link previews for the article editor: a Supabase Edge Function (Deno).
//
// A writer pastes a link; the editor asks this function for the page's title,
// description, picture and site name (Open Graph tags) and shows a link card.
// Browsers can't read other sites' HTML themselves (CORS), hence the server.
//
// Only signed-in newsroom members (any team role) may call it. The dev server
// has the same logic in scripts/link-preview.mjs; keep the two in step.
//
// Safety: only http(s), no private, loopback or link-local addresses (checked
// after DNS and on every redirect), 6 s timeout, at most 512 KB of HTML read.
//
// Deploy: supabase functions deploy link-preview

import { createClient } from "npm:@supabase/supabase-js@2"

const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 6000
const USER_AGENT = "Mozilla/5.0 (compatible; EZLinkPreview/1.0; +https://ediinzasag.mn)"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } })

function isIPv4(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
}

function privateAddress(address: string): boolean {
  if (isIPv4(address)) {
    const [a, b] = address.split(".").map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  const lower = address.toLowerCase()
  if (lower.startsWith("::ffff:")) return privateAddress(lower.slice(7))
  return lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Зөвхөн http(s) холбоос")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new Error("Дотоод хаяг")
  let addresses: string[]
  if (isIPv4(host) || host.includes(":")) {
    addresses = [host]
  } else {
    const [v4, v6] = await Promise.all([
      Deno.resolveDns(host, "A").catch(() => [] as string[]),
      Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
    ])
    addresses = [...v4, ...v6]
  }
  if (addresses.length === 0 || addresses.some(privateAddress)) throw new Error("Дотоод хаяг")
}

async function readCapped(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
  }
  reader.cancel().catch(() => {})
  const all = new Uint8Array(Math.min(size, MAX_BYTES))
  let offset = 0
  for (const chunk of chunks) {
    const part = chunk.subarray(0, all.length - offset)
    all.set(part, offset)
    offset += part.length
    if (offset >= all.length) break
  }
  return new TextDecoder().decode(all)
}

const decode = (text: string) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim()

function meta(html: string, names: string[]) {
  for (const name of names) {
    const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i").exec(html)?.[0]
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1]
    if (content) return decode(content)
  }
  return ""
}

async function linkPreview(raw: string) {
  let url = new URL(raw)
  let response: Response
  for (let hop = 0; ; hop++) {
    await assertPublic(url)
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    })
    const next = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null
    if (!next) break
    await response.body?.cancel()
    if (hop >= MAX_REDIRECTS) throw new Error("Хэт олон чиглүүлэлт")
    url = new URL(next, url)
  }
  if (!response.ok) throw new Error(`Хуудас нээгдсэнгүй (${response.status})`)
  if (!/text\/html|xhtml/i.test(response.headers.get("content-type") ?? "")) throw new Error("HTML хуудас биш")

  const html = await readCapped(response)
  const image = meta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"])
  let imageUrl = ""
  try {
    const resolved = image ? new URL(image, url) : null
    if (resolved && (resolved.protocol === "https:" || resolved.protocol === "http:")) imageUrl = resolved.href
  } catch {
    // Unparseable image URL: no picture.
  }
  return {
    url: url.href,
    title: (meta(html, ["og:title", "twitter:title"]) || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "")).slice(0, 300),
    description: meta(html, ["og:description", "twitter:description", "description"]).slice(0, 400),
    image: imageUrl,
    site: (meta(html, ["og:site_name"]) || url.hostname.replace(/^www\./, "")).slice(0, 100),
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (request.method !== "POST") return json({ error: "POST only" }, 405)

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  })
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  const { data } = await db.auth.getUser(token)
  if (!data.user) return json({ error: "Нэвтэрнэ үү" }, 401)
  const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
  if (!profile) return json({ error: "Зөвхөн редакцын гишүүд" }, 403)

  try {
    const { url } = (await request.json()) as { url?: string }
    if (!url) return json({ error: "url алга" }, 400)
    return json(await linkPreview(url))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Урьдчилан харах боломжгүй" }, 400)
  }
})
