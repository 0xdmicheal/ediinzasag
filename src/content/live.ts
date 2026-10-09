import { useEffect, useState } from "react"

import type { Article, Tag } from "@/admin/types"
import { countWords } from "@/lib/article-html"
import { deskLabel, registerCover, stories as staticStories, topicLabel, type Story, type Topic } from "@/content/stories"

/*
 * Published articles from the admin, merged with the built-in stories.
 * The admin backend is loaded on demand, so pages render the built-in
 * stories immediately and pick up published articles when they arrive.
 */

const topics = Object.keys(topicLabel) as Topic[]

function toStory(article: Article): Story {
  if (article.coverUrl) registerCover(article.slug, { src: article.coverUrl, alt: article.coverAlt })
  const words = countWords(article.body)
  return {
    slug: article.slug,
    desk: article.desk,
    topic: (article.tags.find((tag) => (topics as string[]).includes(tag)) as Topic | undefined) ?? "markets",
    title: article.title,
    dek: article.dek,
    date: (article.publishedAt ?? article.updatedAt).slice(0, 10),
    readMinutes: Math.max(1, Math.round(words / 200)),
    paragraphs: [],
    html: article.body,
    sources: article.sources,
    tags: article.tags,
    author: article.authorName,
    take: article.take,
    coverCredit: article.coverCredit,
  }
}

let published: Promise<{ stories: Story[]; tags: Tag[] }> | null = null

function loadPublished() {
  published ??= import("@/admin/backend")
    .then(({ getBackend }) => getBackend())
    .then(async (backend) => {
      const [articles, tags] = await Promise.all([backend.listPublished(), backend.listTags()])
      return { stories: articles.map(toStory), tags }
    })
    .catch(() => ({ stories: [], tags: [] }))
  return published
}

function merge(remote: Story[]) {
  const slugs = new Set(remote.map((story) => story.slug))
  return [...remote, ...staticStories.filter((story) => !slugs.has(story.slug))]
}

/** All stories readers can see: admin-published first (by slug), then built-in ones. */
export function useStories() {
  const [list, setList] = useState<Story[]>(staticStories)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    loadPublished().then(({ stories }) => {
      if (cancelled) return
      if (stories.length) setList(merge(stories))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return { stories: list, ready }
}

/** Label for any tag slug: admin tags, then topics and desks. */
export function useTagLabels() {
  const [labels, setLabels] = useState<Map<string, string>>(
    () => new Map<string, string>([...Object.entries(topicLabel), ...Object.entries(deskLabel)]),
  )
  useEffect(() => {
    let cancelled = false
    loadPublished().then(({ tags }) => {
      if (cancelled || tags.length === 0) return
      setLabels((current) => new Map([...current, ...tags.map((tag) => [tag.slug, tag.label] as [string, string])]))
    })
    return () => {
      cancelled = true
    }
  }, [])
  return labels
}

export const sortByDate = (list: Story[]) => [...list].sort((a, b) => b.date.localeCompare(a.date))
