import { useLayoutEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import {
  FaFacebookF,
  FaInstagram,
  FaTelegram,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6"

import { channels } from "@/content/channels"
import { Footer12 } from "@/components/ui/footer-12"
import { Navigation1 } from "@/components/ui/navigation-1"

const footerColumns = [
  {
    title: "Редакц",
    links: [
      { label: "Нүүр", href: "/" },
      { label: "Монгол", href: "/mongolia" },
      { label: "Дэлхий", href: "/world" },
      { label: "Ханш", href: "/markets" },
      { label: "Бид", href: "/about" },
    ],
  },
  {
    title: "Сонсох",
    links: [
      { label: "YouTube", href: channels.youtube },
      { label: "EZ Talk", href: "/ez-talk" },
      { label: "Telegram", href: channels.telegram },
    ],
  },
  {
    title: "Унших",
    links: [
      { label: "Substack", href: channels.substack },
      { label: "Нийтлэл", href: "/newsletter" },
      { label: "Facebook", href: channels.facebook },
      { label: "Instagram", href: channels.instagram },
    ],
  },
  {
    title: "Холбоо",
    links: [
      { label: "Холбоо барих", href: "/about#contact" },
      { label: "Хамтрах", href: "/about#partner" },
      { label: "Linktree", href: channels.linktree },
      { label: "X", href: channels.x },
      { label: channels.domain, href: "/" },
    ],
  },
]

export function Layout() {
  const location = useLocation()
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("ediinzasag-theme")
    return saved === "dark" ? "dark" : "light"
  })

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("ediinzasag-theme", theme)
  }, [theme])

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
    <div className="bg-background text-foreground min-h-svh">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
      >
        Агуулга руу
      </a>
      <Navigation1 theme={theme} onThemeChange={setTheme} />
      <main id="content">
        <Outlet />
      </main>
      <Footer12
        newsletterTitle="Долоо хоногийн тойм Substack дээр. Эдийн засаг is easy."
        inputPlaceholder="И-мэйл хаяг"
        subscribeText="Subscribe"
        onSubscribe={() => {
          window.open(channels.substackSubscribe, "_blank", "noopener,noreferrer")
        }}
        columns={footerColumns}
        brandName="ЭДИЙН ЗАСАГ"
        copyright="© 2026 EZ Эдийн засаг. ediinzasag.mn"
        socialLinks={[
          { label: "YouTube", href: channels.youtube, icon: <FaYoutube /> },
          { label: "Facebook", href: channels.facebook, icon: <FaFacebookF /> },
          { label: "Instagram", href: channels.instagram, icon: <FaInstagram /> },
          { label: "Telegram", href: channels.telegram, icon: <FaTelegram /> },
          { label: "X", href: channels.x, icon: <FaXTwitter /> },
        ]}
      />
    </div>
  )
}
