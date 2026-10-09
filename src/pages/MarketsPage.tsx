import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { cn } from "cn"

import { SectionHeader } from "@/components/site/home-sections"
import { MarketTerminal } from "@/components/site/MarketTerminal"
import { signedPct } from "@/components/site/market-marks"
import {
  ChangePill,
  CheckpointChart,
  ExportMix,
  IndexRanking,
  parseNumber,
  PerformanceChart,
  StockExplorer,
  ValueBars,
  YieldCurve,
  type PerformanceRow,
} from "@/components/site/market-charts"
import { formatMove, formatValue, money, UnitChip } from "@/components/site/money"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { friendlyName, glossary, plain, regions, unitHint } from "@/content/market-guide"
import {
  commodities,
  exportMix,
  fridayCloses,
  fridayFlow,
  fx,
  miners,
  mongoliaIndices,
  mongoliaMacro,
  sessionShort,
  sessionStats,
  top20,
  usCurve,
  worldIndices,
  type Quote,
} from "@/content/markets"

const narrow = "mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8"

const sections = [
  { id: "chart", label: "Терминал" },
  { id: "top20", label: "ТОП-20" },
  { id: "macro", label: "Макро" },
  { id: "performance", label: "Гүйцэтгэл" },
  { id: "world", label: "Дэлхий" },
  { id: "commodities", label: "Түүхий эд" },
  { id: "mongolia", label: "Монгол хувьцаа" },
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
          <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">{sessionShort}</span>
        </div>
      </nav>

      <div className={`${narrow} flex flex-col gap-16 pt-6 pb-20 sm:gap-20`}>
        {/* The terminal leads; everything below explains the numbers in it. */}
        <MarketTerminal />
        <Top20 />
        <Macro />
        <Performance />
        {/* Wide screens: the two global boards side by side. */}
        <div className="grid gap-16 xl:grid-cols-2 xl:gap-8 [&>*]:min-w-0">
          <World />
          <Commodities />
        </div>
        <Mongolia />
        <Currency />
        <Glossary />
      </div>
    </>
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
            <p className="text-ink-foreground/65 text-[11px] tracking-[0.14em] uppercase">Энэ юу гэсэн үг вэ?</p>
            <p className="mt-2 text-sm leading-relaxed">
              1 жилийн өмнө ТОП-20-той яг адил хөдөлсөн <strong>1,000,000₮</strong> одоо ойролцоогоор{" "}
              <strong>{money(grown.toLocaleString("en-US"), "MNT")}</strong> болох байсан.
            </p>
            <p className="text-ink-foreground/65 mt-1 text-[11px]">Жишээ. Шимтгэл, ногдол ашгийг тооцоогүй.</p>
          </div>

          <p className="text-muted-foreground mt-auto text-[11px]">
            1 сар, 1 жил:{" "}
            <a className="underline" href={top20.monthHref}>
              {top20.monthSource}
            </a>{" "}
            · {top20.asOf}:{" "}
            <a className="underline" href={top20.href}>
              {top20.source}
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
      <SectionHeader index="05" kicker="Монголын хөрөнгийн бирж" title="Монголын хувьцаа">
        <UnitChip denom={{ kind: "money", currency: "MNT" }} />
      </SectionHeader>
      <Lead>
        ТОП-20 индекс {top20.asOf}-ний тоо. Доорх арилжааны дүн, хувьцаа, бусад индекс нь{" "}
        <a className="underline" href={top20.reportHref}>
          {top20.reportLabel}
        </a>
        : биржийн шинэ тайлан уншигдахуйц хэлбэрээр гараагүй байна.
      </Lead>

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

      <StockExplorer rows={fridayCloses} reportHref={top20.reportHref} />

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
      <SectionHeader index="03" kicker="Индекс · оноогоор" title="Дэлхийн хувьцаа">
        <UnitChip denom={{ kind: "index" }} />
      </SectionHeader>
      <Lead>Сүүлийн өдрийн өөрчлөлтөөр эрэмбэлэв. Баруун тийш цэнхэр нь өссөн, зүүн тийш саарал нь буурсан.</Lead>
      <IndexRanking quotes={worldIndices} describe={(id) => plain[id] ?? ""} region={regionOf} />
      <p className="text-muted-foreground mt-4 text-sm">
        АНУ, Европ, Япон, Шанхай: 10.08-ны пүрэв гарагийн хаалт. Hang Seng: 10.09. Чип үйлдвэрлэгчид Nasdaq-ийг 1.25 хувиар
        унагав.{" "}
        <Link to="/story/wall-street-chip-selloff" className="underline">
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
      <SectionHeader index="04" kicker="Ам.доллараар" title="Түүхий эд">
        <UnitChip denom={{ kind: "money", currency: "USD" }} />
      </SectionHeader>
      <Lead>Монголын экспортын орлого, таны шатахууны үнэ эдгээр үнээс хамаардаг. Бүгд ам.доллараар.</Lead>

      <h3 className="text-muted-foreground mb-3 text-[11px] tracking-[0.16em] uppercase">Монголын экспорт</h3>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-2 xl:[&>*:last-child:nth-child(odd)]:col-span-2">
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
          <span className="font-semibold">Зэсийн компаниудын хувьцаа (10.02):</span>{" "}
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
          <Link to="/story/copper-weekly-gain" className="underline">
            Зэсийн тойм
          </Link>
          <Link to="/story/brent-hormuz-october" className="underline">
            Нефтийн тойм
          </Link>
          <Link to="/story/gold-yields-ease" className="underline">
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
      <SectionHeader index="06" kicker="Ханш, хүү" title="Валют ба хүү" />
      <Lead>Төгрөг, гол валютын ханш ба дэлхийн зээлийн хүүний жишиг.</Lead>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  {item.denom.kind === "percent" || !/\d/.test(item.move) ? item.move : "Өөрчлөлтгүй"}
                </span>
              ) : (
                <ChangePill pct={item.pct} />
              )}
            </div>
            <Source quote={item} />
          </article>
        ))}
      </div>

      <div className="bg-card mt-4 grid gap-6 rounded-lg border p-5 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <h3 className="font-semibold">АНУ-ын бондын өгөөжийн муруй</h3>
          <p className="text-muted-foreground text-xs">Хугацаагаар · {usCurve.asOf}</p>
          <div className="mt-4 max-w-[520px]">
            <YieldCurve points={usCurve.points} />
          </div>
        </div>
        <div className="text-sm leading-relaxed">
          <p>
            Урт хугацааны зээл богиноосоо үнэтэй: 30 жилийн өгөөж 2 жилийнхээс{" "}
            <strong className="tabular-nums">
              {(usCurve.points[2].yield - usCurve.points[0].yield).toFixed(2)} нэгжээр
            </strong>{" "}
            өндөр. Хөрөнгө оруулагчид инфляц, төсвийн алдагдлын эрсдэлд нэмэлт хүү шаардаж байна. 10 жилийн өгөөж 10.08-нд{" "}
            {usCurve.high10}% хүрч, 2002 оноос хойших дээд түвшинд гарсан.
          </p>
          <p className="text-muted-foreground mt-3">
            Харьцуулахад Японы 10 жилийн өгөөж {usCurve.japan10.yield}%. Монголын гадаад зээл, бондын хүү АНУ-ын өгөөж дээр
            эрсдэлийн нэмэгдэл нэмж тогтдог.
          </p>
          <p className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <a className="underline" href={usCurve.href}>
              {usCurve.source}
            </a>
            <Link to="/story/treasury-yields-24-year-high" className="underline">
              АНУ-ын өгөөжийн тойм
            </Link>
            <Link to="/story/japan-yields-takaichi" className="underline">
              Японы өгөөжийн тойм
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Макро: Mongolia in four numbers and one bar                         */
/* ------------------------------------------------------------------ */

function Macro() {
  const { inflation, policyRate, reserves } = mongoliaMacro
  const real = policyRate.value - inflation.value
  const usdMnt = fx.find((item) => item.id === "mnt")

  return (
    <section id="macro" className="scroll-mt-28">
      <SectionHeader index="01" kicker="Монголын эдийн засаг" title="Макро самбар" />
      <Lead>Ханш, хувьцааны ард байгаа үндсэн тоонууд. Тус бүр өөрийн огноо, эх сурвалжтай.</Lead>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Инфляц, жилээр</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{inflation.value}%</p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            Зорилт {mongoliaMacro.target} ·{" "}
            <a className="underline" href={inflation.href}>
              {inflation.source}, {inflation.label}
            </a>
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Бодлогын хүү</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{policyRate.value}%</p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            <a className="underline" href={policyRate.href}>
              {policyRate.source}, {policyRate.label}
            </a>
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Бодит хүү (хүү − инфляц)</p>
          <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl", real < 0 ? "text-[var(--down)]" : "text-[var(--up)]")}>
            {real < 0 ? "▼ −" : "▲ +"}
            {Math.abs(real).toFixed(1)} нэгж
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            {real < 0 ? "Хүү инфляцаас доогуур: хадгаламжийн бодит өгөөж хасах." : "Хүү инфляцаас дээгүүр."}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Валютын нөөц</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {reserves.value} <span className="text-muted-foreground text-sm font-normal">тэрбум $</span>
          </p>
          <div className="bg-foreground/10 mt-2 h-1.5 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-brand h-full rounded-full" style={{ width: `${(reserves.value / mongoliaMacro.reservesGoal) * 100}%` }} />
          </div>
          <p className="text-muted-foreground mt-1.5 text-[11px]">
            Урт хугацааны зорилт {mongoliaMacro.reservesGoal} тэрбумын {Math.round((reserves.value / mongoliaMacro.reservesGoal) * 100)}% ·{" "}
            <a className="underline" href={reserves.href}>
              {reserves.source}, {reserves.label}
            </a>
          </p>
        </div>
      </div>

      <div className="bg-card mt-4 rounded-lg border p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Экспорт юунаас бүрдэв</h3>
          <p className="text-muted-foreground text-xs">
            {exportMix.label} · нийт {exportMix.total} тэрбум $ · ▲ {exportMix.growth}% жилээр
          </p>
        </div>
        <div className="mt-4">
          <ExportMix parts={exportMix.parts} total={exportMix.total} />
        </div>
        <p className="text-muted-foreground mt-4 text-[11px] leading-relaxed">
          Зэс, нүүрс хоёр экспортын {Math.round(((exportMix.parts[0].value + exportMix.parts[1].value) / exportMix.total) * 100)}%.
          Тиймээс доорх зэс, нүүрсний үнэ валютын нөөц, төсөвт шууд нөлөөлнө.
          {usdMnt ? ` Төгрөг ам.доллартай ${usdMnt.price} (${usdMnt.asOf}).` : ""} Эх сурвалж:{" "}
          <a className="underline" href={exportMix.href}>
            {exportMix.source}
          </a>
          .{" "}
          <Link to="/story/reserves-record-september" className="underline">
            Нөөцийн тойм
          </Link>
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Гүйцэтгэл: all markets, three time frames                           */
/* ------------------------------------------------------------------ */

const sinceOf = (item: { price: string; prev?: string }) =>
  item.prev ? Math.round(((parseNumber(item.price) - parseNumber(item.prev)) / parseNumber(item.prev)) * 10000) / 100 : undefined

function Performance() {
  const groupOf = (id: string) =>
    commodities.some((item) => item.id === id) ? "Түүхий эд" : fx.some((item) => item.id === id) ? "Валют" : regionOf(id) || "Индекс"
  const rows: PerformanceRow[] = [
    {
      id: "top20",
      label: "ТОП-20",
      group: "Монгол",
      since: sinceOf(top20),
      year: parseNumber(top20.year),
      detail: `10.02: ${top20.prev} → ${top20.price}`,
    },
    ...[...worldIndices, ...commodities, ...fx]
      .filter((item) => item.denom.kind !== "percent")
      .map((item) => ({
        id: item.id,
        label: friendlyName[item.id] ?? item.label,
        group: groupOf(item.id),
        since: sinceOf(item),
        ytd: item.ytd,
        year: item.year,
        detail: item.prev ? `10.02: ${item.prev} → ${item.price}` : undefined,
      })),
  ]

  return (
    <section id="performance" className="scroll-mt-28">
      <SectionHeader index="02" kicker="Харьцуулалт" title="Гүйцэтгэл" />
      <Lead>
        Бүх зах зээл нэг хэмжүүрээр. Хугацаагаа сонгоно уу. Валютын хувьд өсөлт нь ам.доллар чангарсныг (эсвэл евро) илтгэнэ.
      </Lead>
      <PerformanceChart rows={rows} />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Тайлбар                                                             */
/* ------------------------------------------------------------------ */

function Glossary() {
  return (
    <section id="glossary" className="scroll-mt-28">
      <SectionHeader index="07" kicker="Ойлгомжтой болгох" title="Үгийн тайлбар" />
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
