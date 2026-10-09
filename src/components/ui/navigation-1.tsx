import { useEffect, useRef, type MouseEvent } from "react"
import { flushSync } from "react-dom"
import { NavLink } from "react-router-dom"
import {
  ArrowUpRight,
  Mail,
  Menu,
  Moon,
  Sun,
  VenetianMask,
  X,
} from "lucide-react"

import { channels } from "@/content/channels"
import { publicUrl } from "@/lib/public-url"
import { ReaderAvatar } from "@/reader/ReaderAvatar"
import { useReader } from "@/reader/session"
import {
  byDate,
  deskLabel,
  formatStoryDate,
  storiesByDesk,
} from "@/content/stories"
import { Badge } from "@/components/ui/badge"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// Header order: Монгол · Дэлхий · Ханш · Тойм (menu) · EZ Edu · EZ Talk · Бид.
// The first BEFORE_TOIM links come before the Тойм menu on desktop.
const primary = [
  { to: "/mongolia", label: "Монгол" },
  { to: "/world", label: "Дэлхий" },
  { to: "/markets", label: "Ханш" },
  { to: "/ez-edu", label: "EZ Edu" },
  { to: "/ez-talk", label: "EZ Talk" },
  { to: "/about", label: "Бид" },
]
const BEFORE_TOIM = 3

// The current page is the darker word. No underline, and no blue ring on click.
const linkClass =
  "relative bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:bg-transparent hover:text-foreground focus:bg-transparent focus-visible:ring-0 focus-visible:outline-none data-active:bg-transparent aria-[current=page]:text-foreground"

/** Circle reveal from the button. Percentages stay put at 150% display scale. */
function revealTheme(
  event: MouseEvent<HTMLButtonElement>,
  theme: "light" | "dark",
  onThemeChange: (theme: "light" | "dark") => void,
  lock: { current: boolean },
) {
  if (lock.current) return
  const next = theme === "dark" ? "light" : "dark"
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  // The phone switch lives in the menu. Photographing the whole page for the
  // circle stalls that tap, so phones flip the theme immediately.
  const phone = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 1024
  if (reduced || phone || typeof document.startViewTransition !== "function") {
    // Color transitions on the open menu draw bright edges while the theme flips.
    if (phone) document.documentElement.classList.add("ez-theme-swap")
    onThemeChange(next)
    if (phone) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => document.documentElement.classList.remove("ez-theme-swap"))
      })
    }
    return
  }

  const rect = event.currentTarget.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const width = window.innerWidth
  const height = window.innerHeight
  const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
  const at = `${(x / width) * 100}% ${(y / height) * 100}%`
  const end = `${(radius / (Math.hypot(width, height) / Math.SQRT2)) * 100}%`
  const clip = [`circle(0% at ${at})`, `circle(${end} at ${at})`]
  const root = document.documentElement
  root.dataset.ezThemeVt = "active"
  root.style.setProperty("--ez-theme-duration", "400ms")
  root.style.setProperty("--ez-theme-clip-from", clip[0])
  lock.current = true

  const done = () => {
    lock.current = false
    delete root.dataset.ezThemeVt
    root.style.removeProperty("--ez-theme-duration")
    root.style.removeProperty("--ez-theme-clip-from")
  }

  try {
    const transition = document.startViewTransition(() => {
      flushSync(() => onThemeChange(next))
    })
    transition.finished.finally(done)
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: clip },
        {
          duration: 400,
          easing: "ease-in-out",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      )
    }).catch(done)
  } catch {
    lock.current = false
    onThemeChange(next)
    done()
  }
}

function Brand() {
  return (
    <NavLink to="/" className="flex shrink-0 items-center" aria-label="Эдийн засаг">
      <img src={publicUrl("brand/logo-black.png")} alt="" className="h-7 w-auto dark:hidden" />
      <img src={publicUrl("brand/logo-white.png")} alt="" className="hidden h-7 w-auto dark:block" />
    </NavLink>
  )
}

export function Navigation1({
  theme,
  onThemeChange,
}: {
  theme: "light" | "dark"
  onThemeChange: (theme: "light" | "dark") => void
}) {
  const { reader, openLogin } = useReader()
  const themeLock = useRef(false)
  const lead = byDate()[0]
  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.ezSheet
    }
  }, [])
  const mongolia = storiesByDesk("mongolia").slice(0, 3)
  const world = storiesByDesk("world").slice(0, 3)

  return (
    <header className="sticky top-0 z-40 text-foreground">
      <div className="pointer-events-none absolute inset-0 ez-glass border-y border-border bg-background/80" />
      <div className="relative mx-auto flex h-14 w-full max-w-[1520px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center">
          <Brand />
        </div>
        <div className="hidden lg:flex">
            <NavigationMenu viewport={false}>
              <NavigationMenuList className="gap-1">
                {primary.slice(0, BEFORE_TOIM).map((item) => (
                  <NavigationMenuItem key={item.to}>
                    <NavigationMenuLink asChild className={linkClass}>
                      <NavLink to={item.to}>{item.label}</NavLink>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
                <NavigationMenuItem value="toim">
                  <NavigationMenuTrigger className="h-auto bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground outline-none hover:bg-transparent hover:text-foreground focus:bg-transparent focus-visible:ring-0 focus-visible:outline-none data-open:bg-transparent data-open:text-foreground data-popup-open:bg-transparent">
                    Тойм
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="left-1/2 w-max -translate-x-1/2 rounded-lg! border! border-border! ez-glass bg-background/90! p-0! shadow-none! ring-0!">
                    <div className="grid grid-cols-[10.5rem_10.5rem_8.5rem_13rem] gap-5 p-5">
                      <StoryColumn title="Монгол" stories={mongolia} />
                      <StoryColumn title="Дэлхий" stories={world} />
                      <div>
                        <h4 className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                          Сувгууд
                        </h4>
                        <div className="flex flex-col gap-2 text-sm text-foreground/80">
                          <a className="hover:text-foreground" href={channels.youtube}>
                            YouTube
                          </a>
                          <a className="hover:text-foreground" href={channels.substack}>
                            Substack
                          </a>
                          <a className="hover:text-foreground" href={channels.telegram}>
                            Telegram
                          </a>
                          <NavLink className="hover:text-foreground" to="/markets">
                            Ханш
                          </NavLink>
                          <NavLink className="hover:text-foreground" to="/ez-talk">
                            EZ Talk
                          </NavLink>
                          <NavLink className="hover:text-foreground" to="/ez-edu">
                            EZ Edu
                          </NavLink>
                        </div>
                      </div>
                      <div className="border-l border-border pl-6">
                        <Badge variant="secondary" className="mb-3">
                          {deskLabel[lead.desk]}
                        </Badge>
                        <p className="font-news text-lg leading-snug font-medium">
                          {lead.title}
                        </p>
                        <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">{lead.dek}</p>
                        <Button asChild className="mt-4" size="sm">
                          <NavLink to={`/story/${lead.slug}`}>
                            Унших
                            <ArrowUpRight />
                          </NavLink>
                        </Button>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                {primary.slice(BEFORE_TOIM).map((item) => (
                  <NavigationMenuItem key={item.to}>
                    <NavigationMenuLink asChild className={linkClass}>
                      <NavLink to={item.to}>{item.label}</NavLink>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

        <div className="hidden flex-1 items-center justify-end gap-2 lg:flex">
          <a href={channels.youtube} className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
            YouTube
          </a>
          <button
            type="button"
            aria-label={theme === "dark" ? "Гэрэл горим" : "Харанхуй горим"}
            onClick={(event) => revealTheme(event, theme, onThemeChange, themeLock)}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <a
            href={channels.substackSubscribe}
            target="_blank"
            rel="noreferrer"
            className="ez-hit inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground/20 px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            <Mail className="size-3.5" />
            Subscribe
          </a>
          <AccountButton />
        </div>

        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          <AccountButton compact />
          <Sheet
            onOpenChange={(open) => {
              if (open) document.documentElement.dataset.ezSheet = "open"
              else delete document.documentElement.dataset.ezSheet
            }}
          >
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Цэс нээх" className="size-11 text-foreground hover:bg-foreground/5 hover:text-foreground">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              // Opening with a tap should not paint a focus ring on the first button.
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              className="border-border data-[side=right]:w-[min(100%,22rem)] data-[side=right]:max-w-[22rem] ez-glass w-[min(100%,22rem)] max-w-[22rem] gap-0 overflow-y-auto bg-background/85 p-0 shadow-none outline-none focus:outline-none focus-visible:outline-none"
            >
              <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
                <SheetClose asChild>
                  <NavLink to="/" className="flex items-center" aria-label="Эдийн засаг">
                    <img src={publicUrl("brand/logo-black.png")} alt="" className="h-7 w-auto dark:hidden" />
                    <img src={publicUrl("brand/logo-white.png")} alt="" className="hidden h-7 w-auto dark:block" />
                  </NavLink>
                </SheetClose>
                <SheetTitle className="sr-only">Цэс</SheetTitle>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={theme === "dark" ? "Гэрэл горим" : "Харанхуй горим"}
                    onClick={(event) => revealTheme(event, theme, onThemeChange, themeLock)}
                    className="text-muted-foreground hover:text-foreground flex size-11 items-center justify-center outline-none focus:outline-none focus-visible:outline-none"
                  >
                    {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  </button>
                  <SheetClose asChild>
                    <button
                      type="button"
                      aria-label="Цэс хаах"
                      className="text-muted-foreground hover:text-foreground flex size-11 items-center justify-center outline-none focus:outline-none focus-visible:outline-none"
                    >
                      <X className="size-5" />
                    </button>
                  </SheetClose>
                </div>
              </div>

              <nav aria-label="Үндсэн цэс" className="flex flex-col px-2 py-3">
                {[{ to: "/", label: "Нүүр" }, ...primary, { to: "/newsletter", label: "Нийтлэл" }].map((item) => (
                  <SheetClose asChild key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        `flex h-11 items-center justify-between rounded-md px-3 text-[15px] font-medium transition-colors ${isActive ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </SheetClose>
                ))}
              </nav>

              <div className="border-border border-t px-2 py-3">
                <p className="text-muted-foreground px-3 pt-1 pb-1 text-xs tracking-wide uppercase">Сүүлийн тойм</p>
                <div className="flex flex-col">
                  {byDate().slice(0, 5).map((story) => (
                    <SheetClose asChild key={story.slug}>
                      <NavLink
                        to={`/story/${story.slug}`}
                        className="hover:bg-foreground/5 rounded-md px-3 py-2.5 text-[14px] leading-snug text-foreground no-underline"
                      >
                        <span className="text-muted-foreground block font-mono text-xs">
                          {deskLabel[story.desk]} · {formatStoryDate(story.date)}
                        </span>
                        {story.title}
                      </NavLink>
                    </SheetClose>
                  ))}
                </div>
              </div>

              <div className="border-border mt-auto flex flex-col gap-2 border-t p-4">
                <a
                  href={channels.youtube}
                  className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center justify-center gap-1.5 text-[13px] font-medium transition-colors"
                >
                  YouTube
                  <ArrowUpRight className="size-3.5" />
                </a>
                <a
                  href={channels.substackSubscribe}
                  target="_blank"
                  rel="noreferrer"
                  className="border-foreground/20 text-foreground hover:bg-foreground hover:text-background inline-flex h-10 items-center justify-center gap-1.5 rounded-full border text-[13px] font-medium transition-colors"
                >
                  <Mail className="size-3.5" />
                  Subscribe
                </a>
                <SheetClose asChild>
                  {reader ? (
                    <NavLink
                      to="/account"
                      className="border-foreground/20 hover:bg-foreground/5 inline-flex h-10 items-center justify-center gap-2 rounded-full border text-[13px] font-medium transition-colors"
                    >
                      <ReaderAvatar name={reader.name || reader.email || reader.phone} avatar={reader.avatar} size="sm" />
                      {reader.name || "Миний бүртгэл"}
                    </NavLink>
                  ) : (
                    <ShimmerButton type="button" onClick={openLogin} className="h-10 w-full text-[13px] font-medium">
                      Нэвтрэх
                    </ShimmerButton>
                  )}
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

/**
 * The header's main call to action: signed out, a button that opens the login
 * popup; signed in, the reader's avatar and name (desktop only; on phones the
 * picture lives in the ☰ menu).
 */
function AccountButton({ compact = false }: { compact?: boolean }) {
  const { reader, openLogin } = useReader()
  if (reader && compact) return null
  if (reader) {
    return (
      <NavLink
        to="/account"
        aria-label="Миний бүртгэл"
        className="ez-hit inline-flex h-8 items-center gap-2 rounded-full border border-foreground/20 py-0.5 pr-3 pl-0.5 text-[13px] font-medium transition-colors hover:bg-foreground/5"
      >
        <span className="relative">
          <ReaderAvatar name={reader.name || reader.email || reader.phone} avatar={reader.avatar} size="sm" />
          {reader.anonymous ? (
            <span
              aria-label="Зочин горим"
              className="bg-foreground text-background ring-background absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full ring-2"
            >
              <VenetianMask className="size-2.5" />
            </span>
          ) : null}
        </span>
        <span className="max-w-[8rem] truncate">{reader.name || "Бүртгэл"}</span>
      </NavLink>
    )
  }
  return (
    <ShimmerButton type="button" onClick={openLogin} className={`ez-hit h-8 text-[13px] font-medium ${compact ? "px-3" : "px-3.5"}`}>
      Нэвтрэх
    </ShimmerButton>
  )
}

function StoryColumn({
  title,
  stories,
}: {
  title: string
  stories: ReturnType<typeof storiesByDesk>
}) {
  return (
    <div>
      <h4 className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
        {title}
      </h4>
      <div className="flex flex-col gap-3">
        {stories.map((story) => (
          <NavLink key={story.slug} to={`/story/${story.slug}`} className="group">
            <span className="text-muted-foreground text-xs">
              {formatStoryDate(story.date)}
            </span>
            <span className="line-clamp-3 block text-sm leading-snug font-medium text-foreground/85 group-hover:text-foreground">
              {story.title}
            </span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
