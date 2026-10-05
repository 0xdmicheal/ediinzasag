import { NavLink } from "react-router-dom"
import {
  ArrowUpRight,
  Mail,
  Menu,
  Moon,
  Sun,
  X,
} from "lucide-react"

import { channels } from "@/content/channels"
import { publicUrl } from "@/lib/public-url"
import {
  byDate,
  deskLabel,
  formatStoryDate,
  storiesByDesk,
} from "@/content/stories"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
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

const primary = [
  { to: "/mongolia", label: "Монгол" },
  { to: "/world", label: "Дэлхий" },
  { to: "/markets", label: "Ханш" },
  { to: "/ez-talk", label: "EZ Talk" },
  { to: "/about", label: "Бид" },
]

const linkClass =
  "bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"

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
  const lead = byDate()[0]
  const mongolia = storiesByDesk("mongolia").slice(0, 3)
  const world = storiesByDesk("world").slice(0, 3)

  return (
    <header className="sticky top-0 z-40 text-foreground">
      <div className="pointer-events-none absolute inset-0 border-y border-border bg-background/85 backdrop-blur-md" />
      <div className="relative mx-auto flex h-14 w-full max-w-[1520px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center">
          <Brand />
        </div>
        <div className="hidden lg:flex">
            <NavigationMenu viewport={false}>
              <NavigationMenuList className="gap-1">
                {primary.slice(0, 2).map((item) => (
                  <NavigationMenuItem key={item.to}>
                    <NavigationMenuLink asChild className={linkClass}>
                      <NavLink to={item.to}>{item.label}</NavLink>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
                <NavigationMenuItem value="toim">
                  <NavigationMenuTrigger className="h-auto bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-open:bg-transparent data-open:text-foreground">
                    Тойм
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="left-1/2 w-max -translate-x-1/2 rounded-lg! border! border-border! bg-background/90! p-0! shadow-none! ring-0! backdrop-blur-xl!">
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
                {primary.slice(2).map((item) => (
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
            onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
            className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <a
            href={channels.substackSubscribe}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground/20 px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            <Mail className="size-3.5" />
            Subscribe
          </a>
          <NavLink
            to="/newsletter"
            className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"
          >
            Нийтлэл
          </NavLink>
        </div>

        <div className="shrink-0 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Цэс нээх" className="text-foreground hover:bg-foreground/5 hover:text-foreground">
                <Menu />
              </Button>
            </SheetTrigger>
            {/* Same glass, type and pills as the header bar. */}
            <SheetContent
              side="right"
              showCloseButton={false}
              // Opening with a tap should not paint a focus ring on the first button.
              onOpenAutoFocus={(event) => event.preventDefault()}
              className="border-border w-[min(100%,22rem)] gap-0 overflow-y-auto bg-background/85 p-0 shadow-none backdrop-blur-xl"
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
                    onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
                    className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center transition-colors"
                  >
                    {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  </button>
                  <SheetClose asChild>
                    <button
                      type="button"
                      aria-label="Цэс хаах"
                      className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center transition-colors"
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
                <Accordion type="single" collapsible>
                  <AccordionItem value="latest" className="border-0">
                    <AccordionTrigger className="text-muted-foreground hover:text-foreground px-3 text-[15px] hover:no-underline">
                      Сүүлийн тойм
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-1 px-1">
                      {byDate().slice(0, 5).map((story) => (
                        <SheetClose asChild key={story.slug}>
                          <NavLink to={`/story/${story.slug}`} className="hover:bg-foreground/5 rounded-md px-2 py-2 text-[13px] leading-snug">
                            <span className="text-muted-foreground block font-mono text-[11px]">
                              {deskLabel[story.desk]} · {formatStoryDate(story.date)}
                            </span>
                            {story.title}
                          </NavLink>
                        </SheetClose>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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
                  <NavLink
                    to="/newsletter"
                    className="bg-primary text-primary-foreground hover:bg-primary/85 inline-flex h-10 items-center justify-center rounded-full text-[13px] font-medium transition-colors"
                  >
                    Нийтлэл унших
                  </NavLink>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
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
