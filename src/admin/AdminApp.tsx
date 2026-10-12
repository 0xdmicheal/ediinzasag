import { Route, Routes } from "react-router-dom"

import { AdminGuard } from "@/admin/AdminGuard"
import { AdminLayout } from "@/admin/AdminLayout"
import { ConfirmProvider } from "@/admin/ConfirmDialog"
import { DesktopOnly } from "@/admin/DesktopOnly"
import { BoardPage } from "@/admin/BoardPage"
import { EditorPage } from "@/admin/EditorPage"
import { InsightsPage } from "@/admin/InsightsPage"
import { LoginPage } from "@/admin/LoginPage"
import { ReadersPage } from "@/admin/ReadersPage"
import { AdminSessionProvider } from "@/admin/session"
import { TagsPage } from "@/admin/TagsPage"
import { TeamPage } from "@/admin/TeamPage"

/** The newsroom admin (desktop only), served on its own at admin.ediinzasag.mn (src/admin-main.tsx). */
export default function AdminApp() {
  return (
    <DesktopOnly>
      <AdminSessionProvider>
        <ConfirmProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<AdminGuard />}>
            {/* The editor is full-screen, like Substack: no sidebar while writing. */}
            <Route path="new" element={<EditorPage key="editor" />} />
            <Route path="edit/:id" element={<EditorPage key="editor" />} />
            <Route element={<AdminLayout />}>
              <Route index element={<BoardPage />} />
              <Route path="tags" element={<TagsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="readers" element={<ReadersPage />} />
              <Route path="insights" element={<InsightsPage />} />
            </Route>
          </Route>
        </Routes>
        </ConfirmProvider>
      </AdminSessionProvider>
    </DesktopOnly>
  )
}
