import type { CSSProperties, ReactNode } from "react"
import { Bookmark, Flame, MessageCircle, Trophy, VenetianMask } from "lucide-react"

import { sortByDate, useStories } from "@/content/live"
import { deskLabel, formatStoryDate, storyArt } from "@/content/stories"
import { publicUrl } from "@/lib/public-url"

/*
 * The login page's left panel: what a free account gets, shown as the real
 * pieces of the site (the latest story, 🔥, save, an achievement, a guest
 * comment) floating on the dark studio surface. Decorative: the form says
 * everything a screen reader needs.
 */

function Floating({ children, className, delay = 0 }: { children: ReactNode; className: string; delay?: number }) {
  return (
    <div className={`ez-rise absolute ${className}`} style={{ animationDelay: `${delay}ms` } as CSSProperties}>
      <div className="ez-float" style={{ animationDelay: `${delay * 3}ms` } as CSSProperties}>
        {children}
      </div>
    </div>
  )
}

const chip = "flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3.5 py-2 text-[13px] font-medium shadow-lg backdrop-blur-md"

export function LoginShowcase() {
  const { stories } = useStories()
  const latest = sortByDate(stories)[0]
  const art = latest ? storyArt(latest.slug) : null

  return (
    <div aria-hidden className="bg-studio text-photo-foreground relative isolate flex h-full flex-col overflow-hidden p-8 lg:p-10">
      {/* Brand glow and a fine dot grid. */}
      <div className="absolute -top-24 -left-24 -z-10 size-[28rem] rounded-full bg-[#298dff]/30 blur-[100px]" />
      <div className="absolute -right-32 -bottom-32 -z-10 size-[24rem] rounded-full bg-[#f97316]/20 blur-[100px]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <img src={publicUrl("brand/logo-white.png")} alt="" className="h-7 w-fit" />

      <div className="relative my-auto h-[22rem]">
        {latest && art ? (
          <Floating className="top-[4%] left-0 w-[12.5rem] rotate-[-3deg]" delay={0}>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-md">
              <img src={art.src} alt="" className="aspect-[16/9] w-full object-cover opacity-90" />
              <div className="p-3">
                <p className="text-[11px] text-white/55">
                  {deskLabel[latest.desk]} · {formatStoryDate(latest.date)}
                </p>
                <p className="font-news mt-1 line-clamp-2 text-[14px] leading-snug text-white">{latest.title}</p>
              </div>
            </div>
          </Floating>
        ) : null}

        <Floating className="top-0 right-4" delay={180}>
          <span className={`${chip} text-orange-300`}>
            <Flame className="size-4 fill-current" />
            <span className="tabular-nums">128</span>
          </span>
        </Floating>

        <Floating className="top-[30%] right-0" delay={320}>
          <span className={chip}>
            <Bookmark className="size-4 fill-current" />
            Хадгалсан
          </span>
        </Floating>

        <Floating className="right-0 bottom-[26%]" delay={460}>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 shadow-xl backdrop-blur-md">
            <span className="grid size-9 place-items-center rounded-full bg-[#298dff] text-white">
              <Trophy className="size-4" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-white">Анхны тойм</span>
              <span className="block text-[11px] text-white/60">Амжилт нээгдлээ · +50 оноо</span>
            </span>
          </div>
        </Floating>

        <Floating className="bottom-0 left-6 max-w-[13rem]" delay={600}>
          <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.08] px-3.5 py-2.5 shadow-xl backdrop-blur-md">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-white/60 italic">
              <VenetianMask className="size-3.5" />
              Зочин
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-white">Тоог нь эх сурвалжтай нь өгдөгт баяртай байна 👏</p>
          </div>
        </Floating>
      </div>

      <div>
        <p className="font-news text-[1.75rem] leading-[1.15] text-balance text-white">Уншаад зогсохгүй. Хадгал, гал өг, ярилц.</p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-white/60">
          <li className="flex items-center gap-1.5">
            <Bookmark className="size-3.5" /> Хадгалах
          </li>
          <li className="flex items-center gap-1.5">
            <Flame className="size-3.5" /> Гал өгөх
          </li>
          <li className="flex items-center gap-1.5">
            <MessageCircle className="size-3.5" /> Сэтгэгдэл
          </li>
          <li className="flex items-center gap-1.5">
            <Trophy className="size-3.5" /> Оноо, амжилт
          </li>
        </ul>
      </div>
    </div>
  )
}

/** Phones: the same promise as one row of chips above the form. */
export function LoginShowcaseCompact() {
  const items = [
    { icon: <Bookmark className="size-3.5" />, label: "Хадгалах" },
    { icon: <Flame className="size-3.5" />, label: "Гал" },
    { icon: <MessageCircle className="size-3.5" />, label: "Сэтгэгдэл" },
    { icon: <Trophy className="size-3.5" />, label: "Оноо" },
  ]
  return (
    <ul aria-hidden className="mt-4 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item.label} className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium">
          {item.icon}
          {item.label}
        </li>
      ))}
    </ul>
  )
}
