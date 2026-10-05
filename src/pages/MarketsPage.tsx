import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { cn } from "cn"

import { SectionHeader } from "@/components/site/home-sections"
import { signedPct } from "@/components/site/market-marks"
import {
  ChangePill,
  CheckpointChart,
  IndexRanking,
  parseNumber,
  StockExplorer,
  ValueBars,
} from "@/components/site/market-charts"
import { formatMove, formatValue, money, UnitChip } from "@/components/site/money"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { friendlyName, glossary, plain, regions, unitHint } from "@/content/market-guide"
import {
  commodities,
  fridayCloses,
  fridayFlow,
  fx,
  miners,
  mongoliaIndices,
  sessionStats,
  top20,
  worldIndices,
  type Quote,
} from "@/content/markets"

const narrow = "mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8"

const sections = [
  { id: "top20", label: "ТОП-20" },
  { id: "mongolia", label: "Монгол" },
  { id: "world", label: "Дэлхий" },
  { id: "commodities", label: "Түүхий эд" },
  { id: "currency", label: "Валют" },
  { id: "glossary", label: "Тайлбар" },
]

const allQuotes = [...worldIndices, ...commodities, ...fx]
const quote = (id: string) => allQuotes.find((item) => item.id === id)
const regionOf = (id: string) => regions.find((region) => region.ids.includes(id))?.title ?? ""

function Source({ quote: item }: { quote: Quote }) {
  return (
    <p className="text-muted-foreground mt-auto pt-3 text-[11px]">
      {item.asOf} ·{" "}
      {item.href ? (
        <a className="underline" href={item.href}>
          {item.source}
        </a>
      ) : (
        item.source
      )}
    </p>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground -mt-2 mb-6 max-w-2xl leading-relaxed">{children}</p>
}

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
      { rootMargin: "-25% 0px -60% 0px" },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])
  return active
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MarketsPage() {
  const active = useActiveSection()

  return (
    <>
      <h1 className="sr-only">Зах зээл</h1>
      <nav aria-label="Хэсгүүд" className="bg-background/90 sticky top-14 z-30 border-b backdrop-blur-md">
        <div className={`${narrow} flex items-center gap-1`}>
          <div className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={active === section.id ? "location" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-3 text-sm transition-colors",
                  active === section.id
                    ? "border-brand text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {section.label}
              </a>
            ))}
          </div>
          <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">10.02-ны хаалт</span>
        </div>
      </nav>

      <div className={`${narrow} flex flex-col gap-20 pt-8 pb-20`}>
        <div className="flex flex-col gap-4">
          <Snapshot />
          <Top20 />
        </div>
        <Mongolia />
        <World />
        <Commodities />
        <Currency />
        <Glossary />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Snapshot: six numbers, no sentences                                 */
/* ------------------------------------------------------------------ */

function Snapshot() {
  const tiles = [
    { id: "top20", label: "ТОП-20", sub: "Монгол", value: top20.price, unit: "оноо", pct: top20.pct },
    ...["spx", "hsi", "gold", "brent", "copper"].map((id) => {
      const item = quote(id)!
      const isIndex = item.denom.kind === "index"
      return {
        id,
        label: friendlyName[id] ?? item.label,
        sub: isIndex ? regionOf(id) : item.denom.kind === "money" && item.denom.per ? `1 ${item.denom.per}` : "",
        value: isIndex ? item.price : formatValue(item.price, item.denom),
        unit: isIndex ? "оноо" : "",
        pct: item.pct,
      }
    }),
  ]

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
      {tiles.map((tile) => (
        <a
          key={tile.id}
          href={`#${tile.id}`}
          className="bg-card hover:border-foreground/25 flex w-44 shrink-0 flex-col rounded-lg border p-4 transition-colors lg:w-auto"
        >
          <span className="truncate text-sm font-semibold">{tile.label}</span>
          <span className="text-muted-foreground truncate text-[11px]">{tile.sub || "\u00a0"}</span>
          <span className="mt-2 text-xl font-semibold tracking-tight">
            {tile.value}
            {tile.unit ? <span className="text-muted-foreground ml-1 text-[11px] font-normal">{tile.unit}</span> : null}
          </span>
          <span className="mt-2">
            <ChangePill pct={tile.pct} />
          </span>
        </a>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ТОП-20                                                              */
/* ------------------------------------------------------------------ */

function Top20() {
  const price = parseNumber(top20.price)
  const month = parseNumber(top20.month)
  const year = parseNumber(top20.year)
  const high = parseNumber(top20.high)
  const belowHigh = ((high - price) / high) * 100
  // 1,000,000₮ grown by the one-year change, rounded to the nearest 100₮.
  const grown = Math.round((1_000_000 * (1 + year / 100)) / 100) * 100

  const points = [
    { label: "1 жилийн өмнө", value: price / (1 + year / 100), exact: false },
    { label: "1 сарын өмнө", value: price / (1 + month / 100), exact: false },
    { label: "Өмнөх өдөр", value: price - parseNumber(top20.move), exact: true },
    { label: "Өнөөдөр", value: price, exact: true },
  ]

  return (
    <section id="top20" className="bg-card scroll-mt-28 rounded-lg border">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">ТОП-20 индекс</h2>
              <p className="text-muted-foreground text-sm">Монголын хамгийн том 20 компанийн хувьцааны дундаж</p>
            </div>
            <UnitChip denom={{ kind: "index" }} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[2.75rem] font-semibold tracking-tight sm:text-6xl">
              {top20.price}
              <span className="text-muted-foreground ml-2 text-base font-normal tracking-normal">оноо</span>
            </p>
            <ChangePill pct={top20.pct} size="lg" />
          </div>
          <div className="mt-8">
            <CheckpointChart points={points} high={high} />
          </div>
        </div>

        <aside className="flex flex-col gap-3 border-t p-5 sm:p-7 lg:border-t-0 lg:border-l">
          <dl className="grid grid-cols-3 gap-2">
            {[
              ["Өнөөдөр", top20.pct],
              ["1 сард", month],
              ["1 жилд", year],
            ].map(([label, pct]) => (
              <div key={label} className="bg-muted/50 rounded-md p-3">
                <dt className="text-muted-foreground text-[11px]">{label}</dt>
                <dd
                  className={cn(
                    "mt-1 text-[15px] font-semibold whitespace-nowrap sm:text-lg",
                    (pct as number) >= 0 ? "text-[var(--up)]" : "text-[var(--down)]",
                  )}
                >
                  {(pct as number) >= 0 ? "▲" : "▼"} {signedPct(pct as number).replace("-", "−")}
                </dd>
              </div>
            ))}
          </dl>

          <div className="bg-muted/50 rounded-md p-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Түүхэн дээдээс</span>
              <span className="font-semibold">{belowHigh.toFixed(2)}% доогуур</span>
            </div>
            <div className="bg-foreground/10 mt-2 h-2 overflow-hidden rounded-full">
              <div className="bg-brand h-full rounded-full" style={{ width: `${100 - belowHigh}%` }} />
            </div>
            <p className="text-muted-foreground mt-2 text-[11px]">
              Дээд цэг {top20.high} оноо, {top20.highWhen}
            </p>
          </div>

          <div className="bg-ink text-ink-foreground rounded-md p-4">
            <p className="text-ink-foreground/60 text-[11px] tracking-[0.14em] uppercase">Энэ юу гэсэн үг вэ?</p>
            <p className="mt-2 text-sm leading-relaxed">
              1 жилийн өмнө ТОП-20-той яг адил хөдөлсөн <strong>1,000,000₮</strong> одоо ойролцоогоор{" "}
              <strong>{money(grown.toLocaleString("en-US"), "MNT")}</strong> болох байсан.
            </p>
            <p className="text-ink-foreground/50 mt-1 text-[11px]">Жишээ. Шимтгэл, ногдол ашгийг тооцоогүй.</p>
          </div>

          <p className="text-muted-foreground mt-auto text-[11px]">
            1 сар, 1 жил:{" "}
            <a className="underline" href={top20.monthHref}>
              {top20.monthSource}
            </a>{" "}
            · Өнөөдөр:{" "}
            <a className="underline" href={top20.href}>
              МХБ
            </a>
          </p>
        </aside>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Монгол                                                              */
/* ------------------------------------------------------------------ */

function Mongolia() {
  const value = sessionStats.find((item) => item.label === "Үнийн дүн")?.value ?? ""
  const deals = sessionStats.find((item) => item.label === "Хэлцэл")?.value ?? ""
  const securities = sessionStats.find((item) => item.label === "Үнэт цаас")?.value ?? ""
  const cap = mongoliaIndices.find((item) => item.id === "cap")
  const otherIndices = mongoliaIndices.filter((item) => item.denom.kind === "index")

  return (
    <section id="mongolia" className="scroll-mt-28">
      <SectionHeader index="01" kicker="Монголын хөрөнгийн бирж" title="Монголын хувьцаа">
        <UnitChip denom={{ kind: "money", currency: "MNT" }} />
      </SectionHeader>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Арилжааны дүн", value],
          ["Хэлцэл", deals],
          ["Арилжсан компани", securities],
          ["Биржийн үнэлгээ", cap ? formatValue(cap.price, cap.denom) : ""],
        ].map(([label, figure]) => (
          <div key={label} className="bg-card rounded-lg border p-4">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight">{figure}</dd>
          </div>
        ))}
      </dl>

      <StockExplorer rows={fridayCloses} reportHref={top20.href} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="bg-card rounded-lg border p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Хамгийн их арилжаалагдсан</h3>
            <p className="text-muted-foreground text-xs">Нэг өдөрт гар солисон хувьцааны дүн</p>
          </div>
          <div className="mt-4">
            <ValueBars
              rows={fridayFlow.map((row) => ({
                key: row.symbol,
                name: row.name,
                value: row.value,
                weight: parseNumber(row.value),
              }))}
            />
          </div>
          <p className="text-muted-foreground mt-4 text-[11px] leading-relaxed">
            Хаан банк, Худалдаа хөгжлийн банк, Ард санхүүгийн нэгдлийн хаалтын үнэ энэ өдрийн тайланд байхгүй.
          </p>
        </div>
        <div className="grid gap-3">
          {otherIndices.map((item) => (
            <div key={item.id} id={item.id} className="bg-card target:bg-muted flex scroll-mt-28 items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <span>
                <span className="text-muted-foreground block text-xs">
                  {/индекс/i.test(item.label) ? item.label : `${item.label} индекс`}
                </span>
                <span className="mt-0.5 block text-lg font-semibold">
                  {item.price} <span className="text-muted-foreground text-xs font-normal">оноо</span>
                </span>
              </span>
              <ChangePill pct={item.pct} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Дэлхий                                                              */
/* ------------------------------------------------------------------ */

function World() {
  return (
    <section id="world" className="scroll-mt-28">
      <SectionHeader index="02" kicker="Индекс · оноогоор" title="Дэлхийн хувьцаа">
        <UnitChip denom={{ kind: "index" }} />
      </SectionHeader>
      <Lead>Өнөөдрийн өөрчлөлтөөр эрэмбэлэв. Баруун тийш ногоон нь өссөн, зүүн тийш улаан нь буурсан.</Lead>
      <IndexRanking quotes={worldIndices} describe={(id) => plain[id] ?? ""} region={regionOf} />
      <p className="text-muted-foreground mt-4 text-sm">
        Шанхайн сүүлийн арилжаа 2026.09.30. Аравдугаар сарын эхээр Хятадын зах зээл Алтан долоо хоногоор хаалттай байсан.{" "}
        <Link to="/story/world-friday-board" className="underline">
          Дэлгэрэнгүй тойм
        </Link>
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Түүхий эд                                                           */
/* ------------------------------------------------------------------ */

function Commodities() {
  const forMongolia = ["copper", "coal", "gold"]
  const oil = ["brent", "wti"]

  return (
    <section id="commodities" className="scroll-mt-28">
      <SectionHeader index="03" kicker="Ам.доллараар" title="Түүхий эд">
        <UnitChip denom={{ kind: "money", currency: "USD" }} />
      </SectionHeader>
      <Lead>Монголын экспортын орлого, таны шатахууны үнэ эдгээр үнээс хамаардаг. Бүгд ам.доллараар.</Lead>

      <h3 className="text-muted-foreground mb-3 text-[11px] tracking-[0.16em] uppercase">Монголын экспорт</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {forMongolia.map((id) => (
          <CommodityCard key={id} item={quote(id)!} />
        ))}
      </div>

      <h3 className="text-muted-foreground mt-8 mb-3 text-[11px] tracking-[0.16em] uppercase">Нефть</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {oil.map((id) => (
          <CommodityCard key={id} item={quote(id)!} />
        ))}
      </div>

      <div className="bg-muted/50 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
        <p className="text-sm">
          <span className="font-semibold">Зэсийн компаниудын хувьцаа:</span>{" "}
          {miners.map((row, index) => (
            <span key={row.symbol}>
              {index > 0 ? " · " : ""}
              {row.name} <span className="font-semibold tabular-nums">{money(row.price, row.currency)}</span>{" "}
              <span className={row.pct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>
                {row.pct >= 0 ? "▲" : "▼"} {row.move.replace("-", "−")}
              </span>
            </span>
          ))}
        </p>
        <p className="flex gap-4 text-sm">
          <Link to="/story/copper-coal-friday" className="underline">
            Зэс, нүүрсний тойм
          </Link>
          <Link to="/story/gold-friday" className="underline">
            Алтны тойм
          </Link>
        </p>
      </div>
    </section>
  )
}

function CommodityCard({ item }: { item: Quote }) {
  const per = item.denom.kind === "money" ? item.denom.per : undefined
  return (
    <article id={item.id} className="bg-card target:bg-muted flex scroll-mt-28 flex-col rounded-lg border p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-lg font-semibold leading-tight">{friendlyName[item.id] ?? item.label}</h4>
        <UnitChip denom={item.denom} />
      </div>
      <p className="text-muted-foreground mt-2 text-sm leading-snug">{plain[item.id]}</p>
      <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-semibold tracking-tight">{formatValue(item.price, item.denom)}</span>
        {per ? <span className="text-muted-foreground text-sm">/ {per}</span> : null}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <ChangePill pct={item.pct} />
        {/\d/.test(item.move) && !item.move.endsWith("%") ? (
          <span className="text-muted-foreground text-xs tabular-nums">{formatMove(item.move, item.denom)}</span>
        ) : null}
      </div>
      {per && unitHint[per] ? <p className="text-muted-foreground mt-3 text-xs">{unitHint[per]}</p> : null}
      <Source quote={item} />
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Валют                                                               */
/* ------------------------------------------------------------------ */

function Currency() {
  return (
    <section id="currency" className="scroll-mt-28">
      <SectionHeader index="04" kicker="Ханш, хүү" title="Валют ба хүү" />
      <Lead>Гадаад валютын ханш ба дэлхийн зээлийн хүүний жишиг.</Lead>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fx.map((item) => (
          <article key={item.id} id={item.id} className="bg-card target:bg-muted flex scroll-mt-28 flex-col rounded-lg border p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{friendlyName[item.id] ?? item.label}</h3>
              <UnitChip denom={item.denom} />
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-snug">{plain[item.id]}</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight">{formatValue(item.price, item.denom)}</p>
            <div className="mt-3">
              {item.pct === 0 ? (
                <span className="text-muted-foreground text-xs">
                  {/\d/.test(item.move) ? "Өөрчлөлтгүй" : item.move}
                </span>
              ) : (
                <ChangePill pct={item.pct} />
              )}
            </div>
            <Source quote={item} />
          </article>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Тайлбар                                                             */
/* ------------------------------------------------------------------ */

function Glossary() {
  return (
    <section id="glossary" className="scroll-mt-28">
      <SectionHeader index="05" kicker="Ойлгомжтой болгох" title="Үгийн тайлбар" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Accordion type="single" collapsible defaultValue={glossary[0].term} className="bg-card rounded-lg border px-5">
          {glossary.map((item) => (
            <AccordionItem key={item.term} value={item.term}>
              <AccordionTrigger className="py-4 text-[15px]">{item.term}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">{item.text}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <aside className="bg-muted/50 self-start rounded-lg p-5 text-sm leading-relaxed">
          <p className="font-semibold">Анхааруулга</p>
          <p className="text-muted-foreground mt-2">
            Энэ хуудас нийтийн эх сурвалжийн хаалтын үнийг нэгтгэсэн мэдээлэл. Шууд ханш биш, хөрөнгө оруулалтын зөвлөгөө биш.
            Эх сурвалж бүрийг картын доор холбоосоор нь заасан.
          </p>
        </aside>
      </div>
    </section>
  )
}
