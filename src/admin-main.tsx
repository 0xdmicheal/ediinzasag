import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes } from "react-router-dom"

import "./index.css"
import "./admin/admin.css"
import AdminApp from "@/admin/AdminApp"

/*
 * Entry for the newsroom admin at admin.ediinzasag.mn (`npm run dev:admin` /
 * `npm run build:admin`). The public site (main.tsx) never bundles any of this.
 */

// The editor's preview iframe has to share the admin's origin (it only accepts same-origin messages).
const PreviewFrame = lazy(() => import("@/pages/PreviewFrame"))

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <Routes>
        <Route
          path="preview-frame"
          element={
            <Suspense fallback={null}>
              <PreviewFrame />
            </Suspense>
          }
        />
        <Route path="*" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
