import { Fragment, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { cn } from "cn"

import { DivergeBar, ShareBar, signedPct, toneClass } from "@/components/site/market-marks"
import { PriceBoard } from "@/components/site/PriceBoard"
import {
  commodities,
  fridayCloses,
  fridayFlow,
  fx,
  miners,
  top20,
  worldIndices,
  type Quote,
} from "@/content/markets"

const sections = [
  { id: "top20", label: "Монгол" },
  { id: "closes", label: "Хаалт" },
  { id: "flow", label: "Арилжаа" },
  { id: "abroad", label: "Гадаад" },
]

function useActiveSection() {
  const [active, setActive] = useState(sections[0].id)

  useEffect(() => {
    const nodes = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => node !== null)
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.2] },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return active
}

function flowWeight(value: string) {
  const weight = Number.parseFloat(value)
  return Number.isFinite(weight) ? weight : 0
}

export function MarketsPage() {
  const active = useActiveSection()
  const closeMax = Math.max(...fridayCloses.map((row) => Math.abs(row.pct)))
  const flowMax = Math.max(...fridayFlow.map((row) => flowWeight(row.value)))
  const worldMax = Math.max(...worldIndices.map((quote) => Math.abs(quote.pct)))
  const commodityMax = Math.max(...commodities.map((quote) => Math.abs(quote.pct)))
  const firstDown = fridayCloses.findIndex((row) => row.pct < 0)

  return (
    <>
      <nav aria-label="Ханшийн хэсэг" className="bg-background/90 sticky top-14 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? "location" : undefined}
              className={cn(
                "shrink-0 border-b-2 px-3 py-3 text-sm",
                active === section.id
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>

      <PriceBoard />

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6">
        <section id="closes" className="scroll-mt-28">
          <h2 className="font-news text-3xl">Хаалтын ханш</h2>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
            Төгрөгөөр. Ногоон нь өсөлт, улаан нь бууралт. Зураас төвөөсөө урт байх тусам өдрийн хувь их.
            Эх сурвалж:{" "}
            <a className="underline" href={top20.href}>
              МХБ-ийн 2026.10.02-ны тайлан
            </a>
            .
          </p>
          <div className="mt-5">
            {fridayCloses.map((row, index) => (
              <Fragment key={row.symbol}>
                {index === 0 ? <GroupLabel>Өсөлт</GroupLabel> : null}
                {index === firstDown ? <GroupLabel>Бууралт</GroupLabel> : null}
                <article id={row.symbol.toLowerCase()} className="scroll-mt-28 border-b py-3 target:bg-muted">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm leading-snug">
                      <span className="font-medium">{row.symbol}</span>
                      <span className="text-muted-foreground"> · {row.name}</span>
                    </p>
                    <p className="font-news shrink-0 text-xl leading-none">
                      {row.price}
                      <span className="text-muted-foreground ml-1 text-xs">₮</span>
                    </p>
                  </div>
                  <div className="mt-2">
                    <DivergeBar pct={row.pct} max={closeMax} />
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-3">
                    <p className={`text-sm tabular-nums ${toneClass(row.pct)}`}>
                      {row.move}
                      <span className="text-muted-foreground mx-1.5">·</span>
                      {signedPct(row.pct)}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">{row.volume} ширхэг</p>
                  </div>
                </article>
              </Fragment>
            ))}
          </div>
        </section>

        <section id="flow" className="scroll-mt-28">
          <h2 className="font-news text-3xl">Үнийн дүнгээр тэргүүлсэн</h2>
          <p className="mt-3 max-w-3xl rounded-md border px-4 py-3 text-sm leading-relaxed">
            Хаан банк, Худалдаа хөгжлийн банк, Ард санхүүгийн нэгдлийн хаалтын ханш энэ өдрийн нэг
            хуудас тайланд байхгүй. Дундаж үнэ нь үнийн дүнг ширхэгт хуваасан тоо. Хаалт биш.
          </p>
          <div className="mt-5">
            {fridayFlow.map((row, index) => (
              <article key={row.symbol} className="border-b py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="text-muted-foreground mr-2 text-xs tabular-nums">0{index + 1}</span>
                    <span className="font-medium">{row.symbol}</span>
                    <span className="text-muted-foreground"> · {row.name}</span>
                  </p>
                  <p className="font-news shrink-0 text-xl leading-none">{row.value}</p>
                </div>
                <div className="mt-2">
                  <ShareBar value={flowWeight(row.value)} max={flowMax} />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3">
                  <p className="text-muted-foreground text-[11px]">
                    {row.average === "—" ? "Хаалт тайланд байхгүй" : `Дундаж ${row.average} ₮ · хаалт биш`}
                  </p>
                  <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {row.volume === "—" ? "—" : `${row.volume} ширхэг`}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section id="abroad" className="bg-muted/40 scroll-mt-28 border-t">
        <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">Гадаад</p>
            <h2 className="font-news mt-2 text-3xl">Дэлхийн индекс</h2>
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
              Монголоос гадуурх хаалт. Доорх үнэ төгрөг биш.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {worldIndices.map((quote) => (
                <QuoteTile key={quote.id} quote={quote} max={worldMax} />
              ))}
            </div>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Шанхайн сүүлийн арилжаа 2026.09.30. Аравдугаар сарын эхээр Хятадын зах зээл Алтан
              долоо хоногоор хаалттай байсан.{" "}
              <Link to="/story/world-friday-board" className="underline">
                Дэлхийн индексийн тойм
              </Link>
            </p>
          </div>

          <div>
            <h2 className="font-news text-3xl">Түүхий эд</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {commodities.map((quote) => (
                <QuoteTile key={quote.id} quote={quote} max={commodityMax} />
              ))}
            </div>
            <p className="mt-4 flex flex-col gap-2 text-sm">
              <Link to="/story/copper-coal-friday" className="underline">
                Зэс, нүүрсний тойм
              </Link>
              <Link to="/story/gold-friday" className="underline">
                Алтны тойм
              </Link>
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-news text-3xl">Валют, өгөөж</h2>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {fx.map((quote) => (
                  <QuoteTile key={quote.id} quote={quote} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-news text-3xl">Зэсийн уурхай</h2>
              <p className="text-muted-foreground mt-2 text-sm">Ам.доллар. Монголын төгрөгийн хаалт биш.</p>
              <div className="mt-5 grid gap-2">
                {miners.map((row) => (
                  <article
                    key={row.symbol}
                    id={row.symbol.toLowerCase()}
                    className="bg-card scroll-mt-28 rounded-md border p-4 target:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">{row.symbol}</h3>
                        <p className="text-muted-foreground text-sm">{row.name}</p>
                      </div>
                      <p className={`text-sm tabular-nums ${toneClass(row.pct)}`}>{row.move}</p>
                    </div>
                    <p className="font-news mt-3 text-2xl leading-none">
                      {row.price}
                      <span className="text-muted-foreground ml-1 text-xs">{row.note}</span>
                    </p>
                    <p className="text-muted-foreground mt-3 text-[11px]">Rio Times · 2026.10.02</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground pt-5 pb-1 text-[11px] tracking-[0.16em] uppercase first:pt-0">
      {children}
    </p>
  )
}

function QuoteTile({ quote, max }: { quote: Quote; max?: number }) {
  return (
    <article id={quote.id} className="bg-card scroll-mt-28 flex flex-col rounded-md border p-4 target:bg-muted">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium">{quote.label}</h3>
        <p className={`text-right text-sm tabular-nums ${toneClass(quote.pct)}`}>{quote.move}</p>
      </div>
      <p className="font-news mt-3 text-2xl leading-none">{quote.price}</p>
      {quote.unit ? <p className="text-muted-foreground mt-1 text-xs">{quote.unit}</p> : null}
      {max !== undefined ? (
        <div className="mt-3">
          <DivergeBar pct={quote.pct} max={max} />
        </div>
      ) : null}
      <p className="text-muted-foreground mt-auto pt-3 text-[11px]">
        {quote.asOf}
        {" · "}
        {quote.href ? (
          <a className="underline" href={quote.href}>
            {quote.source}
          </a>
        ) : (
          quote.source
        )}
      </p>
    </article>
  )
}
