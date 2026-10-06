import { useMemo } from "react"

import { useStories } from "@/content/live"
import { deskLabel, formatStoryDate, storyArt, type Desk, type Topic } from "@/content/stories"
import { substackPosts } from "@/content/substack.posts"

/*
 * Everything a reader can save, finish or comment on, by key: stories use
 * their slug, Substack letters use "letter-<slug>" so the two never collide.
 */

export interface LibraryItem {
  key: string
  title: string
  href: string
  image: string
  /** Substack images need no-referrer to load. */
  imageReferrer?: boolean
  /** Shown above the title, e.g. "Монгол · 5 сарын 3". */
  meta: string
  desk?: Desk
  topic?: Topic
}

export const letterKey = (slug: string) => `letter-${slug}`

function letterDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatStoryDate(date) : date
}

export function useLibraryItems() {
  const { stories } = useStories()
  return useMemo(() => {
    const items = new Map<string, LibraryItem>()
    for (const story of stories) {
      const art = storyArt(story.slug)
      items.set(story.slug, {
        key: story.slug,
        title: story.title,
        href: `/story/${story.slug}`,
        image: art.src,
        meta: `${deskLabel[story.desk]} · ${formatStoryDate(story.date)}`,
        desk: story.desk,
        topic: story.topic,
      })
    }
    for (const post of substackPosts) {
      items.set(letterKey(post.slug), {
        key: letterKey(post.slug),
        title: post.title,
        href: `/letter/${post.slug}`,
        image: post.image,
        imageReferrer: true,
        meta: `Нийтлэл · ${letterDate(post.date)}`,
      })
    }
    return items
  }, [stories])
}
