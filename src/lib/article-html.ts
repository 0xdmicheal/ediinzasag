import DOMPurify from "dompurify"

/*
 * Article bodies written in the admin are HTML from the rich-text editor.
 * Older drafts may be plain text (blank line between paragraphs, "## " for
 * headings); they are converted on the fly. Everything is sanitised to a small
 * allowlist before it is saved or shown.
 */

const allowed = {
  ALLOWED_TAGS: ["p", "h2", "h3", "strong", "em", "s", "u", "a", "blockquote", "ul", "ol", "li", "img", "hr", "br", "figure", "figcaption", "small"],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "data-width", "data-card", "data-image"],
}

/** Image sizes offered in the editor (percent of the text column). */
export const IMAGE_WIDTHS = [
  { value: 50, label: "S" },
  { value: 75, label: "M" },
  { value: 100, label: "L" },
] as const

export const MIN_IMAGE_WIDTH = 25

/**
 * Turns <figure data-width="60"> into an inline width for display. The saved
 * HTML keeps only the number, so the sanitiser never has to allow style="".
 */
function applyImageWidths(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("figure[data-width]").forEach((figure) => {
    const width = Number(figure.dataset.width)
    if (!Number.isFinite(width) || width >= 100) return
    figure.style.width = `${Math.max(MIN_IMAGE_WIDTH, width)}%`
    figure.style.minWidth = "min(100%, 220px)"
    figure.style.marginInline = "auto"
  })
}

/**
 * Link cards (pasted links, see EditorLinkCard):
 *   <figure data-card="link" data-image="on|off"><a href><img><strong>title</strong><em>description</em><small>site</small></a></figure>
 * The picture stays in the saved HTML so the writer can switch it back on; when
 * it's off, it is removed here so readers never download it. Pictures come from
 * other sites, so they load without a referrer.
 */
function applyLinkCards(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('figure[data-card="link"]').forEach((card) => {
    const image = card.querySelector("img")
    if (image && card.dataset.image === "off") image.remove()
    else if (image) {
      image.setAttribute("referrerpolicy", "no-referrer")
      image.setAttribute("loading", "lazy")
    }
    card.querySelector("a")?.setAttribute("target", "_blank")
    card.querySelector("a")?.setAttribute("rel", "noreferrer")
  })
}

/** Sanitised body HTML ready to display (image widths and link cards applied). */
export function renderBody(body: string) {
  const html = bodyToHtml(body)
  if (typeof DOMParser === "undefined") return html
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstElementChild as HTMLElement
  applyImageWidths(root)
  applyLinkCards(root)
  return root.innerHTML
}

export function sanitize(html: string) {
  return DOMPurify.sanitize(html, allowed)
}

export const isHtml = (body: string) => /^\s*</.test(body)

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Plain-text body → HTML. */
export function textToHtml(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (block.startsWith("## ") ? `<h2>${escape(block.slice(3))}</h2>` : `<p>${escape(block)}</p>`))
    .join("")
}

/** Any body (HTML or legacy text) → sanitised HTML. */
export function bodyToHtml(body: string) {
  return sanitize(isHtml(body) ? body : textToHtml(body))
}

export function htmlToText(html: string) {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, " ")
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""
}

export function countWords(body: string) {
  return htmlToText(bodyToHtml(body)).split(/\s+/).filter(Boolean).length
}

export function countHeadings(body: string) {
  return (bodyToHtml(body).match(/<h2[\s>]/g) ?? []).length
}

/** Sanitised HTML with ids on h2 headings, plus a contents list for "Энэ хуудсанд". */
export function prepareArticle(body: string) {
  const html = bodyToHtml(body)
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild as HTMLElement
  const toc = Array.from(root.querySelectorAll("h2"))
    .filter((node) => node.textContent?.trim())
    .map((node, index) => {
      node.id = `section-${index}`
      return { id: node.id, label: node.textContent!.trim() }
    })
  applyImageWidths(root)
  applyLinkCards(root)
  root.querySelectorAll("a").forEach((link) => {
    link.setAttribute("target", "_blank")
    link.setAttribute("rel", "noreferrer")
  })
  return { html: root.innerHTML, toc }
}
