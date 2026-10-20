import { useEffect, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import { cn } from "cn"

import { signedPct } from "@/components/site/market-marks"
import { Sparkline } from "@/components/site/Sparkline"
import { sortByDate, useStories } from "@/content/live"
import { loadLiveQuotes, type LiveQuote } from "@/content/live-quotes"
import { deskLabel, formatStoryDate } from "@/content/stories"
import { closeFigure, storyOnTopic, topicBySlug, topics, topicUnit, topicValue, type TopicFigure, type TopicHub } from "@/content/topics"
import { usePageTitle } from "@/lib/use-page-title"

const wide = "mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8"

/** /topic: every topic page in one list. */
export function TopicsPage() {
  usePageTitle("Сэдвүүд")
  return (
    <div className={wide}>
      <header className="border-b pb-6">
        <p className="text-muted-foreground font-mono text-[12px] uppercase">Сэдэв</p>
        <h1 className="font-news mt-2 text-4xl sm:text-5xl">Сэдвүүд</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-[15px] leading-relaxed">
          Ханш, үнэ, макро үзүүлэлт, томоохон төслүүд. Сэдэв бүрт өнөөдрийн тоо, энгийн тайлбар, холбогдох мэдээ.
        </p>
      </header>
      <ul className="divide-y">
        {topics.map((topic) => (
          <li key={topic.slug}>
            <Link to={`/topic/${topic.slug}`} className="group grid gap-1 py-5 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-8">
              <span className="font-news text-xl group-hover:underline">{topic.title}</span>
              <span className="text-muted-foreground text-[15px] leading-relaxed">{topic.dek}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** /topic/<slug>: the number, what it means, and every story on it. */
export function TopicPage() {
  const { slug = "" } = useParams()
  const topic = topicBySlug(slug)
  const { stories, ready } = useStories()
  usePageTitle(topic?.title)

  if (!topic) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="font-news text-4xl">Сэдэв олдсонгүй</h1>
        <Link to="/topic" className="mt-4 inline-block underline">
          Бүх сэдэв
        </Link>
      </section>
    )
  }

  const onTopic = sortByDate(stories.filter((story) => storyOnTopic(topic, story))).slice(0, 12)
  const others = topics.filter((item) => item.slug !== topic.slug)

  return (
    <div className={wide}>
      <header className="grid gap-8 border-b pb-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
        <div>
          <p className="text-muted-foreground font-mono text-[12px] uppercase">
            <Link to="/topic" className="hover:text-foreground">
              Сэдэв
            </Link>
          </p>
          <h1 className="font-news mt-2 text-4xl leading-tight sm:text-5xl">{topic.title}</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-[16px] leading-relaxed">{topic.dek}</p>
        </div>
        {topic.quote ? <LiveFigure topic={topic} /> : topic.figure ? <FixedFigure figure={topic.figure} /> : null}
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="max-w-2xl">
          {topic.sections.map((section) => (
            <section key={section.heading} className="mb-9">
              <h2 className="font-news text-2xl leading-snug">{section.heading}</h2>
              <p className="mt-3 text-[17px] leading-relaxed">{section.text}</p>
            </section>
          ))}
          {topic.market ? (
            <p className="text-muted-foreground border-t pt-4 text-[12px] leading-relaxed">
              Мэдээллийн зорилготой. Хөрөнгө оруулалтын зөвлөгөө биш. Бусад ханш, график{" "}
              <Link to="/markets" className="underline">
                Ханш, зах зээл
              </Link>{" "}
              хуудсанд.
            </p>
          ) : null}
        </article>

        <aside className="space-y-10">
          <section>
            <h2 className="text-muted-foreground font-mono text-[12px] uppercase">Мэдээ</h2>
            {onTopic.length > 0 ? (
              <ul className="mt-3 divide-y border-y">
                {onTopic.map((story) => (
                  <li key={story.slug}>
                    <Link to={`/story/${story.slug}`} className="group block py-3">
                      <span className="text-muted-foreground block font-mono text-[11.5px]">
                        {deskLabel[story.desk]} · {formatStoryDate(story.date)}
                      </span>
                      <span className="mt-1 block text-[15px] leading-snug group-hover:underline">{story.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-3 text-[14px]">{ready ? "Энэ сэдвээр мэдээ одоогоор алга." : "Ачаалж байна…"}</p>
            )}
          </section>
          <section>
            <h2 className="text-muted-foreground font-mono text-[12px] uppercase">Бусад сэдэв</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {others.map((item) => (
                <li key={item.slug}>
                  <Link to={`/topic/${item.slug}`} className="bg-card hover:border-foreground/30 block rounded-full border px-3 py-1 text-[13px] transition-colors">
                    {item.short}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function useQuote(id: string) {
  const [quote, setQuote] = useState<LiveQuote | null>(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    let alive = true
    loadLiveQuotes().then(
      (rows) => {
        if (!alive) return
        setQuote(rows.find((row) => row.id === id) ?? null)
        setDone(true)
      },
      () => alive && setDone(true),
    )
    return () => {
      alive = false
    }
  }, [id])
  return { quote, done }
}

/** "10.20 16:45" in Ulaanbaatar time. */
function ubStamp(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ulaanbaatar", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  )
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`
}

function LiveFigure({ topic }: { topic: TopicHub }) {
  const { quote, done } = useQuote(topic.quote!)
  if (!quote) {
    const close = closeFigure(topic)
    if (done && close) return <FixedFigure figure={close} />
    return <FigureCard label="Одоо" value="…" />
  }
  const trend = quote.spark.length > 1 ? quote.spark[quote.spark.length - 1] - quote.spark[0] : quote.pct
  const tone = trend > 0 ? "text-[var(--up)]" : trend < 0 ? "text-[var(--down)]" : "text-muted-foreground/40"
  const flat = Math.abs(quote.pct) < 0.005
  return (
    <FigureCard
      label="Одоо"
      value={topicValue(topic, quote)}
      unit={topicUnit(topic)}
      move={
        <span className={cn("font-mono text-[13px] font-semibold tabular-nums", flat ? "text-muted-foreground" : quote.pct > 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
          {flat ? "0.00%" : `${quote.pct > 0 ? "▲" : "▼"} ${signedPct(quote.pct).replace(/^[+-]/, "")}`}
          {quote.monthPct !== null ? <span className="text-muted-foreground ml-2 font-normal">Сард {signedPct(quote.monthPct).replace("-", "−")}</span> : null}
        </span>
      }
      chart={<Sparkline points={quote.spark} tone={tone} className="mt-4 h-14 w-full" />}
      note={
        <>
          {ubStamp(quote.asOf)} ·{" "}
          <a href={quote.href} target="_blank" rel="noreferrer" className="underline">
            {quote.source}
          </a>{" "}
          · 15 минут тутам
        </>
      }
    />
  )
}

function FixedFigure({ figure }: { figure: TopicFigure }) {
  return (
    <FigureCard
      label={figure.label}
      value={figure.value}
      note={
        <a href={figure.href} target="_blank" rel="noreferrer" className="underline">
          {figure.source}
        </a>
      }
    />
  )
}

function FigureCard({ label, value, unit, move, chart, note }: { label: string; value: string; unit?: string; move?: ReactNode; chart?: ReactNode; note?: ReactNode }) {
  return (
    <div className="bg-card rounded-lg border p-5">
      <p className="text-muted-foreground text-[12px]">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[34px] leading-none font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className="text-muted-foreground text-[13px]">{unit}</span> : null}
      </p>
      {move ? <p className="mt-2">{move}</p> : null}
      {chart}
      {note ? <p className="text-muted-foreground mt-3 text-[11.5px] leading-relaxed">{note}</p> : null}
    </div>
  )
}
