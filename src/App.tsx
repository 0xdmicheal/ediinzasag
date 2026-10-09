import { lazy, Suspense } from "react"
import { BrowserRouter, Link, Route, Routes } from "react-router-dom"

import { Layout } from "@/components/site/Layout"
import { AboutPage } from "@/pages/AboutPage"
import { AccountPage } from "@/pages/AccountPage"
import { DesignPage } from "@/pages/DesignPage"
import { DeskPage } from "@/pages/DeskPage"
import { EduPage } from "@/pages/EduPage"
import { HomePage } from "@/pages/HomePage"
import { LetterPage } from "@/pages/LetterPage"
import { LoginPage } from "@/pages/LoginPage"
import { MarketsPage } from "@/pages/MarketsPage"
import { NewsletterPage } from "@/pages/NewsletterPage"
import { StoryPage } from "@/pages/StoryPage"
import { TagPage } from "@/pages/TagPage"
import { TalkPage } from "@/pages/TalkPage"

const AdminApp = lazy(() => import("@/admin/AdminApp"))
const PreviewFrame = lazy(() => import("@/pages/PreviewFrame"))

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route
          path="admin/*"
          element={
            <Suspense fallback={<p className="text-muted-foreground grid min-h-svh place-items-center text-sm">Ачаалж байна…</p>}>
              <AdminApp />
            </Suspense>
          }
        />
        {/* The admin editor's preview: the public article layout without the site chrome, in an iframe. */}
        <Route
          path="preview-frame"
          element={
            <Suspense fallback={null}>
              <PreviewFrame />
            </Suspense>
          }
        />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="mongolia" element={<DeskPage desk="mongolia" />} />
          <Route path="world" element={<DeskPage desk="world" />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="story/:slug" element={<StoryPage />} />
          <Route path="tag/:slug" element={<TagPage />} />
          <Route path="ez-talk" element={<TalkPage />} />
          <Route path="ez-edu" element={<EduPage />} />
          <Route path="newsletter" element={<NewsletterPage />} />
          <Route path="letter/:slug" element={<LetterPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="design" element={<DesignPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<LoginPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<DeskMissing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function DeskMissing() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-news text-4xl">Хуудас олдсонгүй</h1>
      <Link to="/" className="mt-4 inline-block underline">
        Нүүр лүү
      </Link>
    </section>
  )
}
