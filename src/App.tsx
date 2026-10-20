import { lazy, useEffect } from "react"
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom"

import { Layout } from "@/components/site/Layout"
import { HomePage } from "@/pages/HomePage"
import { StoryPage } from "@/pages/StoryPage"
import { adminUrl } from "@/lib/admin-url"

// Home and articles (where search visitors land) ship in the main bundle; every other page loads its own chunk.
const AboutPage = lazy(() => import("@/pages/AboutPage").then((module) => ({ default: module.AboutPage })))
const AccountPage = lazy(() => import("@/pages/AccountPage").then((module) => ({ default: module.AccountPage })))
const DesignPage = lazy(() => import("@/pages/DesignPage").then((module) => ({ default: module.DesignPage })))
const DeskPage = lazy(() => import("@/pages/DeskPage").then((module) => ({ default: module.DeskPage })))
const EduPage = lazy(() => import("@/pages/EduPage").then((module) => ({ default: module.EduPage })))
const LetterPage = lazy(() => import("@/pages/LetterPage").then((module) => ({ default: module.LetterPage })))
const LoginPage = lazy(() => import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage })))
const MarketsPage = lazy(() => import("@/pages/MarketsPage").then((module) => ({ default: module.MarketsPage })))
const NewsletterPage = lazy(() => import("@/pages/NewsletterPage").then((module) => ({ default: module.NewsletterPage })))
const TagPage = lazy(() => import("@/pages/TagPage").then((module) => ({ default: module.TagPage })))
const TalkPage = lazy(() => import("@/pages/TalkPage").then((module) => ({ default: module.TalkPage })))
const TopicPage = lazy(() => import("@/pages/TopicPage").then((module) => ({ default: module.TopicPage })))
const TopicsPage = lazy(() => import("@/pages/TopicPage").then((module) => ({ default: module.TopicsPage })))

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        {/* The admin is its own site now; old /admin links still land there. */}
        <Route path="admin/*" element={<ToAdmin />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="mongolia" element={<DeskPage desk="mongolia" />} />
          <Route path="world" element={<DeskPage desk="world" />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="story/:slug" element={<StoryPage />} />
          <Route path="tag/:slug" element={<TagPage />} />
          <Route path="topic" element={<TopicsPage />} />
          <Route path="topic/:slug" element={<TopicPage />} />
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

/** Old /admin/... links (bookmarks, ADMIN.md) forward to the same page on the admin site. */
function ToAdmin() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.location.replace(`${adminUrl}${pathname.replace(/^\/admin/, "")}${search}`)
  }, [pathname, search])
  return null
}
