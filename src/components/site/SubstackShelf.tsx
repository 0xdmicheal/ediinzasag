import { useState } from "react"
import { Link } from "react-router-dom"

import { formatStoryDate } from "@/content/stories"
import type { SubstackPost } from "@/content/substack.posts"

function letterDate(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatStoryDate(iso) : iso
}

function LetterImage({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className={`bg-muted ${className}`} />
  return (
    <img
      src={src}
      alt=""
      className={`object-cover ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

export function SubstackShelf({
  posts,
  layout,
}: {
  posts: SubstackPost[]
  layout: "grid" | "list"
}) {
  if (posts.length === 0) return null

  if (layout === "list") {
    return (
      <div className="flex flex-col gap-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/letter/${post.slug}`}
            className="group ez-lift bg-card grid gap-4 rounded-lg border p-3 md:grid-cols-[14rem_1fr] md:items-center md:p-4"
          >
            <LetterImage src={post.image} className="h-36 w-full rounded-md" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                {letterDate(post.date)}
                {post.author ? ` · ${post.author}` : ""}
              </p>
              <h3 className="font-news mt-1 text-2xl leading-snug">{post.title}</h3>
              {post.excerpt ? (
                <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">{post.excerpt}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <Link
          key={post.slug}
          to={`/letter/${post.slug}`}
          className="group ez-lift bg-card flex h-[22rem] flex-col overflow-hidden rounded-lg border"
        >
          <LetterImage src={post.image} className="h-36 w-full shrink-0" />
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              {letterDate(post.date)}
              {post.author ? ` · ${post.author}` : ""}
            </p>
            <h3 className="font-news mt-2 line-clamp-3 text-xl leading-snug">{post.title}</h3>
            {post.excerpt ? (
              <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">{post.excerpt}</p>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  )
}
