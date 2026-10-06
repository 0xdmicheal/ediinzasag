import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useSession } from "@/admin/session"

/** Lets signed-in team members through; everyone else goes to the login page. */
export function AdminGuard() {
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
  return <Outlet />
}
