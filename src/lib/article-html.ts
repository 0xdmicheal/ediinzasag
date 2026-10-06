import DOMPurify from "dompurify"

/*
 * Article bodies written in the admin are HTML from the rich-text editor.
 * Older drafts may be plain text (blank line between paragraphs, "## " for
 * headings); they are converted on the fly. Everything is sanitised to a small
 * allowlist before it is saved or shown.
 */

const allowed = {
  ALLOWED_TAGS: ["p", "h2", "h3", "strong", "em", "s", "u", "a", "blockquote", "ul", "ol", "li", "img", "hr", "br", "figure", "figcaption"],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel"],
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
  root.querySelectorAll("a").forEach((link) => {
    link.setAttribute("target", "_blank")
    link.setAttribute("rel", "noreferrer")
  })
  return { html: root.innerHTML, toc }
}
