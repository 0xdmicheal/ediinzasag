import { useState } from "react"
import { Link } from "react-router-dom"

import { YoutubeFrame, youtubeId } from "@/components/site/YoutubeFrame"
import { Button } from "@/components/ui/button"
import { channels, episodes } from "@/content/channels"

const hosts = [
  ["Nio", "Эдийн засагч"],
  ["Ulemj", "Зах зээлийн шинжээч"],
] as const

const shelves = [
  ["Сүүлийн бичлэг", episodes.filter((episode) => episode.n == null && episode.date >= "2026")],
  ["Дугаар", episodes.filter((episode) => episode.n != null || (episode.date < "2026" && episode.date >= "2025"))],
  ["Өмнөх", episodes.filter((episode) => episode.date < "2025")],
] as const

function minutes(seconds: number) {
  return `${Math.round(seconds / 60)} мин`
}

export function TalkPage() {
  const [href, setHref] = useState<string>(episodes[0].href)
  const active = episodes.find((episode) => episode.href === href) ?? episodes[0]
  const numbered = episodes.filter((episode) => episode.n != null).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-6 border-b pb-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-muted-foreground text-[11px] tracking-[0.22em] uppercase">YouTube · @ediinzasag</p>
          <h1 className="font-news mt-3 text-5xl leading-[0.95] sm:text-6xl">EZ Talk</h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg leading-relaxed">
            Nio, эдийн засагч. Ulemj, зах зээлийн шинжээч. Дугаар #1-ээс #{numbered}. Сүүлийн бичлэг эндээс шууд гарна.
          </p>
        </div>
        <Button asChild className="w-fit">
          <a href={channels.youtube} target="_blank" rel="noreferrer">
            Суваг
          </a>
        </Button>
      </div>

      <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.7fr)]">
        <article className="overflow-hidden border bg-card lg:sticky lg:top-20">
          <YoutubeFrame key={active.href} href={active.href} title={active.title} />
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-6">
            <div>
              <div className="flex items-baseline gap-4">
                {active.n != null ? <p className="font-news text-6xl leading-none">{active.n}</p> : null}
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {active.date} · {minutes(active.seconds)}
                </p>
              </div>
              <h2 className="font-news mt-3 text-3xl leading-tight">{active.title}</h2>
              {active.note ? (
                <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">{active.note}</p>
              ) : null}
            </div>
            <Button asChild variant="outline" className="w-fit">
              <a href={active.href} target="_blank" rel="noreferrer">
                YouTube дээр нээх
              </a>
            </Button>
          </div>
        </article>

        <div className="border">
          {shelves.map(([label, items]) => (
            <section key={label}>
              <h2 className="bg-muted/40 px-4 py-2 text-[11px] tracking-[0.18em] uppercase">{label}</h2>
              <ol>
                {items.map((episode) => {
                  const selected = episode.href === active.href
                  const id = youtubeId(episode.href)
                  return (
                    <li key={episode.href} className="border-t">
                      <button
                        type="button"
                        onClick={() => setHref(episode.href)}
                        aria-pressed={selected}
                        className={`flex w-full items-center gap-3 px-3 py-3 text-left ${selected ? "bg-neutral-950 text-white dark:bg-[#f4f1ea] dark:text-neutral-950" : "hover:bg-muted/60"}`}
                      >
                        {id ? (
                          <img
                            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                            alt=""
                            className="h-14 w-24 shrink-0 object-cover"
                          />
                        ) : null}
                        <span className="font-news w-8 shrink-0 text-2xl leading-none">{episode.n ?? "·"}</span>
                        <span className="min-w-0">
                          <span className={`block text-[11px] tracking-wide uppercase ${selected ? "text-white/70 dark:text-neutral-950/60" : "text-muted-foreground"}`}>
                            {episode.date} · {minutes(episode.seconds)}
                          </span>
                          <span className="mt-1 block text-sm leading-snug">{episode.title}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      </div>

      <section className="mt-4 grid gap-px bg-border sm:grid-cols-2">
        {hosts.map(([name, role]) => (
          <div key={name} className="bg-background p-6">
            <p className="font-news text-7xl leading-none">{name.slice(0, 1)}</p>
            <h2 className="font-news mt-4 text-3xl">{name}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{role}</p>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-px bg-border sm:grid-cols-2">
        <Link to="/about#contact" className="bg-background px-6 py-5 hover:bg-muted/60">
          <p className="text-[11px] tracking-[0.18em] uppercase">Холбоо барих</p>
          <p className="font-news mt-2 text-2xl">Telegram шугам</p>
        </Link>
        <Link to="/about#partner" className="bg-background px-6 py-5 hover:bg-muted/60">
          <p className="text-[11px] tracking-[0.18em] uppercase">Хамтрах</p>
          <p className="font-news mt-2 text-2xl">Зочин, брэнд, судалгаа</p>
        </Link>
      </div>
    </div>
  )
}
