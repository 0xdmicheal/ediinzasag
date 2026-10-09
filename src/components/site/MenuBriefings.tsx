import { useState } from "react"
import { NavLink } from "react-router-dom"
import { cn } from "cn"
import { ArrowRight, Layers } from "lucide-react"

import { buttonClass } from "@/components/ds/primitives"
import { SheetClose } from "@/components/ui/sheet"
import { sortByDate, useStories } from "@/content/live"
import { formatStoryDate, storyArt, type Desk } from "@/content/stories"
import { desks } from "@/design/desks"

/*
 * Тойм in the phone menu, built from the design system: desk filter as
 * DeskChip-style toggles, a lead card with the story's cover, three compact
 * rows, and ghost buttons into the desk pages. Uses the live list, so stories
 * published from the admin appear here too.
 */

type Filter = "all" | Desk

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Бүгд" },
  { key: "mongolia", label: desks.mongolia.label },
  { key: "world", label: desks.world.label },
]

/** DeskChip's shape in neutral gray, for the menu. */
function DeskTag({ desk }: { desk: Desk }) {
  const { label, icon: Icon } = desks[desk]
  return (
    <span className="bg-foreground/[0.07] text-muted-foreground font-body text-ds-caption inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium">
      <Icon className="size-3" strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  )
}

export function MenuBriefings() {
  const { stories } = useStories()
  const [filter, setFilter] = useState<Filter>("all")
  const list = sortByDate(stories).filter((story) => filter === "all" || story.desk === filter)
  const [lead, ...rest] = list
  const more = rest.slice(0, 3)

  return (
    <section aria-labelledby="menu-briefings" className="px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 id="menu-briefings" className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase">
          Тойм
        </h2>
        <span className="text-muted-foreground font-mono text-[11px]">{list.length} тойм</span>
      </div>

      {/* Desk filter: the same chips the design system uses for desks. */}
      <div role="group" aria-label="Ширээ" className="mt-3 flex gap-1.5">
        {filters.map((item) => {
          const active = filter === item.key
          const Icon = item.key === "all" ? Layers : desks[item.key].icon
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.key)}
              className={cn(
                "font-body inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-ds-label font-medium transition-colors",
                active ? "bg-foreground/[0.08] text-foreground border-transparent" : "text-muted-foreground hover:text-foreground border-border",
              )}
            >
              <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
              {item.label}
            </button>
          )
        })}
      </div>

      {lead ? (
        <SheetClose asChild>
          <NavLink to={`/story/${lead.slug}`} className="group mt-3 block overflow-hidden rounded-lg border bg-card">
            <span className="relative block aspect-[16/9] overflow-hidden">
              <img
                src={storyArt(lead.slug).src}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </span>
            <span className="block p-3.5">
              <span className="flex items-center justify-between gap-2">
                <DeskTag desk={lead.desk} />
                <span className="text-muted-foreground font-mono text-[11px]">{formatStoryDate(lead.date)}</span>
              </span>
              <span className="font-news mt-2 line-clamp-3 block text-[17px] leading-snug">{lead.title}</span>
              <span className="text-muted-foreground mt-1 block text-[11px]">{lead.readMinutes} мин уншина</span>
            </span>
          </NavLink>
        </SheetClose>
      ) : null}

      {more.length > 0 ? (
        <ul className="mt-2 divide-y">
          {more.map((story) => (
            <li key={story.slug}>
              <SheetClose asChild>
                <NavLink to={`/story/${story.slug}`} className="group flex items-center gap-3 py-2.5">
                  <img src={storyArt(story.slug).src} alt="" className="size-14 shrink-0 rounded-md object-cover" />
                  <span className="min-w-0">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="bg-muted-foreground/60 size-1.5 rounded-full" aria-hidden />
                      {desks[story.desk].label} · {formatStoryDate(story.date)}
                    </span>
                    <span className="group-hover:text-foreground mt-0.5 line-clamp-2 block text-[14px] leading-snug font-medium">
                      {story.title}
                    </span>
                  </span>
                </NavLink>
              </SheetClose>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={cn("mt-3 grid gap-2", filter === "all" ? "grid-cols-2" : "grid-cols-1")}>
        {(filter === "all" ? (["mongolia", "world"] as const) : [filter]).map((desk) => (
          <SheetClose asChild key={desk}>
            <NavLink to={`/${desk}`} className={cn(buttonClass("ghost"), "w-full")}>
              {filter === "all" ? desks[desk].label : `Бүх ${desks[desk].label.toLowerCase()} тойм`}
              <ArrowRight className="size-3.5" />
            </NavLink>
          </SheetClose>
        ))}
      </div>
    </section>
  )
}
