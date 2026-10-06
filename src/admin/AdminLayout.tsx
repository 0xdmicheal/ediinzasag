import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom"
import { ExternalLink, FilePlus2, KanbanSquare, LogOut, Mail, Tags, Users } from "lucide-react"

import { canManageTags, canManageTeam } from "@/admin/rules"
import { useSession } from "@/admin/session"
import { Avatar, RoleBadge } from "@/admin/ui"
import { publicUrl } from "@/lib/public-url"

export function AdminLayout() {
  const { backend, member } = useSession()
  const location = useLocation()

  if (member === undefined || !backend) {
    return (
      <div className="text-muted-foreground grid min-h-svh place-items-center text-sm" role="status">
        Ачаалж байна…
      </div>
    )
  }
  if (!member) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />

  const links = [
    { to: "/admin", label: "Самбар", icon: KanbanSquare, end: true, show: true },
    { to: "/admin/new", label: "Шинэ нийтлэл", icon: FilePlus2, end: false, show: true },
    { to: "/admin/tags", label: "Шошго", icon: Tags, end: false, show: canManageTags(member) },
    { to: "/admin/team", label: "Баг", icon: Users, end: false, show: canManageTeam(member) },
    { to: "/admin/readers", label: "Уншигчид", icon: Mail, end: false, show: canManageTeam(member) },
  ].filter((link) => link.show)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] font-medium transition-colors ${isActive ? "bg-foreground/[0.07] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`

  return (
    <div className="bg-background text-foreground relative isolate flex min-h-svh flex-col lg:flex-row">

      {/* Sidebar on desktop, top bar + scrolling tabs on phones. */}
      <aside className="bg-background/85 sticky top-0 z-30 flex shrink-0 flex-col border-b backdrop-blur-xl lg:h-svh lg:w-60 lg:border-r lg:border-b-0">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link to="/admin" className="flex items-center gap-2" aria-label="Самбар">
            <img src={publicUrl("brand/logo-black.png")} alt="" className="h-6 w-auto dark:hidden" />
            <img src={publicUrl("brand/logo-white.png")} alt="" className="hidden h-6 w-auto dark:block" />
            <span className="text-muted-foreground font-mono text-[10px] uppercase">Редакц</span>
          </Link>
          <div className="flex items-center gap-2 lg:hidden">
            <Avatar name={member.name} size="sm" />
          </div>
        </div>
        <nav aria-label="Админ цэс" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="size-4" />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
          <a href={`${import.meta.env.BASE_URL}`} target="_blank" rel="noreferrer" className={linkClass({ isActive: false })}>
            <ExternalLink className="size-4" />
            <span className="whitespace-nowrap">Сайт харах</span>
          </a>
        </nav>
        <div className="mt-auto hidden border-t p-3 lg:block">
          <div className="flex items-center gap-2.5">
            <Avatar name={member.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{member.name}</p>
              <RoleBadge role={member.role} />
            </div>
            <button
              type="button"
              aria-label="Гарах"
              onClick={() => backend.signOut()}
              className="text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-md"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {backend.mode === "demo" ? (
          <p className="border-b bg-[color-mix(in_oklch,var(--brand)_10%,transparent)] px-4 py-2 text-[12px]">
            <strong>Демо горим.</strong> Өгөгдөл зөвхөн энэ хөтөчид хадгалагдана. Багаар ажиллахын тулд Supabase холбоно уу (ADMIN.md).
          </p>
        ) : null}
        <main className="flex-1">
          <Outlet />
        </main>
        <button
          type="button"
          onClick={() => backend.signOut()}
          className="text-muted-foreground border-t py-3 text-[13px] lg:hidden"
        >
          {member.name} · Гарах
        </button>
      </div>
    </div>
  )
}
