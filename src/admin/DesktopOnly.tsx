import { useSyncExternalStore, type ReactNode } from "react"
import { Monitor } from "lucide-react"

import { publicUrl } from "@/lib/public-url"

/*
 * The newsroom admin is a desktop tool: the board, editor and preview need a
 * wide screen. Below DESKTOP_QUERY (phones, small tablets) it shows a short
 * note instead. Widening the window brings the admin back without a reload.
 */

const DESKTOP_QUERY = "(min-width: 1024px)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches

export function DesktopOnly({ children }: { children: ReactNode }) {
  const desktop = useSyncExternalStore(subscribe, isDesktop, () => true)
  if (desktop) return <>{children}</>

  return (
    <main className="bg-background text-foreground grid min-h-svh place-items-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <img src={publicUrl("brand/logo-black.png")} alt="EZ Эдийн засаг" className="mx-auto h-7 w-auto dark:hidden" />
        <img src={publicUrl("brand/logo-white.png")} alt="EZ Эдийн засаг" className="mx-auto hidden h-7 w-auto dark:block" />
        <span className="bg-muted mx-auto mt-8 grid size-14 place-items-center rounded-2xl border">
          <Monitor className="size-6" />
        </span>
        <h1 className="ez-title mt-5 text-3xl">Open this on a computer</h1>
        <p className="text-muted-foreground mt-2 text-[14px] leading-relaxed">
          The newsroom works on desktops and laptops only. Writing, reviewing and publishing need a bigger screen.
        </p>
        <a
          href={import.meta.env.BASE_URL}
          className="border-foreground/20 hover:bg-foreground/5 mt-6 inline-flex h-10 items-center justify-center rounded-lg border px-5 text-[14px] font-medium"
        >
          Back to the site
        </a>
      </div>
    </main>
  )
}
