import { useLayoutEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import {
  FaFacebookF,
  FaInstagram,
  FaTelegram,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6"

import { channels, openSubstackSubscribe } from "@/content/channels"
import { sessionLabel } from "@/content/markets"
import { AmbientBackground } from "@/components/site/AmbientBackground"
import { Footer12 } from "@/components/ui/footer-12"
import { Navigation1 } from "@/components/ui/navigation-1"
import { CompleteProfile } from "@/reader/CompleteProfile"
import { LoginModal } from "@/reader/LoginModal"
import { ReaderProvider } from "@/reader/session"

const footerColumns = [
  {
    title: "Тойм",
    links: [
      { label: "Нүүр", href: "/" },
      { label: "Монгол", href: "/mongolia" },
      { label: "Дэлхий", href: "/world" },
      { label: "Ханш", href: "/markets" },
    ],
  },
  {
    title: "Редакц",
    links: [
      { label: "Бидний тухай", href: "/about" },
      { label: "Редакцын зарчим", href: "/about#standards" },
      { label: "Холбоо барих", href: "/about#contact" },
      { label: "Хамтран ажиллах", href: "/about#partner" },
    ],
  },
  {
    title: "Бүтээгдэхүүн",
    links: [
      { label: "EZ Talk", href: "/ez-talk", description: "Nio, Ulemj нарын видео подкаст" },
      { label: "Нийтлэл", href: "/newsletter", description: "Долоо хоногийн захидал" },
      { label: "YouTube", href: channels.youtube, description: "Бүх дугаар" },
      { label: "Substack", href: channels.substack, description: "И-мэйл захиалга" },
      { label: "Telegram", href: channels.telegram, description: "Шууд шугам" },
    ],
  },
]

const footerNotices = [
  {
    title: "Ханшийн мэдээлэл",
    body: `${sessionLabel}. Шууд ханш биш. Тоо бүрт огноо, нэрлэсэн эх сурвалж.`,
  },
  {
    title: "Анхааруулга",
    body: "Нийтийн эх сурвалжид тулгуурласан тойм. Хөрөнгө оруулалтын зөвлөгөө биш.",
  },
]

const footerCopyright = `© ${new Date().getFullYear()} EZ Эдийн засаг · ${channels.domain}. Бүх эрх хуулиар хамгаалагдсан.`

const THEME_KEY = "ediinzasag-theme"

function initialTheme(): "light" | "dark" {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === "dark" || saved === "light") return saved
  } catch {
    // Storage blocked; fall through to the system setting.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function Layout() {
  const location = useLocation()
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  function changeTheme(next: "light" | "dark") {
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage blocked; the choice lasts for this visit only.
    }
  }

  useLayoutEffect(() => {
    if (location.hash) {
      const node = document.getElementById(location.hash.slice(1))
      if (node) {
        node.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  return (
    <ReaderProvider>
      <div className="bg-background text-foreground relative isolate flex min-h-svh flex-col">
        <AmbientBackground />
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
        >
          Агуулга руу
        </a>
        <Navigation1 theme={theme} onThemeChange={changeTheme} />
        <main id="content" className="flex-1">
          <Outlet />
        </main>
        <Footer12
          brandName="ЭДИЙН ЗАСАГ"
          description="EZ Эдийн засаг Монголын эдийн засаг, дэлхийн зах зээлийн тоймыг нэг ширээн дээр тавьдаг."
          onSubscribe={openSubstackSubscribe}
          columns={footerColumns}
          notices={footerNotices}
          copyright={footerCopyright}
          socialLinks={[
            { label: "YouTube", href: channels.youtube, icon: <FaYoutube /> },
            { label: "Facebook", href: channels.facebook, icon: <FaFacebookF /> },
            { label: "Instagram", href: channels.instagram, icon: <FaInstagram /> },
            { label: "Telegram", href: channels.telegram, icon: <FaTelegram /> },
            { label: "X", href: channels.x, icon: <FaXTwitter /> },
          ]}
        />
      </div>
      <LoginModal />
      <CompleteProfile />
    </ReaderProvider>
  )
}
