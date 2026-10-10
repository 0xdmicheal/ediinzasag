import { useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, ArrowUpRight, Play } from "lucide-react"
import { FaTelegram, FaYoutube } from "react-icons/fa6"

import { SectionHeader } from "@/components/site/home-sections"
import { YoutubeFrame, youtubeId } from "@/components/site/YoutubeFrame"
import { channels, type Episode } from "@/content/channels"
import { useEpisodes } from "@/content/useEpisodes"

const wide = "mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8"
const narrow = "mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8"

const hosts = [
  { name: "Nio", role: "Эдийн засагч" },
  { name: "Ulemj", role: "Зах зээлийн шинжээч" },
] as const

const filters = [
  { id: "all", label: "Бүгд", match: () => true },
  { id: "recent", label: "Сүүлийн бичлэг", match: (e: Episode) => e.n == null && e.date >= "2026" },
  { id: "series", label: "Дугаар", match: (e: Episode) => e.n != null },
  { id: "archive", label: "Өмнөх", match: (e: Episode) => e.n == null && e.date < "2026" },
] as const

type FilterId = (typeof filters)[number]["id"]

function minutes(seconds: number) {
  if (seconds <= 0) return "" // live feed items have no duration; hide it.
  return `${Math.round(seconds / 60)} мин`
}

function clock(seconds: number) {
  if (seconds <= 0) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(h ? 2 : 1, "0")
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`
}

function thumb(href: string, quality: "hq" | "mq" = "hq") {
  const id = youtubeId(href)
  return id ? `https://i.ytimg.com/vi/${id}/${quality}default.jpg` : ""
}

export function TalkPage() {
  const episodes = useEpisodes()
  const [href, setHref] = useState<string>(episodes[0].href)
  const [picked, setPicked] = useState(false)
  const [filter, setFilter] = useState<FilterId>("all")
  const player = useRef<HTMLDivElement>(null)

  const series = useMemo(() => episodes.filter((episode) => episode.n != null).sort((a, b) => (a.n ?? 0) - (b.n ?? 0)), [episodes])
  const totalHours = useMemo(() => Math.round(episodes.reduce((sum, episode) => sum + episode.seconds, 0) / 3600), [episodes])
  const firstYear = useMemo(() => episodes.reduce((year, episode) => (episode.date < year ? episode.date : year), "9999").slice(0, 4), [episodes])

  const activeIndex = Math.max(
    0,
    episodes.findIndex((episode) => episode.href === href),
  )
  const active = episodes[activeIndex]
  const upNext = [1, 2, 3].map((step) => episodes[(activeIndex + step) % episodes.length])
  const shown = episodes.filter(filters.find((item) => item.id === filter)!.match)

  function play(episode: Episode) {
    setHref(episode.href)
    setPicked(true)
    player.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <header className={`${wide} flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pt-8 pb-6`}>
        <div className="max-w-xl">
          <p className="text-muted-foreground flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase">
            <FaYoutube className="size-3.5 text-[#ff0033]" aria-hidden />
            YouTube · @ediinzasag
          </p>
          <h1 className="font-news mt-2 text-5xl leading-none sm:text-6xl">EZ Talk</h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Эдийн засагч Nio, зах зээлийн шинжээч Ulemj. Сэдэв бүрийг тоогоор нь, ойлгомжтой ярина.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-6 sm:gap-10">
          <dl className="flex gap-6 sm:gap-10">
            {[
              [String(episodes.length), "бичлэг"],
              [String(series.length), "дугаар"],
              [`${totalHours}+`, "цаг"],
              [firstYear, "оноос"],
            ].map(([value, label]) => (
              <div key={label}>
                <dd className="font-news text-3xl leading-none sm:text-4xl">{value}</dd>
                <dt className="text-muted-foreground mt-1 text-[11px] tracking-[0.14em] uppercase">{label}</dt>
              </div>
            ))}
          </dl>
          <a
            href={channels.youtube}
            target="_blank"
            rel="noreferrer"
            className="bg-brand text-brand-foreground inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-transform hover:-translate-y-0.5"
          >
            Суваг дагах
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </header>

      {/* Studio */}
      <section className={wide} aria-label="Тоглуулагч">
        <div className="bg-studio text-photo-foreground grid overflow-hidden rounded-xl lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div ref={player} className="scroll-mt-20 bg-black">
            <YoutubeFrame key={active.href} href={active.href} title={active.title} autoplay={picked} />
          </div>

          <aside className="flex flex-col p-5 sm:p-6 lg:p-7">
            <p className="text-photo-foreground/60 flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase">
              <span className="relative flex size-2">
                <span className="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
                <span className="bg-brand relative inline-flex size-2 rounded-full" />
              </span>
              Одоо үзэж байна
            </p>
            <div className="mt-4 flex items-end gap-4">
              <p className="font-news text-brand text-6xl leading-[0.8] sm:text-7xl">
                {active.n != null ? `#${active.n}` : "EZ"}
              </p>
              <p className="text-photo-foreground/60 pb-1 text-xs">
                {active.date}
                <br />
                {minutes(active.seconds)}
              </p>
            </div>
            <h2 className="font-news mt-4 text-2xl leading-tight sm:text-[1.75rem]">{active.title}</h2>
            {active.note ? (
              <p className="text-photo-foreground/70 mt-2 text-sm leading-relaxed">{active.note}</p>
            ) : null}
            <a
              href={active.href}
              target="_blank"
              rel="noreferrer"
              className="hover:bg-photo-foreground/10 border-photo-foreground/25 mt-5 inline-flex h-10 w-fit items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors"
            >
              <FaYoutube className="size-4" aria-hidden />
              YouTube дээр нээх
            </a>

            <div className="border-photo-foreground/15 mt-6 border-t pt-4 lg:mt-auto">
              <p className="text-photo-foreground/70 text-[11px] tracking-[0.18em] uppercase">Дараагийнх</p>
              <ul className="mt-2">
                {upNext.map((episode) => (
                  <li key={episode.href}>
                    <button
                      type="button"
                      onClick={() => play(episode)}
                      className="group hover:bg-photo-foreground/5 -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors"
                    >
                      <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-sm">
                        <img src={thumb(episode.href, "mq")} alt="" loading="lazy" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <Play className="size-3.5 fill-current" />
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="text-photo-foreground/70 block text-[11px] tracking-wide uppercase">
                          {episode.n != null ? `#${episode.n} · ` : ""}
                          {episode.date}
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-[13px]">{episode.title}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <div className={`${narrow} mt-20 flex flex-col gap-20`}>
        {/* Series timeline */}
        <section>
          <SectionHeader index="01" kicker={`Дугаар #1–#${series.length}`} title="Цуврал" />
          <div className="-mx-4 overflow-x-auto px-4 pb-2 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden">
            <ol className="flex min-w-max">
              {series.map((episode, index) => {
                const current = episode.href === active.href
                return (
                  <li key={episode.href} className="relative w-40 shrink-0 pr-4">
                    {index < series.length - 1 ? (
                      <span aria-hidden className="bg-border absolute top-6 left-12 right-0 h-px" />
                    ) : null}
                    <button type="button" onClick={() => play(episode)} className="group block text-left">
                      <span
                        className={`font-news relative grid size-12 place-items-center rounded-full border text-xl transition-colors duration-300 ${current ? "bg-brand border-brand text-brand-foreground" : "bg-card group-hover:border-brand group-hover:text-brand-strong"}`}
                      >
                        {episode.n}
                      </span>
                      <span className="text-muted-foreground mt-3 block text-[11px] tabular-nums">{episode.date}</span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-snug font-medium">
                        <span className="ez-underline">{episode.title}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* Library */}
        <section>
          <SectionHeader index="02" kicker={`${episodes.length} бичлэг`} title="Бүх бичлэг">
            <div role="tablist" aria-label="Шүүлтүүр" className="bg-muted flex flex-wrap gap-1 rounded-full p-1">
              {filters.map((item) => {
                const selected = item.id === filter
                const count = episodes.filter(item.match).length
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setFilter(item.id)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${selected ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {item.label}
                    <span className="text-muted-foreground text-[11px] tabular-nums">{count}</span>
                  </button>
                )
              })}
            </div>
          </SectionHeader>

          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((episode) => {
              const current = episode.href === active.href
              return (
                <button
                  key={episode.href}
                  type="button"
                  onClick={() => play(episode)}
                  className="group text-left"
                >
                  <span
                    className={`ez-lift relative block aspect-video overflow-hidden rounded-lg ${current ? "ring-brand ring-2 ring-offset-2 ring-offset-background" : ""}`}
                  >
                    <img
                      src={thumb(episode.href)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full scale-[1.04] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.09]"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors duration-300 group-hover:bg-black/35">
                      <span className="bg-brand text-brand-foreground grid size-12 scale-75 place-items-center rounded-full opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100">
                        <Play className="ml-0.5 size-5 fill-current" />
                      </span>
                    </span>
                    {episode.n != null ? (
                      <span className="bg-brand text-brand-foreground font-news absolute top-2 left-2 rounded-sm px-1.5 py-0.5 text-sm leading-none">
                        #{episode.n}
                      </span>
                    ) : null}
                    {episode.seconds > 0 ? (
                      <span className="absolute right-2 bottom-2 rounded-sm bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
                        {clock(episode.seconds)}
                      </span>
                    ) : null}
                    {current ? (
                      <span className="bg-brand text-brand-foreground absolute bottom-2 left-2 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                        Тоглож байна
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground mt-3 block text-[11px] tracking-wide uppercase">{episode.date}</span>
                  <span className="font-news mt-1 line-clamp-2 block text-[17px] leading-snug">
                    <span className="ez-underline">{episode.title}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Hosts + call to action */}
        <section className="grid gap-3 lg:grid-cols-2">
          <div className="grid gap-3">
          {hosts.map((host) => (
            <article key={host.name} className="bg-card flex items-center gap-4 rounded-lg border p-4 sm:p-5">
              <span className="bg-brand/20 text-brand-strong font-news grid size-14 shrink-0 place-items-center rounded-full text-2xl">
                {host.name.slice(0, 1)}
              </span>
              <span>
                <span className="text-muted-foreground block text-[11px] tracking-[0.16em] uppercase">Хөтлөгч</span>
                <span className="font-news mt-1 block text-2xl leading-none">{host.name}</span>
                <span className="text-muted-foreground mt-1.5 block text-sm">{host.role}</span>
              </span>
            </article>
          ))}
          </div>
          <article className="bg-brand text-brand-foreground relative isolate flex flex-col justify-between gap-5 overflow-hidden rounded-lg p-5 sm:p-6">
            <p aria-hidden className="font-news text-brand-foreground/[0.08] absolute -right-3 -bottom-10 -z-10 text-[9rem] leading-none font-bold">
              EZ
            </p>
            <div>
              <p className="text-brand-foreground/70 text-[11px] tracking-[0.16em] uppercase">Зочин · Хамтрах</p>
              <h2 className="font-news mt-1 text-3xl leading-tight">Зочин болох уу?</h2>
              <p className="text-brand-foreground/80 mt-2 max-w-sm text-sm leading-relaxed">
                Сэдэв, зочин, хамтын ажлын саналаа Telegram-аар илгээгээрэй.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={channels.telegram}
                target="_blank"
                rel="noreferrer"
                className="bg-brand-foreground text-brand inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-transform hover:-translate-y-0.5"
              >
                <FaTelegram className="size-4" aria-hidden />
                Telegram
              </a>
              <Link
                to="/about#partner"
                className="border-brand-foreground/30 hover:bg-brand-foreground/10 inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium transition-colors"
              >
                Хамтрах
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}
