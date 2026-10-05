import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react"

import { signedPct } from "@/components/site/market-marks"
import { formatMove, formatValue } from "@/components/site/money"
import type { HeroSlide } from "@/content/hero"
import { commodities, sessionLabel, top20 } from "@/content/markets"

const HOLD_MS = 7000
const pulseIds = ["gold", "brent", "copper"]

/** Tones for text on the --ink surface, which inverts per theme. */
function inkTone(pct: number) {
  if (pct > 0) return "text-emerald-400 dark:text-emerald-700"
  if (pct < 0) return "text-red-400 dark:text-red-700"
  return "text-ink-foreground/60"
}

export function HeroShowcase({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const startX = useRef<number | null>(null)
  const dragged = useRef(false)
  const remaining = useRef(HOLD_MS)
  const startedAt = useRef(0)
  const count = slides.length
  const slide = slides[index]

  // A new slide gets the full hold time. Declared before the timer effect so it runs first.
  useEffect(() => {
    remaining.current = HOLD_MS
  }, [index])

  // Autoplay with pause/resume that keeps the time already spent on the slide.
  useEffect(() => {
    if (paused || count < 2) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    startedAt.current = performance.now()
    const id = window.setTimeout(() => setIndex((current) => (current + 1) % count), remaining.current)
    return () => {
      window.clearTimeout(id)
      remaining.current -= performance.now() - startedAt.current
    }
  }, [index, paused, count])

  if (!slide) return null

  function go(next: number) {
    setIndex((next + count) % count)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowRight") go(index + 1)
    if (event.key === "ArrowLeft") go(index - 1)
  }

  const playState = paused ? "paused" : "running"
  const isPartner = slide.kind === "partner"

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Онцлох"
      className="grid gap-3 lg:h-[clamp(38rem,calc(100svh-8rem),48rem)] lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
      onKeyDown={onKeyDown}
    >
      <h1 className="sr-only">EZ Эдийн засаг. Монголын эдийн засаг, дэлхийн зах зээлийн тойм.</h1>

      {/* Stage */}
      <div
        className="bg-ink relative h-[34rem] touch-pan-y overflow-hidden rounded-xl select-none sm:h-[40rem] lg:h-full"
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
        {/* Visual layers, cross-faded */}
        {slides.map((item, itemIndex) => (
          <SlideVisual key={item.id} slide={item} active={itemIndex === index} playState={playState} />
        ))}

        {/* Progress segments */}
        <div className="absolute inset-x-5 top-5 z-10 flex gap-1.5 sm:inset-x-8 sm:top-6 lg:inset-x-12 lg:top-8">
          {slides.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={`${itemIndex + 1}. ${item.tab}`}
              aria-current={itemIndex === index ? "true" : undefined}
              onClick={() => go(itemIndex)}
              className="group flex h-5 flex-1 items-center"
            >
              <span
                className={`relative block h-[3px] w-full overflow-hidden rounded-full ${isPartner ? "bg-brand-foreground/20" : "bg-photo-foreground/25"}`}
              >
                {itemIndex < index ? (
                  <span className={`absolute inset-0 ${isPartner ? "bg-brand-foreground/70" : "bg-photo-foreground/80"}`} />
                ) : null}
                {itemIndex === index ? (
                  <span
                    key={`${item.id}-${index}`}
                    className={`ez-hero-progress absolute inset-0 ${isPartner ? "bg-brand-foreground" : "bg-brand"}`}
                    style={{ animationDuration: `${HOLD_MS}ms`, animationPlayState: playState }}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>

        {/* Counter */}
        <p
          className={`font-news absolute top-12 right-5 z-10 text-base tabular-nums sm:top-14 sm:right-8 lg:top-16 lg:right-12 ${isPartner ? "text-brand-foreground/70" : "text-photo-foreground/75"}`}
        >
          {String(index + 1).padStart(2, "0")}
          <span className="mx-1 opacity-50">/</span>
          {String(count).padStart(2, "0")}
        </p>

        {/* Copy */}
        <div
          key={slide.id}
          className={`ez-hero-copy absolute inset-x-0 bottom-0 z-10 px-5 pb-7 sm:px-8 sm:pb-10 lg:px-12 lg:pb-12 ${isPartner ? "text-brand-foreground" : "text-photo-foreground"}`}
          aria-live={paused ? "polite" : "off"}
        >
          <p
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] tracking-[0.16em] uppercase backdrop-blur-sm ${isPartner ? "bg-brand-foreground/10" : "bg-black/30"}`}
          >
            <span className={`size-1.5 rounded-full ${isPartner ? "bg-brand-foreground" : "bg-brand"}`} />
            {slide.kicker}
          </p>
          <h2
            className={`font-news mt-4 max-w-4xl leading-[1.04] font-medium text-balance ${isPartner ? "text-4xl sm:text-6xl lg:text-7xl" : "text-[2rem] sm:text-5xl lg:text-6xl xl:text-[4.25rem]"}`}
          >
            <Link
              to={slide.cta.to}
              onClick={(event) => {
                if (!dragged.current) return
                event.preventDefault()
                dragged.current = false
              }}
              className="focus-visible:underline focus-visible:outline-none"
            >
              {slide.title}
            </Link>
          </h2>
          {slide.dek ? (
            <p
              className={`mt-4 hidden max-w-2xl text-base leading-relaxed sm:line-clamp-2 lg:text-lg ${isPartner ? "text-brand-foreground/80" : "text-photo-foreground/80"}`}
            >
              {slide.dek}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to={slide.cta.to}
              className={`inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium transition-transform hover:-translate-y-0.5 ${isPartner ? "bg-brand-foreground text-brand" : "bg-brand text-brand-foreground"}`}
            >
              {slide.cta.label}
              <ArrowRight className="size-4" />
            </Link>
            {slide.secondary ? (
              <a
                href={slide.secondary.href}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-12 items-center gap-1.5 rounded-full border px-5 text-[15px] font-medium backdrop-blur-sm transition-colors ${isPartner ? "border-brand-foreground/30 hover:bg-brand-foreground/10" : "border-photo-foreground/35 bg-black/15 hover:bg-black/35"}`}
              >
                {slide.secondary.label}
                <ArrowUpRight className="size-4" />
              </a>
            ) : null}
          </div>
        </div>

        {/* Arrows */}
        <div className="absolute right-5 bottom-7 z-10 hidden gap-2 sm:right-8 sm:bottom-10 sm:flex lg:right-12 lg:bottom-12">
          <button
            type="button"
            aria-label="Өмнөх"
            onClick={() => go(index - 1)}
            className={`grid size-12 place-items-center rounded-full border backdrop-blur-sm transition-colors ${isPartner ? "border-brand-foreground/30 text-brand-foreground hover:bg-brand-foreground/10" : "border-photo-foreground/35 bg-black/15 text-photo-foreground hover:bg-black/35"}`}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Дараах"
            onClick={() => go(index + 1)}
            className={`grid size-12 place-items-center rounded-full border backdrop-blur-sm transition-colors ${isPartner ? "border-brand-foreground/30 text-brand-foreground hover:bg-brand-foreground/10" : "border-photo-foreground/35 bg-black/15 text-photo-foreground hover:bg-black/35"}`}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      {/* Side rail */}
      <aside className="flex min-h-0 flex-col gap-3">
        <MarketPulse />
        <ol className="bg-card hidden min-h-0 flex-1 flex-col overflow-hidden rounded-xl border lg:flex">
          {slides.map((item, itemIndex) => {
            const active = itemIndex === index
            return (
              <li key={item.id} className="relative flex min-h-0 flex-1 border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => go(itemIndex)}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center gap-3 px-4 text-left transition-colors ${active ? "bg-muted" : "hover:bg-muted/60"}`}
                >
                  <span
                    className={`font-news w-6 shrink-0 text-lg tabular-nums ${active ? "text-brand-strong" : "text-muted-foreground"}`}
                  >
                    {String(itemIndex + 1).padStart(2, "0")}
                  </span>
                  <SlideThumb slide={item} />
                  <span className="min-w-0">
                    <span className="text-muted-foreground block text-[10px] tracking-[0.14em] uppercase">
                      {item.tab}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-medium">{item.title}</span>
                  </span>
                </button>
                {active ? (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5">
                    <span
                      key={`${item.id}-${index}-rail`}
                      className="ez-hero-progress bg-brand absolute inset-0"
                      style={{ animationDuration: `${HOLD_MS}ms`, animationPlayState: playState }}
                    />
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>
      </aside>
    </section>
  )
}

function SlideVisual({
  slide,
  active,
  playState,
}: {
  slide: HeroSlide
  active: boolean
  playState: "paused" | "running"
}) {
  const [src, setSrc] = useState(slide.image)
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? "opacity-100" : "opacity-0"}`}
    >
      {slide.kind === "partner" || !showImage ? (
        <PartnerArt />
      ) : (
        <>
          <img
            src={src}
            alt={slide.imageAlt ?? ""}
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => {
              if (slide.imageFallback && src !== slide.imageFallback) setSrc(slide.imageFallback)
              else setFailed(true)
            }}
            className={`h-full w-full object-cover ${active ? "ez-hero-zoom" : ""}`}
            style={active ? { animationPlayState: playState } : undefined}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-transparent" />
        </>
      )}
    </div>
  )
}

function SlideThumb({ slide }: { slide: HeroSlide }) {
  const [failed, setFailed] = useState(false)
  const src = slide.imageFallback ?? slide.image
  if (slide.kind === "partner" || !src || failed) {
    return (
      <span className="bg-brand text-brand-foreground font-news grid size-11 shrink-0 place-items-center rounded-md text-sm font-bold">
        EZ
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-11 shrink-0 rounded-md object-cover"
    />
  )
}

/** Typographic visual for the partner slot (and any slide whose photo is missing). */
function PartnerArt() {
  return (
    <div className="bg-brand absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,oklch(1_0_0/0.35),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_0%_100%,oklch(0_0_0/0.22),transparent_70%)]" />
      <svg aria-hidden className="text-brand-foreground/10 absolute -right-6 top-10 h-[115%] w-auto" viewBox="0 0 400 300">
        <polyline
          points="0,240 50,215 90,228 140,170 180,190 230,120 270,140 320,70 360,92 400,30"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <p className="font-news text-brand-foreground/[0.08] absolute -top-6 right-6 text-[12rem] leading-none font-bold sm:text-[18rem]">
        EZ
      </p>
    </div>
  )
}

function MarketPulse() {
  const rows = pulseIds
    .map((id) => commodities.find((quote) => quote.id === id))
    .filter((quote) => quote !== undefined)

  return (
    <Link
      to="/markets"
      className="bg-ink text-ink-foreground group block rounded-xl p-5 transition-transform xl:p-6 hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-foreground/60 text-[10px] tracking-[0.16em] uppercase">ТОП-20 · {sessionLabel.split(" · ")[0]}</p>
        <span className="text-ink-foreground/60 group-hover:text-ink-foreground inline-flex items-center gap-1 text-[11px]">
          Ханш
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="font-news text-[2.6rem] leading-none tracking-tight xl:text-5xl">
          {top20.price}
          <span className="text-ink-foreground/50 ml-1.5 font-sans text-xs tracking-normal">оноо</span>
        </p>
        <p className={`text-sm font-medium tabular-nums ${inkTone(top20.pct)}`}>{signedPct(top20.pct)}</p>
      </div>
      <dl className="border-ink-foreground/15 mt-4 grid grid-cols-3 gap-2 border-t pt-3">
        {rows.map((quote) => (
          <div key={quote.id} className="min-w-0">
            <dt className="text-ink-foreground/60 text-[10px] tracking-[0.12em] uppercase">{quote.label}</dt>
            <dd className="font-news mt-1 truncate text-lg leading-none">{formatValue(quote.price, quote.denom)}</dd>
            <dd className={`mt-1 text-[11px] tabular-nums ${inkTone(quote.pct)}`}>{formatMove(quote.move, quote.denom)}</dd>
          </div>
        ))}
      </dl>
    </Link>
  )
}
