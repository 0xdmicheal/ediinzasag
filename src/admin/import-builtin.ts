import type { ArticleDraft, Backend } from "@/admin/types"
import { storyOutlines } from "@/content/story-outlines"
import { stories, storyArt, type Story } from "@/content/stories"
import { publicUrl } from "@/lib/public-url"

/*
 * The stories that used to be hard-coded into the site. On the live (Supabase)
 * site they are no longer shown directly: an admin imports them from the board
 * into the review queue, and each one goes live only once it is published like
 * any other article (see src/content/live.ts).
 */

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Paragraphs to editor HTML: outline labels (or "## " paragraphs) become section headings. */
function bodyHtml(story: Story) {
  const outline = storyOutlines[story.slug]
  const withOutline = outline && outline.length === story.paragraphs.length
  return story.paragraphs
    .map((text, index) => {
      if (text.startsWith("## ")) return `<h2>${escapeHtml(text.slice(3).trim())}</h2>`
      const heading = withOutline ? `<h2>${escapeHtml(outline[index])}</h2>` : ""
      return `${heading}<p>${escapeHtml(text)}</p>`
    })
    .join("")
}

function toDraft(story: Story): ArticleDraft {
  return {
    slug: story.slug,
    title: story.title,
    dek: story.dek,
    body: story.html ?? bodyHtml(story),
    desk: story.desk,
    tags: story.tags ?? [story.topic],
    // Covers stay in /public/stories; store the absolute URL like an uploaded cover.
    coverUrl: new URL(publicUrl(`stories/${story.slug}.jpg`), window.location.origin).href,
    coverAlt: storyArt(story.slug).alt,
    coverCredit: story.coverCredit ?? "",
    coverRightsOk: true,
    sources: story.sources.map((source) => ({ label: source.label, href: source.href })),
    take: story.take ?? "",
  }
}

/** Built-in stories that have no article in the newsroom yet, newest first. */
export function pendingBuiltins(existingSlugs: Set<string>) {
  return stories.filter((story) => !existingSlugs.has(story.slug)).sort((a, b) => b.date.localeCompare(a.date))
}

/** Creates each story as an article and sends it to review. Stops at the first failure. */
export async function importBuiltins(backend: Backend, list: Story[], onProgress: (done: number) => void) {
  let done = 0
  for (const story of list) {
    const article = await backend.createArticle(toDraft(story))
    await backend.setStatus(article.id, "in_review")
    onProgress(++done)
  }
  return done
}
