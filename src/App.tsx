import { BrowserRouter, Link, Route, Routes } from "react-router-dom"

import { Layout } from "@/components/site/Layout"
import { AboutPage } from "@/pages/AboutPage"
import { DesignPage } from "@/pages/DesignPage"
import { DeskPage } from "@/pages/DeskPage"
import { HomePage } from "@/pages/HomePage"
import { LetterPage } from "@/pages/LetterPage"
import { MarketsPage } from "@/pages/MarketsPage"
import { NewsletterPage } from "@/pages/NewsletterPage"
import { StoryPage } from "@/pages/StoryPage"
import { TalkPage } from "@/pages/TalkPage"

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="mongolia" element={<DeskPage desk="mongolia" />} />
          <Route path="world" element={<DeskPage desk="world" />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="story/:slug" element={<StoryPage />} />
          <Route path="ez-talk" element={<TalkPage />} />
          <Route path="newsletter" element={<NewsletterPage />} />
          <Route path="letter/:slug" element={<LetterPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="design" element={<DesignPage />} />
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
