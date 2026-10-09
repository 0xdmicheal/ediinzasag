/* Link cards in the editor: what the preview service returns, and the fallbacks. */

export interface LinkPreview {
  url: string
  title: string
  description: string
  image: string
  site: string
}

/** A card with just the address, when the page can't be read. */
export function plainPreview(url: string): LinkPreview {
  let site = url
  try {
    site = new URL(url).hostname.replace(/^www\./, "")
  } catch {
    // Not a URL: show it as typed.
  }
  return { url, title: site, description: "", image: "", site }
}

/** The Vite dev server's preview route (scripts/link-preview.mjs). Not available in production builds. */
export async function devLinkPreview(url: string): Promise<LinkPreview> {
  if (!import.meta.env.DEV) throw new Error("Урьдчилан харах үйлчилгээ алга")
  const response = await fetch(`/__link-preview?url=${encodeURIComponent(url)}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? "Урьдчилан харах боломжгүй")
  return data as LinkPreview
}
