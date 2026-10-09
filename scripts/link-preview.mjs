// Link previews for the article editor, used by the Vite dev server (see
// vite.config.ts). Production uses the Supabase Edge Function in
// supabase/functions/link-preview, which follows the same rules; keep the two
// in step.
//
// Safety: only http(s), no private, loopback or link-local addresses (checked
// after DNS and on every redirect), 6 s timeout, at most 512 KB of HTML read.

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 6000
const USER_AGENT = "Mozilla/5.0 (compatible; EZLinkPreview/1.0; +https://ediinzasag.mn)"

function privateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  const lower = address.toLowerCase()
  if (lower.startsWith("::ffff:")) return privateAddress(lower.slice(7))
  return lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")
}

async function assertPublic(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Зөвхөн http(s) холбоос")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new Error("Дотоод хаяг")
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (addresses.length === 0 || addresses.some((entry) => privateAddress(entry.address))) throw new Error("Дотоод хаяг")
}

async function readCapped(response) {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const chunks = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
  }
  reader.cancel().catch(() => {})
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES))
}

const decode = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim()

function meta(html, names) {
  for (const name of names) {
    const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i").exec(html)?.[0]
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1]
    if (content) return decode(content)
  }
  return ""
}

/** Title, description, image and site name for a public web page. */
export async function linkPreview(raw) {
  let url = new URL(raw)
  let response
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
