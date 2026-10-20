import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BookOpen,
  ChartNoAxesColumn,
  ChevronsUpDown,
  ExternalLink,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Moon,
  PanelLeft,
  Search,
  Sun,
  Tags,
  Users,
} from "lucide-react"
import { cn } from "cn"

import { canManageTags, canManageTeam } from "@/admin/rules"
import { useSession } from "@/admin/session"
import type { Article } from "@/admin/types"
import { Avatar, StatusPill } from "@/admin/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { publicUrl } from "@/lib/public-url"

/* The admin shell: Watermelon UI's Tallie layout (sidebar, top bar with search). See admin.css. */

const THEME_KEY = "ediinzasag-theme"

const menuButtonClass = cn(
  "h-10 gap-2.5 rounded-lg px-3 text-[14px] text-sidebar-foreground/70 transition-colors",
  "aria-[current=page]:bg-background aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:shadow-xs",
  "[&_svg]:size-[18px]!",
)

function NavItem({ to, label, icon: Icon, end = false }: { to: string; label: string; icon: typeof Inbox; end?: boolean }) {
  const { pathname, search } = useLocation()
  const here = `${pathname}${search}`
  const active = end ? here === to : pathname === to || pathname.startsWith(`${to}/`)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label} className={menuButtonClass}>
        <Link to={to} aria-current={active ? "page" : undefined}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function ThemeItem() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light")
    } catch {
      // Storage blocked: the choice lasts until reload.
    }
    setDark(next)
  }
  const label = dark ? "Light mode" : "Dark mode"
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={label} onClick={toggle} className={menuButtonClass}>
        {dark ? <Sun /> : <Moon />}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function AdminSidebar() {
  const { backend, member } = useSession()
  const { toggleSidebar } = useSidebar()
  if (!backend || !member) return null
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="h-16 flex-row items-center justify-between px-4 group-data-[collapsible=icon]:px-2">
        <Link to="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden" aria-label="Dashboard">
          <img src={publicUrl("brand/logo-black.png")} alt="" className="h-6 w-auto dark:hidden" />
          <img src={publicUrl("brand/logo-white.png")} alt="" className="hidden h-6 w-auto dark:block" />
          <span className="text-muted-foreground text-[13px]">Newsroom</span>
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar (Ctrl+B)"
          title="Collapse sidebar (Ctrl+B)"
          className="bg-background text-muted-foreground hover:text-foreground grid size-8 shrink-0 place-items-center rounded-lg"
        >
          <PanelLeft className="size-4" />
        </button>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[13px]">Newsroom</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <NavItem to="/" label="Dashboard" icon={LayoutDashboard} end />
              <NavItem to="/new" label="New story" icon={FilePlus2} />
              <NavItem to="/inbox" label="Inbox" icon={Inbox} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {canManageTags(member) ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[13px]">Manage</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                <NavItem to="/tags" label="Tags" icon={Tags} />
                {canManageTeam(member) ? (
                  <>
                    <NavItem to="/team" label="Team" icon={Users} />
                    <NavItem to="/readers" label="Readers" icon={Mail} />
                    <NavItem to="/insights" label="Insights" icon={ChartNoAxesColumn} />
                  </>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="px-2 pb-3">
        <SidebarMenu className="gap-1">
          <NavItem to="/?guide=1" label="Guide" icon={BookOpen} end />
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View site" className={menuButtonClass}>
              <a href="https://ediinzasag.mn" target="_blank" rel="noreferrer">
                <ExternalLink />
                <span>View site</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <ThemeItem />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

/** ⌘K / Ctrl+K: jump to any story by title or author. */
function StorySearch() {
  const { backend } = useSession()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Loaded on first focus, so pages that never search don't pay for it.
  function load() {
    setOpen(true)
    if (articles === null && backend) backend.listArticles().then(setArticles).catch(() => setArticles([]))
  }

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || !articles) return []
    return articles
      .filter((article) => article.title.toLowerCase().includes(needle) || article.authorName.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [articles, query])

  function go(article: Article) {
    setQuery("")
    setOpen(false)
    input.current?.blur()
    navigate(`/edit/${article.id}`)
  }

  return (
    <div className="relative w-full max-w-md">
      <label className="bg-secondary flex h-10 items-center gap-2 rounded-lg px-3">
        <Search className="text-muted-foreground size-4 shrink-0" />
        <span className="sr-only">Search stories</span>
        <input
          ref={input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setCursor(0)
          }}
          onFocus={load}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") setCursor((value) => Math.min(value + 1, results.length - 1))
            else if (event.key === "ArrowUp") setCursor((value) => Math.max(value - 1, 0))
            else if (event.key === "Enter" && results[cursor]) go(results[cursor])
            else if (event.key === "Escape") input.current?.blur()
            else return
            event.preventDefault()
          }}
          placeholder="Search stories"
          className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
        {query ? null : (
          <kbd className="bg-background text-muted-foreground hidden rounded-md px-1.5 py-0.5 font-sans text-[12px] sm:block">Ctrl K</kbd>
        )}
      </label>
      {open && query.trim() ? (
        <div className="bg-popover absolute inset-x-0 top-12 z-50 overflow-hidden rounded-xl border shadow-lg">
          {articles === null ? (
            <p className="text-muted-foreground px-4 py-3 text-[13px]">Loading…</p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground px-4 py-3 text-[13px]">No stories match “{query.trim()}”.</p>
          ) : (
            <ul role="listbox" aria-label="Stories">
              {results.map((article, index) => (
                <li key={article.id} role="option" aria-selected={index === cursor}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(article)}
                    onMouseEnter={() => setCursor(index)}
                    className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", index === cursor && "bg-muted")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{article.title || "Untitled draft"}</span>
                      <span className="text-muted-foreground block truncate text-[12px]">{article.authorName || "Agent"}</span>
                    </span>
                    <StatusPill status={article.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Topbar() {
  const { backend, member } = useSession()
  if (!backend || !member) return null
  return (
    <header className="bg-background/90 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b px-6 backdrop-blur lg:px-8">
      <StorySearch />
      <div className="flex shrink-0 items-center gap-3">
        {backend.mode === "demo" ? (
          <span className="bg-secondary text-muted-foreground rounded-md px-2 py-1 text-[12px]" title="Data stays in this browser. Connect Supabase to work as a team (ADMIN.md).">
            Demo
          </span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger className="hover:bg-muted flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 outline-none" aria-label="Account">
            <Avatar name={member.name} />
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-[13px] font-medium">{member.name}</span>
              <span className="text-muted-foreground block text-[12px] capitalize">{member.role}</span>
            </span>
            <ChevronsUpDown className="text-muted-foreground size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="text-foreground text-[13px] font-medium">{member.name}</p>
              <p className="text-muted-foreground truncate text-[12px]">{member.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => backend.signOut()} variant="destructive">
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export function AdminLayout() {
  const { backend, member } = useSession()
  const location = useLocation()

  if (member === undefined || !backend) {
    return (
      <div className="text-muted-foreground grid min-h-svh place-items-center text-sm" role="status">
        Loading…
      </div>
    )
  }
  if (!member) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider
        defaultOpen
        className="h-svh overflow-hidden"
        style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3.75rem" } as CSSProperties}
      >
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
