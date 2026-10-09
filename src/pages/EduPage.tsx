import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, Play } from "lucide-react"

import { YoutubeFrame, youtubeId } from "@/components/site/YoutubeFrame"
import { channels } from "@/content/channels"
import { courses, type Course, type Lesson } from "@/content/courses"

const wide = "mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8"

function clock(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(h ? 2 : 1, "0")
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`
}

function thumb(href: string) {
  const id = youtubeId(href)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ""
}

export function EduPage() {
  const ready = courses.filter((course) => course.lessons.length > 0)
  return (
    <div className="pb-20">
      <header className={`${wide} pt-8 pb-6`}>
        <p className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">Хичээл · Эдийн засаг</p>
        <h1 className="font-news mt-2 text-5xl leading-none sm:text-6xl">EZ Edu</h1>
        <p className="text-muted-foreground mt-3 max-w-xl leading-relaxed">
          Эдийн засгийг дараалалтай хичээлээр. Бичлэг бүр YouTube дээр, энд дугаарынхаа дарааллаар үлдэнэ.
        </p>
      </header>
      {ready.length > 0 ? <Catalog courses={ready} /> : <EmptyDesk />}
    </div>
  )
}

function EmptyDesk() {
  return (
    <section className={`${wide} grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]`}>
      <div className="bg-studio text-photo-foreground flex min-h-72 flex-col justify-between rounded-xl p-6 sm:p-8">
        <p className="text-photo-foreground/60 text-[11px] tracking-[0.18em] uppercase">Сургалт</p>
        <div>
          <h2 className="font-news max-w-lg text-3xl leading-tight sm:text-4xl">Эхний хичээл хараахан ороогүй.</h2>
          <p className="text-photo-foreground/70 mt-3 max-w-md text-sm leading-relaxed">
            Хичээл нэмэгдэхэд энд тоглуулагч, дугаар, үргэлжлэх хугацаа гарна. EZ Talk бол яриа. EZ Edu бол хичээл.
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-6 rounded-xl border p-6 sm:p-8">
        <div>
          <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">Одоо үзэх</p>
          <h2 className="font-news mt-2 text-3xl leading-tight">Яриа нь EZ Talk дээр.</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/ez-talk"
            className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium"
          >
            EZ Talk
            <ArrowUpRight className="size-4" />
          </Link>
          <a
            href={channels.youtube}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium"
          >
            YouTube
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

function Catalog({ courses: list }: { courses: Course[] }) {
  const [slug, setSlug] = useState(list[0].slug)
  const course = list.find((item) => item.slug === slug) ?? list[0]
  const [href, setHref] = useState(course.lessons[0].href)
  const [picked, setPicked] = useState(false)
  const player = useRef<HTMLDivElement>(null)
  const lesson = course.lessons.find((item) => item.href === href) ?? course.lessons[0]
  const total = course.lessons.reduce((sum, item) => sum + item.seconds, 0)

  function openCourse(next: Course) {
    setSlug(next.slug)
    setHref(next.lessons[0].href)
    setPicked(false)
  }

  function play(item: Lesson) {
    setHref(item.href)
    setPicked(true)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    player.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  }

  return (
    <div className={`${wide} flex flex-col gap-8`}>
      {list.length > 1 ? (
        <div role="tablist" aria-label="Хичээлүүд" className="flex flex-wrap gap-2">
          {list.map((item) => {
            const selected = item.slug === course.slug
            return (
              <button
                key={item.slug}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => openCourse(item)}
                className={`h-9 rounded-full px-4 text-[13px] font-medium ${selected ? "bg-foreground text-background" : "border text-muted-foreground"}`}
              >
                {item.title}
              </button>
            )
          })}
        </div>
      ) : null}

      <section className="bg-studio text-photo-foreground grid overflow-hidden rounded-xl lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div ref={player} className="scroll-mt-20 bg-black">
          <YoutubeFrame key={lesson.href} href={lesson.href} title={lesson.title} autoplay={picked} />
        </div>
        <div className="flex max-h-[70vh] flex-col lg:max-h-none">
          <div className="border-photo-foreground/10 border-b p-5 sm:p-6">
            <p className="text-photo-foreground/60 text-[11px] tracking-[0.16em] uppercase">
              {course.lessons.length} хичээл · {Math.max(1, Math.round(total / 60))} мин
            </p>
            <h2 className="font-news mt-2 text-3xl leading-tight">{course.title}</h2>
            <p className="text-photo-foreground/70 mt-2 text-sm leading-relaxed">{course.dek}</p>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto">
            {course.lessons.map((item) => {
              const current = item.href === lesson.href
              return (
                <li key={item.href} className="border-photo-foreground/10 border-b">
                  <button
                    type="button"
                    onClick={() => play(item)}
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left ${current ? "bg-photo-foreground text-studio" : "hover:bg-photo-foreground/5"}`}
                  >
                    <span className="font-news w-8 shrink-0 text-lg tabular-nums">{item.n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm leading-snug">{item.title}</span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums opacity-70">{clock(item.seconds)}</span>
                    {current ? <Play className="size-3.5 shrink-0 fill-current" aria-hidden /> : null}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {course.lessons.map((item) => {
          const current = item.href === lesson.href
          return (
            <li key={item.href}>
              <button type="button" onClick={() => play(item)} className="group w-full text-left">
                <span className={`relative block aspect-video overflow-hidden rounded-lg ${current ? "ring-foreground ring-2 ring-offset-2 ring-offset-background" : ""}`}>
                  <img src={thumb(item.href)} alt="" className="size-full object-cover" />
                  <span className="absolute right-2 bottom-2 rounded-sm bg-black/75 px-1.5 py-0.5 text-[11px] text-white tabular-nums">
                    {clock(item.seconds)}
                  </span>
                </span>
                <span className="text-muted-foreground mt-3 block text-[11px] tracking-wide uppercase">Хичээл {item.n}</span>
                <span className="font-news mt-1 line-clamp-2 block text-[17px] leading-snug">{item.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
