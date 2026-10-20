import { Navigate, Route, Routes } from "react-router-dom"

import { AdminGuard } from "@/admin/AdminGuard"
import { AdminLayout } from "@/admin/AdminLayout"
import { ConfirmProvider } from "@/admin/ConfirmDialog"
import { DesktopOnly } from "@/admin/DesktopOnly"
import { BoardPage } from "@/admin/BoardPage"
import { EditorPage } from "@/admin/EditorPage"
import { InboxPage } from "@/admin/InboxPage"
import { InsightsPage } from "@/admin/InsightsPage"
import { LoginPage } from "@/admin/LoginPage"
import { ReadersPage } from "@/admin/ReadersPage"
import { AdminSessionProvider } from "@/admin/session"
import { TagsPage } from "@/admin/TagsPage"
import { TeamPage } from "@/admin/TeamPage"
import { WelcomePage } from "@/admin/WelcomePage"

/** The newsroom admin (desktop only), served on its own at admin.ediinzasag.mn (src/admin-main.tsx). */
export default function AdminApp() {
  return (
    <DesktopOnly>
      <div className="ez-admin min-h-svh">
      <AdminSessionProvider>
        <ConfirmProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          {/* Invite and password-reset links land here (team-invite Edge Function). */}
          <Route path="welcome" element={<WelcomePage />} />
          <Route element={<AdminGuard />}>
            {/* The editor is full-screen, like Substack: no sidebar while writing. */}
            <Route path="new" element={<EditorPage key="editor" />} />
            <Route path="edit/:id" element={<EditorPage key="editor" />} />
            <Route element={<AdminLayout />}>
              {/* The front page is the agent's news in folders; the team's own stories have their page. */}
              <Route index element={<InboxPage />} />
              <Route path="stories" element={<BoardPage />} />
              <Route path="inbox" element={<Navigate to="/" replace />} />
              <Route path="tags" element={<TagsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="readers" element={<ReadersPage />} />
              <Route path="insights" element={<InsightsPage />} />
            </Route>
          </Route>
        </Routes>
        </ConfirmProvider>
      </AdminSessionProvider>
      </div>
    </DesktopOnly>
  )
}
