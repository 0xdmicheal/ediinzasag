import { NavLink } from "react-router-dom"
import {
  ArrowUpRight,
  Mail,
  Menu,
  Moon,
  Sun,
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
  "bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-transparent hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"

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
    <header className="sticky top-0 z-40 text-neutral-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 border-y border-black/10 bg-background/80 backdrop-blur-md dark:border-white/10 dark:bg-black/75" />
      <div className="relative flex h-14 w-full items-center justify-between px-6 lg:px-40">
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
                  <NavigationMenuTrigger className="h-auto bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-transparent hover:text-neutral-950 data-open:bg-transparent data-open:text-neutral-950 dark:text-neutral-300 dark:hover:text-white dark:data-open:text-white">
                    Тойм
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="left-1/2 w-max -translate-x-1/2 rounded-none! border! border-black/10! bg-background/55! p-0! shadow-none! ring-0! backdrop-blur-xl! dark:border-white/10! dark:bg-black/55!">
                    <div className="grid grid-cols-[10.5rem_10.5rem_8.5rem_13rem] gap-5 p-5">
                      <StoryColumn title="Монгол" stories={mongolia} />
                      <StoryColumn title="Дэлхий" stories={world} />
                      <div>
                        <h4 className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                          Сувгууд
                        </h4>
                        <div className="flex flex-col gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <a className="hover:text-neutral-950 dark:hover:text-white" href={channels.youtube}>
                            YouTube
                          </a>
                          <a className="hover:text-neutral-950 dark:hover:text-white" href={channels.substack}>
                            Substack
                          </a>
                          <a className="hover:text-neutral-950 dark:hover:text-white" href={channels.telegram}>
                            Telegram
                          </a>
                          <NavLink className="hover:text-neutral-950 dark:hover:text-white" to="/markets">
                            Ханш
                          </NavLink>
                          <NavLink className="hover:text-neutral-950 dark:hover:text-white" to="/ez-talk">
                            EZ Talk
                          </NavLink>
                        </div>
                      </div>
                      <div className="border-l border-black/10 pl-6 dark:border-white/10">
                        <Badge variant="secondary" className="mb-3">
                          {deskLabel[lead.desk]}
                        </Badge>
                        <p className="font-news text-lg leading-snug font-medium">
                          {lead.title}
                        </p>
                        <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">{lead.dek}</p>
                        <Button asChild className="mt-4 bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200" size="sm">
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
          <a href={channels.youtube} className="text-[13px] font-medium text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white">
            YouTube
          </a>
          <button
            type="button"
            aria-label={theme === "dark" ? "Гэрэл горим" : "Харанхуй горим"}
            onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
            className="flex size-8 items-center justify-center text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <a
            href={channels.substackSubscribe}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-950/20 px-3 text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white dark:hover:text-black"
          >
            <Mail className="size-3.5" />
            Subscribe
          </a>
          <NavLink
            to="/newsletter"
            className="inline-flex h-8 items-center rounded-full bg-neutral-950 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Нийтлэл
          </NavLink>
        </div>

        <div className="shrink-0 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Цэс нээх" className="text-neutral-950 hover:bg-black/5 hover:text-neutral-950 dark:text-white dark:hover:bg-white/10 dark:hover:text-white">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,22rem)] overflow-y-auto p-6">
              <SheetTitle className="font-news text-left text-xl">Эдийн засаг</SheetTitle>
              <div className="mt-6 flex flex-col gap-1">
                {primary.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <NavLink
                      to={item.to}
                      className="py-2 text-base font-medium"
                    >
                      {item.label}
                    </NavLink>
                  </SheetClose>
                ))}
                <Accordion type="single" collapsible>
                  <AccordionItem value="latest">
                    <AccordionTrigger>Сүүлийн тойм</AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-3">
                      {byDate().slice(0, 5).map((story) => (
                        <SheetClose asChild key={story.slug}>
                          <NavLink to={`/story/${story.slug}`} className="text-sm">
                            <span className="text-muted-foreground block text-xs">
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
              <div className="mt-auto flex flex-col gap-2 pt-6">
                <Button asChild variant="outline">
                  <a href={channels.youtube}>YouTube</a>
                </Button>
                <Button asChild variant="outline">
                  <a href={channels.substackSubscribe} target="_blank" rel="noreferrer">
                    <Mail />
                    Subscribe
                  </a>
                </Button>
                <SheetClose asChild>
                  <Button asChild>
                    <NavLink to="/newsletter">Нийтлэл</NavLink>
                  </Button>
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
            <span className="line-clamp-3 block text-sm leading-snug font-medium text-neutral-800 group-hover:text-neutral-950 dark:text-neutral-200 dark:group-hover:text-white">
              {story.title}
            </span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
