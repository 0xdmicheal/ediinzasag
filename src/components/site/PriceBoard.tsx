import { Link } from "react-router-dom"

import { toneClass } from "@/components/site/market-marks"
import {
  mongoliaIndices,
  sessionLabel,
  sessionNote,
  sessionStats,
  top20,
} from "@/content/markets"

export function PriceBoard() {
  return (
    <section aria-label="Монголын ханш" className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">{sessionLabel}</p>
            <h1 className="font-news mt-2 text-4xl sm:text-5xl">Монголын хөрөнгийн бирж</h1>
          </div>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{sessionNote}</p>
        </div>

        <div className="mt-6 grid gap-2 lg:grid-cols-12">
          <div id="top20" className="bg-card scroll-mt-28 rounded-md border p-5 target:bg-muted sm:p-6 lg:col-span-7">
            <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">ТОП-20</p>
            <p className="font-news mt-3 text-5xl leading-none tracking-tight sm:text-7xl">{top20.price}</p>
            <p className={`mt-4 text-lg font-medium tabular-nums ${toneClass(top20.pct)}`}>
              {top20.move}
              <span className="mx-2 text-muted-foreground">·</span>
              {top20.pct > 0 ? "+" : ""}
              {top20.pct}%
            </p>
            <dl className="mt-6 grid grid-cols-3 gap-3 border-t pt-4">
              <div>
                <dt className="text-muted-foreground text-[10px] tracking-[0.14em] uppercase">Сар</dt>
                <dd className="font-news mt-1 text-xl leading-none">{top20.month}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-[10px] tracking-[0.14em] uppercase">Жил</dt>
                <dd className="font-news mt-1 text-xl leading-none">{top20.year}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-[10px] tracking-[0.14em] uppercase">Дээд</dt>
                <dd className="font-news mt-1 text-xl leading-none">{top20.high}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
              Сар, жил:{" "}
              <a className="underline" href={top20.monthHref}>
                {top20.monthSource}
              </a>
              . Дээд цэг {top20.highWhen}. {top20.source}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:col-span-5">
            {mongoliaIndices.map((quote) => (
              <article
                key={quote.id}
                id={quote.id}
                className="bg-card scroll-mt-28 flex flex-col rounded-md border p-3 target:bg-muted sm:p-4"
              >
                <p className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">{quote.label}</p>
                <p className="font-news mt-3 text-2xl leading-none sm:text-3xl">{quote.price}</p>
                {quote.unit ? <p className="text-muted-foreground mt-1 text-xs">{quote.unit}</p> : null}
                <p className={`mt-auto pt-3 text-sm tabular-nums ${toneClass(quote.pct)}`}>{quote.move}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="bg-card mt-2 overflow-hidden rounded-md border">
          <p className="text-muted-foreground border-b px-4 py-2 text-[11px] tracking-[0.16em] uppercase">
            Баасан гарагийн арилжаа
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {sessionStats.map((item, index) => (
              <div
                key={item.label}
                className={`px-4 py-4 ${index % 2 === 1 ? "border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""} ${index > 0 ? "sm:border-l" : ""}`}
              >
                <dt className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">{item.label}</dt>
                <dd className="font-news mt-2 text-2xl leading-none sm:text-3xl">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-muted-foreground mt-4 text-xs">
          <Link to="/story/mse-friday-close" className="underline">
            Баасан гарагийн тойм
          </Link>
          <span> · </span>
          <a className="underline" href={top20.href}>
            МХБ-ийн тайлан
          </a>
        </p>
      </div>
    </section>
  )
}
