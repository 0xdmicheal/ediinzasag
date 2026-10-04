import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { deskLabel, formatStoryDate, storyArt, topicLabel, type Story } from "@/content/stories"

const HOLD_MS = 6000

export function FrontPhoto({ stories }: { stories: Story[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const startX = useRef<number | null>(null)
  const dragged = useRef(false)
  const count = stories.length
  const story = stories[index]
  const art = story ? storyArt(story.slug) : null

  useEffect(() => {
    if (paused || count < 2) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count)
    }, HOLD_MS)
    return () => window.clearInterval(id)
  }, [paused, count, index])

  if (!story || !art) return null

  function go(next: number) {
    setIndex((next + count) % count)
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <div
        className="relative overflow-hidden rounded-xl bg-muted"
        onPointerDown={(event) => {
          startX.current = event.clientX
          dragged.current = false
        }}
        onPointerUp={(event) => {
          if (startX.current == null) return
          const delta = event.clientX - startX.current
          startX.current = null
          if (Math.abs(delta) < 48) return
          dragged.current = true
          go(index + (delta < 0 ? 1 : -1))
        }}
      >
        <Link
          to={`/story/${story.slug}`}
          className="relative block"
          onClick={(event) => {
            if (!dragged.current) return
            event.preventDefault()
            dragged.current = false
          }}
        >
          <img
            key={story.slug}
            src={art.src}
            alt={art.alt}
            className="ez-front-photo h-[22rem] w-full object-cover sm:h-[30rem]"
          />
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pt-20 pb-4 sm:px-6 sm:pb-5">
          <p className="text-[11px] tracking-[0.16em] text-white/80 uppercase">
            {deskLabel[story.desk]} · {topicLabel[story.topic]} · {formatStoryDate(story.date)}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <h1 className="font-news max-w-3xl text-3xl leading-[1.12] font-medium text-white sm:text-4xl">
              {story.title}
            </h1>
            <Link
              to={`/story/${story.slug}`}
              className="pointer-events-auto inline-flex h-10 shrink-0 items-center rounded-full bg-white px-4 text-sm font-medium text-neutral-950"
            >
              Унших
            </Link>
          </div>
          <div className="pointer-events-auto mt-4 flex items-center gap-2">
            {stories.map((item, itemIndex) => {
              const active = itemIndex === index
              return (
                <button
                  key={item.slug}
                  type="button"
                  aria-label={item.title}
                  aria-current={active ? "true" : undefined}
                  onClick={() => go(itemIndex)}
                  className="grid size-6 place-items-center"
                >
                  <span className={`rounded-full ${active ? "size-2.5 bg-white" : "size-2 bg-white/45"}`} />
                </button>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          aria-label="Өмнөх зураг"
          onClick={() => go(index - 1)}
          className="absolute top-4 left-3 grid size-10 place-items-center rounded-full bg-background/85 text-foreground sm:top-1/2 sm:-translate-y-1/2"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Дараагийн зураг"
          onClick={() => go(index + 1)}
          className="absolute top-4 right-3 grid size-10 place-items-center rounded-full bg-background/85 text-foreground sm:top-1/2 sm:-translate-y-1/2"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  )
}
