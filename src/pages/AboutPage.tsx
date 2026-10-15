import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"
import { ArrowUpRight, Globe, Mail, PlayCircle, Share2 } from "lucide-react"
import { FaFacebookF, FaInstagram, FaLink, FaTelegram, FaXTwitter, FaYoutube } from "react-icons/fa6"
import { SiSubstack } from "react-icons/si"
import { Link } from "react-router-dom"
import { cn } from "cn"

import { channels } from "@/content/channels"
import {
  ArticleMock,
  BrandVisual,
  BrowserFrame,
  CodeVisual,
  Corners,
  HomeMock,
  LetterMock,
  MarketingVisual,
  PosterTemplatesVisual,
  SocialMock,
  SponsoredMock,
  VideoMock,
} from "@/components/site/about-visuals"

/*
 * "Бид": EZ Эдийн засаг and its ad space. Advertisers can appear on
 * ediinzasag.mn, in the weekly «Нийтлэл» letter, in EZ Talk and on EZ's social channels;
 * the page shows where, how it works, and the newsroom rule that ads are
 * labelled and never touch the reporting. Layout after Watermelon UI's
 * landing-01 (MIT): frame lines with crosshairs, corner-bracket cards and "//"
 * eyebrows, monochrome so the hero film carries the only colour.
 */

const channelsList = [
  { label: "YouTube", href: channels.youtube, icon: FaYoutube },
  { label: "Substack", href: channels.substack, icon: SiSubstack },
  { label: "Telegram", href: channels.telegram, icon: FaTelegram },
  { label: "Facebook", href: channels.facebook, icon: FaFacebookF },
  { label: "Instagram", href: channels.instagram, icon: FaInstagram },
  { label: "X", href: channels.x, icon: FaXTwitter },
  { label: "Linktree", href: channels.linktree, icon: FaLink },
  { label: "EZ Talk", to: "/ez-talk" },
] as const

/** The newsroom's own standards (linked from the footer as "Редакцын зарчим"). */
const facts = [
  ["Тойм", "Монголын эдийн засаг, дэлхийн зах зээл нэг тавцан дээр."],
  ["Тоо", "Тоо бүрт огноо, нэрлэсэн эх сурвалж. Гэрээний нарийн хувь, албан бус ишлэлийг зохиодоггүй."],
  ["Зар", "Зар, ивээн тэтгэсэн материал тусгай тэмдэглэгээтэй гарна. Редакцын мэдээ, тоо зарын нөлөөнд ордоггүй."],
  ["EZ Talk", "Эдийн засагч Nio, зах зээлийн шинжээч Ulemj. Дугаар эхлээд YouTube дээр гарна."],
  ["Нийтлэл", "Долоо хоногийн нийтлэл энэ сайт дээр уншигдана. Захиалга Substack дээр баталгаажна."],
] as const

const placements = [
  { title: "Нүүр хуудасны баннер", body: "Сайтын нүүр хуудсанд, өдрийн мэдээний дээр.", visual: "home" },
  { title: "Нийтлэл доторх зар", body: "Мэдээ, тоймын текст дунд, уншигч анхаарлаа хандуулж буй хэсэгт.", visual: "article" },
  { title: "Ивээн тэтгэсэн нийтлэл", body: "Брэндийн түүх нийтлэл хэлбэрээр, «Ивээн тэтгэсэн» гэж тодорхой тэмдэглэнэ.", visual: "sponsored" },
  { title: "Долоо хоногийн нийтлэл", body: "Нийтлэлийн ивээн тэтгэгч болж, захиалагчдын имэйлд шууд очно.", visual: "letter" },
  { title: "EZ Talk", body: "Видео подкастын эхэнд ивээн тэтгэгчийн мэндчилгээ.", visual: "video" },
  { title: "Сошиал пост", body: "Facebook, Instagram, Telegram, X сувгуудад брэндийн пост.", visual: "social" },
] as const

const steps = [
  ["Ярилцах", "Зорилго, хугацааг хамтдаа тодорхойлно."],
  ["Байршил сонгох", "Тохирох байршил, сувгийг хамтдаа сонгоно."],
  ["Материал", "Баннер, нийтлэл, видеог та бэлдэж болно, эсвэл бид хийж өгнө."],
  ["Нийтлэх", "Тохирсон хугацаанд зар тань гарна."],
] as const

const ease = [0.16, 1, 0.3, 1] as const

const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }
const rise: Variants = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } } }

/** A plus-shaped mark where two frame lines cross. */
function Crosshair({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute hidden size-4 lg:block", className)}>
      <span className="bg-foreground/25 absolute inset-x-0 top-1/2 h-px" />
      <span className="bg-foreground/25 absolute inset-y-0 left-1/2 w-px" />
    </span>
  )
}

/** Vertical frame lines with crosshairs at the top edge of a section. */
function Frame() {
  return (
    <>
      <span aria-hidden="true" className="bg-foreground/[0.07] pointer-events-none absolute inset-y-0 left-8 hidden w-px md:left-16 lg:block" />
      <span aria-hidden="true" className="bg-foreground/[0.07] pointer-events-none absolute inset-y-0 right-8 hidden w-px md:right-16 lg:block" />
      <Crosshair className="top-0 left-8 -translate-x-1/2 -translate-y-1/2 md:left-16" />
      <Crosshair className="top-0 right-8 translate-x-1/2 -translate-y-1/2 md:right-16" />
    </>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground inline-flex items-center font-mono text-[11px] font-bold tracking-[0.2em] uppercase">
      <span className="mr-3 opacity-60">{"//"}</span>
      {children}
    </p>
  )
}

const dots = "bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--foreground)_9%,transparent)_1px,transparent_1px)] bg-size-[24px_24px]"

/** "00:00:03:12" (hours, minutes, seconds, frames at 30 fps) for the viewfinder. */
function timecode(seconds: number) {
  const frames = Math.floor((seconds % 1) * 30)
  const whole = Math.floor(seconds)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)}:${pad(frames)}`
}

/** Big L-shaped viewfinder brackets in the four corners of the hero. */
function Viewfinder() {
  const arm = "pointer-events-none absolute size-8 border-foreground/40 sm:size-12"
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-4 sm:inset-8 lg:inset-12">
      <span className={cn(arm, "top-0 left-0 border-t-2 border-l-2")} />
      <span className={cn(arm, "top-0 right-0 border-t-2 border-r-2")} />
      <span className={cn(arm, "bottom-0 left-0 border-b-2 border-l-2")} />
      <span className={cn(arm, "right-0 bottom-0 border-r-2 border-b-2")} />
    </div>
  )
}

function Hero() {
  const still = useReducedMotion()
  const [time, setTime] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const section = useRef<HTMLElement>(null)

  // The viewfinder's timecode follows the video.
  useEffect(() => {
    const timer = setInterval(() => setTime(video.current?.currentTime ?? 0), 100)
    return () => clearInterval(timer)
  }, [])

  /** A soft light follows the pointer (CSS variables, so React doesn't re-render). */
  function follow(event: React.PointerEvent<HTMLElement>) {
    if (still || event.pointerType !== "mouse" || !section.current) return
    const box = section.current.getBoundingClientRect()
    section.current.style.setProperty("--spot-x", `${event.clientX - box.left}px`)
    section.current.style.setProperty("--spot-y", `${event.clientY - box.top}px`)
  }

  return (
    // Always dark: the film behind it is black.
    <section
      ref={section}
      onPointerMove={follow}
      className="dark bg-background text-foreground relative flex h-[calc(100svh-3.5rem)] max-h-[1000px] min-h-[600px] flex-col overflow-hidden border-b [--spot-x:50%] [--spot-y:45%]"
    >
      {/* The film: two hands reaching for the EZ mark, played forward then back so it loops without a cut. */}
      <video
        ref={video}
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src={`${import.meta.env.BASE_URL}media/ez-hero.mp4`}
        poster={`${import.meta.env.BASE_URL}media/ez-hero.jpg`}
        autoPlay={!still}
        muted
        loop
        playsInline
        preload="auto"
      />
      {/* Keep the mark clear in the middle; darken the edges, the top (headline) and the bottom (buttons). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_42%_36%_at_50%_50%,transparent_0%,color-mix(in_oklch,var(--background)_55%,transparent)_70%,var(--background)_100%)]" />
      <div aria-hidden="true" className="from-background/90 pointer-events-none absolute inset-x-0 top-0 h-[36%] bg-gradient-to-b to-transparent" />
      <div aria-hidden="true" className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block bg-[radial-gradient(240px_circle_at_var(--spot-x)_var(--spot-y),color-mix(in_oklch,var(--foreground)_7%,transparent),transparent_70%)]" />
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 opacity-50", dots)} />

      <Viewfinder />
      <div aria-hidden="true" className="text-foreground/55 pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between px-10 pt-2.5 font-mono text-[10px] tracking-[0.2em] uppercase sm:inset-x-8 sm:top-8 sm:px-14 lg:inset-x-12 lg:top-12">
        <span>EZ · {channels.domain}</span>
        <span className="hidden sm:block">Улаанбаатар · 47.92°N 106.92°E</span>
      </div>
      <div aria-hidden="true" className="text-foreground/55 pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between px-10 pb-2.5 font-mono text-[10px] tracking-[0.2em] uppercase tabular-nums sm:inset-x-8 sm:bottom-8 sm:px-14 lg:inset-x-12 lg:bottom-12">
        <span>{timecode(time)}</span>
        <span className="hidden sm:block">Зарын байршил</span>
      </div>

      {/* Headline above the mark, the buttons below it. */}
      <motion.div
        className="relative z-10 flex flex-1 flex-col items-center justify-between px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-24 sm:pb-28"
        variants={stagger}
        initial={still ? false : "hidden"}
        animate="visible"
      >
        <motion.h1 variants={rise} className="font-news text-[2.6rem] leading-[0.95] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] sm:text-6xl lg:text-7xl">
          Таны брэнд, EZ дээр.
        </motion.h1>

        <div className="flex flex-col items-center">
          <motion.p variants={rise} className="text-foreground/75 text-[15px] sm:text-base">
            ediinzasag.mn, нийтлэл, EZ Talk дахь зарын байршил.
          </motion.p>
          <motion.div variants={rise} className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href={channels.telegram}
              target="_blank"
              rel="noreferrer"
              className="group bg-foreground text-background hover:bg-foreground/90 inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-semibold transition active:scale-[0.97]"
            >
              Зар байршуулах
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a href="#placements" className="bg-background/40 hover:bg-foreground/10 inline-flex items-center justify-center border px-7 py-3 text-sm font-semibold backdrop-blur-sm transition active:scale-[0.97]">
              Байршлууд
            </a>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

function PlacementVisual({ name }: { name: (typeof placements)[number]["visual"] }) {
  if (name === "home") return <BrowserFrame url="ediinzasag.mn"><HomeMock /></BrowserFrame>
  if (name === "article") return <BrowserFrame url="ediinzasag.mn/story"><ArticleMock /></BrowserFrame>
  if (name === "sponsored") return <BrowserFrame url="ediinzasag.mn/story"><SponsoredMock /></BrowserFrame>
  if (name === "letter") return <BrowserFrame url="Нийтлэл · имэйл"><LetterMock /></BrowserFrame>
  if (name === "video") return <BrowserFrame url="youtube.com · EZ Talk"><VideoMock /></BrowserFrame>
  return (
    <div className="mx-auto w-1/2">
      <SocialMock />
    </div>
  )
}

/** Every placement in a numbered list; the chosen one is drawn large beside it. Cycles on its own until someone picks one. */
function Placements() {
  const still = useReducedMotion()
  const [active, setActive] = useState(0)
  const [picked, setPicked] = useState(false)

  useEffect(() => {
    if (still || picked) return
    const timer = setInterval(() => setActive((index) => (index + 1) % placements.length), 4200)
    return () => clearInterval(timer)
  }, [still, picked])

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  const choose = (index: number) => {
    clearTimeout(hoverTimer.current)
    setActive(index)
    setPicked(true)
  }
  const hover = (index: number) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => choose(index), 120)
  }

  return (
    <section id="placements" className="relative scroll-mt-24 border-b py-20 md:py-28">
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", dots)} />
      <Frame />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Eyebrow>Зарын байршил</Eyebrow>
        <h2 className="font-news mt-5 text-4xl leading-[1.02] tracking-tight text-balance sm:text-5xl">Зар тань хаана гарах вэ</h2>

        <div className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <ol className="bg-border grid gap-px overflow-hidden border lg:h-[480px] lg:grid-rows-6" role="tablist" aria-label="Зарын байршил">
            {placements.map((placement, index) => {
              const on = index === active
              return (
                <li key={placement.title} className="bg-card">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="placement-view"
                    onClick={() => choose(index)}
                    onMouseEnter={() => hover(index)}
                    onMouseLeave={() => clearTimeout(hoverTimer.current)}
                    onFocus={() => choose(index)}
                    className={cn("relative flex h-full w-full items-center gap-4 px-5 py-3.5 text-left transition-colors duration-300", on ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.04]")}
                  >
                    <span className={cn("absolute inset-y-0 left-0 w-0.5 transition-colors", on ? "bg-foreground" : "bg-transparent")} aria-hidden="true" />
                    <span className={cn("pt-0.5 font-mono text-[11px] font-bold tabular-nums transition-colors", on ? "text-foreground" : "text-foreground/30")}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-mono text-[13px] font-bold tracking-[0.14em] uppercase transition-colors", on ? "text-foreground" : "text-foreground/70")}>{placement.title}</span>
                      <span className={cn("text-muted-foreground mt-1 line-clamp-2 h-[2.6em] text-[13px] leading-[1.3] transition-opacity duration-300", on ? "opacity-100" : "opacity-45")}>
                        {placement.body}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div id="placement-view" role="tabpanel" aria-label={placements[active].title} className="bg-card relative grid h-[340px] place-items-center overflow-hidden border p-6 sm:h-[420px] sm:p-10 lg:h-[480px]">
            <Corners />
            <span className="text-foreground/40 absolute top-4 left-5 font-mono text-[10px] font-bold tracking-[0.2em] uppercase">
              {String(active + 1).padStart(2, "0")} / {String(placements.length).padStart(2, "0")}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={placements[active].visual}
                aria-hidden="true"
                className="w-full max-w-[17rem] sm:max-w-sm lg:max-w-md"
                initial={still ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={still ? undefined : { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.18 } }}
                transition={{ duration: 0.45, ease }}
              >
                <PlacementVisual name={placements[active].visual} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

/** What EZ readers come for: the site's own desks and topics. */
const interests = ["Монголын эдийн засаг", "Ханш, зах зээл", "Уул уурхай", "Төсөв, татвар", "Банк, хүү", "Дэлхийн эдийн засаг", "Технологи", "Хөрөнгө оруулалт"]

/** The channels one campaign runs across. */
const touchpoints = [
  { title: "Сайт", body: "Өдөр бүрийн мэдээ, тойм, ханшийн самбар.", to: "/", icon: Globe },
  { title: "Нийтлэл", body: "Долоо хоногийн тойм, захиалагчдын имэйлд.", to: "/newsletter", icon: Mail },
  { title: "EZ Talk", body: "Nio, Ulemj нарын видео подкаст, YouTube дээр.", to: "/ez-talk", icon: PlayCircle },
  { title: "Сошиал", body: "Facebook, Instagram, Telegram, X сувгууд.", icon: Share2 },
] as const

/** Readers on the left, the four channels as a numbered list on the right (same hover as the placements list). */
function Audience() {
  return (
    <section className="bg-muted/40 relative border-b py-20 md:py-28">
      <Frame />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col">
          <Eyebrow>Хэнд хүрэх вэ</Eyebrow>
          <h2 className="font-news mt-5 text-4xl leading-[1.02] tracking-tight text-balance sm:text-5xl">
            Эдийн засгийг ойлгохыг хүсдэг уншигч.
          </h2>
          <p className="text-muted-foreground mt-6 max-w-md text-base leading-7">
            Өрхийн орлого, төсөв, уурхай, хүүг хамт хардаг. Мэдээг тоо, эх сурвалжтай нь уншдаг тул зар тань итгэл төрүүлэх орчинд гарна.
          </p>

          <div className="mt-auto pt-10">
            <p className="text-muted-foreground font-mono text-[11px] font-bold tracking-[0.2em] uppercase">Уншигчийн сонирхол</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 border-t">
              {interests.map((topic) => (
                <li key={topic} className="border-b py-2.5 text-[15px]">
                  {topic}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <p className="text-muted-foreground font-mono text-[11px] font-bold tracking-[0.2em] uppercase lg:mt-[0.15rem]">Нэг зар, дөрвөн суваг</p>
          <ol className="bg-border mt-5 grid gap-px overflow-hidden border">
            {touchpoints.map((point, index) => {
              const Icon = point.icon
              const body = (
                <>
                  <span aria-hidden="true" className="bg-foreground absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100" />
                  <span className="text-foreground/30 group-hover:text-foreground font-mono text-[11px] font-bold tabular-nums transition-colors duration-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[13px] font-bold tracking-[0.14em] uppercase">{point.title}</span>
                    <span className="text-muted-foreground mt-1 block text-[13px] leading-snug">{point.body}</span>
                  </span>
                  <span className="text-foreground/60 group-hover:border-foreground/40 group-hover:text-foreground grid size-10 shrink-0 place-items-center border transition-colors duration-300">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  {"to" in point ? (
                    <ArrowUpRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden="true" />
                  )}
                </>
              )
              const row = "group bg-card hover:bg-foreground/[0.05] relative flex h-24 items-center gap-5 px-5 transition-colors duration-300"
              return (
                <li key={point.title}>
                  {"to" in point ? (
                    <Link to={point.to} className={row}>
                      {body}
                    </Link>
                  ) : (
                    <div className={row}>{body}</div>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">Баннер, нийтлэлийн ивээн тэтгэгч, EZ Talk-ийн мэндчилгээ, сошиал постыг нэг багцаар хослуулж болно.</p>
        </div>
      </div>
    </section>
  )
}

function Process() {
  const still = useReducedMotion()
  return (
    <section className="relative border-b py-20 md:py-28">
      <Frame />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Eyebrow>Хэрхэн байршуулах вэ</Eyebrow>
        <h2 className="font-news mt-5 max-w-2xl text-4xl leading-[1.02] tracking-tight text-balance sm:text-5xl">Дөрвөн алхам</h2>
        <motion.ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={stagger} initial={still ? false : "hidden"} whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
          {steps.map(([title, body], index) => (
            <motion.li key={title} variants={rise} className="bg-card relative border p-6 sm:p-8">
              <Corners />
              <span className="text-foreground/30 font-mono text-4xl font-bold tabular-nums lg:text-5xl">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-5 font-mono text-sm font-bold tracking-[0.14em] uppercase">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  )
}

const services = [
  { title: "Маркетинг", body: "Сошиал сувгийн хөтлөлт, зар сурталчилгааны кампанит ажил, контент төлөвлөгөө.", visual: MarketingVisual },
  { title: "Вэб хөгжүүлэлт", body: "Танилцуулга сайт, онлайн дэлгүүр, админ самбартай вэб апп. ediinzasag.mn-ийг бүтээсэн баг.", visual: CodeVisual },
  { title: "Брэндинг", body: "Лого, өнгө, фонт, брэндийн гарын авлага.", visual: BrandVisual },
  { title: "Постер загвар", body: "Сошиал пост, баннерын бэлэн загвар. Брэндийн өнгөөр, дахин ашиглахад бэлэн.", visual: PosterTemplatesVisual },
] as const

function Services() {
  const still = useReducedMotion()
  return (
    <section id="services" className="relative scroll-mt-24 border-b py-20 md:py-28">
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", dots)} />
      <Frame />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <Eyebrow>Нэмэлт үйлчилгээ</Eyebrow>
            <h2 className="font-news mt-5 text-4xl leading-[1.02] tracking-tight text-balance sm:text-5xl">Зараас гадна</h2>
          </div>
          <p className="text-muted-foreground max-w-lg text-base leading-7">Брэндээ өсгөхөд хэрэгтэй бусад ажлыг бид хийж өгнө. Зарын багцтай хамт эсвэл тусад нь.</p>
        </div>
        <motion.ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={stagger} initial={still ? false : "hidden"} whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
          {services.map(({ title, body, visual: Visual }) => (
            <motion.li key={title} variants={rise} className="group bg-card relative flex flex-col gap-6 border p-6 transition-colors hover:bg-foreground/[0.03]">
              <Corners />
              <div aria-hidden="true" className="bg-muted/60 flex h-32 items-center rounded-md p-4 transition-transform duration-500 group-hover:-translate-y-0.5">
                <div className="w-full">
                  <Visual />
                </div>
              </div>
              <div>
                <h3 className="font-mono text-[13px] font-bold tracking-[0.14em] uppercase">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}

export function AboutPage() {
  return (
    <div>
      <Hero />
      <Placements />
      <Audience />
      <Process />
      <Services />

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <section id="partner" className="bg-ink text-ink-foreground relative flex scroll-mt-24 flex-col justify-between p-6 sm:p-8">
            <Corners className="border-ink-foreground/50" />
            <div>
              <p className="inline-flex items-center font-mono text-[11px] font-bold tracking-[0.2em] uppercase opacity-70">
                <span className="mr-3 opacity-60">{"//"}</span>
                Зар байршуулах
              </p>
              <h2 className="font-news mt-4 text-4xl leading-tight">Байршил, үйлчилгээ, үнэ.</h2>
              <ul className="mt-5 flex flex-wrap gap-2">
                {["Баннер", "Ивээн тэтгэсэн нийтлэл", "Долоо хоногийн нийтлэл", "EZ Talk", "Сошиал", "Маркетинг", "Вэб", "Брэндинг"].map((topic) => (
                  <li key={topic} className="border-ink-foreground/25 border px-3 py-1 font-mono text-[11px] tracking-wide uppercase">
                    {topic}
                  </li>
                ))}
              </ul>
              <p className="text-ink-foreground/75 mt-4 max-w-md text-sm leading-relaxed">Үнэ нь байршил, хугацаа, ажлын хэмжээнээс хамаарна. Telegram дээр тохирно.</p>
            </div>
            <a
              href={channels.telegram}
              target="_blank"
              rel="noreferrer"
              className="bg-ink-foreground text-ink hover:bg-ink-foreground/90 mt-8 inline-flex w-fit items-center gap-2 px-6 py-2.5 text-sm font-semibold transition active:scale-[0.97]"
            >
              Зар байршуулах
              <ArrowUpRight className="size-4" />
            </a>
          </section>

          <section id="contact" className="bg-card relative flex scroll-mt-24 flex-col justify-between border p-6 sm:p-8">
            <Corners />
            <div>
              <Eyebrow>Холбоо барих</Eyebrow>
              <h2 className="font-news mt-4 text-4xl leading-tight">Шууд шугам Telegram.</h2>
              <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
                Зар, үйлчилгээ, асуулт, засвар, дугаарын санал. Имэйл хаяг нийтлээгүй. Эхлээд Telegram, бусад сувгаар бас хүрдэг.
              </p>
            </div>
            <a
              href={channels.telegram}
              target="_blank"
              rel="noreferrer"
              className="bg-foreground text-background hover:bg-foreground/90 mt-8 inline-flex w-fit items-center gap-2 px-6 py-2.5 text-sm font-semibold transition active:scale-[0.97]"
            >
              <FaTelegram />
              Telegram нээх
            </a>
          </section>
        </div>

        <dl id="standards" className="mt-4 grid scroll-mt-24 gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {facts.map(([title, body]) => (
            <div key={title} className="bg-card p-5">
              <dt className="font-mono text-[11px] font-bold tracking-[0.18em] uppercase">{title}</dt>
              <dd className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-4 grid gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {channelsList.map((item) => {
            const Icon = "icon" in item ? item.icon : null
            const className = "flex h-full items-center justify-between gap-3 bg-card px-5 py-4 text-sm transition-colors hover:bg-foreground/[0.05]"
            const body = (
              <>
                <span className="inline-flex items-center gap-3">
                  {Icon ? <Icon className="size-4" aria-hidden="true" /> : <span className="size-4" aria-hidden="true" />}
                  {item.label}
                </span>
                <span className="text-muted-foreground">Нээх</span>
              </>
            )
            return (
              <li key={item.label}>
                {"to" in item ? (
                  <Link to={item.to} className={className}>
                    {body}
                  </Link>
                ) : (
                  <a href={item.href} target="_blank" rel="noreferrer" className={className}>
                    {body}
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
