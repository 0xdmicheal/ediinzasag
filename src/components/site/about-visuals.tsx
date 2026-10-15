import { cn } from "cn"

/*
 * Small drawn mock-ups for the About page's ad offer: where an advertiser's
 * slot sits on ediinzasag.mn, in the letter, in EZ Talk and on social. Pure
 * markup in the site's theme tokens (light and dark), monochrome, with the ad
 * slot drawn as a dashed box. Decorative: every one is aria-hidden by its caller.
 */

/** Small L-shaped brackets on the four corners of a box (the box must be `relative`). */
export function Corners({ className }: { className?: string }) {
  const base = "pointer-events-none absolute size-2 border-foreground/40"
  return (
    <>
      <span className={cn(base, "top-0 left-0 border-t border-l", className)} />
      <span className={cn(base, "top-0 right-0 border-t border-r", className)} />
      <span className={cn(base, "bottom-0 left-0 border-b border-l", className)} />
      <span className={cn(base, "right-0 bottom-0 border-r border-b", className)} />
    </>
  )
}

/** The advertiser's slot: a dashed box labelled «Таны зар». */
export function AdSlot({ className, label = "Таны зар" }: { className?: string; label?: string }) {
  return (
    <div className={cn("border-foreground/45 bg-foreground/[0.06] grid place-items-center rounded-sm border border-dashed", className)}>
      <span className="text-foreground/70 px-1.5 font-mono text-[7px] font-bold tracking-[0.2em] whitespace-nowrap uppercase">{label}</span>
    </div>
  )
}

/** A browser window with a URL bar around `children`. */
export function BrowserFrame({ url, children, className }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-background overflow-hidden rounded-md border shadow-2xl shadow-black/20", className)}>
      <div className="bg-muted flex items-center gap-1.5 border-b px-2.5 py-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="bg-foreground/20 size-1.5 rounded-full" />
        ))}
        <span className="bg-background text-muted-foreground ml-2 truncate rounded px-2 py-0.5 font-mono text-[8px]">{url}</span>
      </div>
      {children}
    </div>
  )
}

const bar = "bg-foreground/10 rounded-full"
const block = "bg-foreground/[0.08] rounded"

/** The news site's front page, with a banner slot under the masthead. */
export function HomeMock() {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between">
        <span className="font-news text-[11px] font-semibold">EZ Эдийн засаг</span>
        <span className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn(bar, "h-1 w-5")} />
          ))}
        </span>
      </div>
      <AdSlot className="mt-2.5 h-7" />
      <div className="mt-2.5 grid grid-cols-[1.3fr_1fr] gap-2.5">
        <div className={cn(block, "aspect-[4/3]")} />
        <div className="flex flex-col gap-1.5 pt-1">
          <span className={cn(bar, "h-2 w-full")} />
          <span className={cn(bar, "h-2 w-4/5")} />
          <span className={cn(bar, "mt-1 h-1 w-full opacity-60")} />
          <span className={cn(bar, "h-1 w-11/12 opacity-60")} />
          <span className={cn(bar, "h-1 w-3/4 opacity-60")} />
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className={cn(block, "aspect-video")} />
            <span className={cn(bar, "h-1.5 w-full")} />
            <span className={cn(bar, "h-1.5 w-2/3")} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** An article page with a slot between paragraphs. */
export function ArticleMock() {
  const lines = (count: number) =>
    Array.from({ length: count }).map((_, i) => <span key={i} className={cn(bar, "block h-1", i === count - 1 ? "w-2/3" : "w-full")} />)
  return (
    <div className="flex flex-col gap-1.5 p-3">
      <span className={cn(bar, "h-2 w-4/5")} />
      <span className={cn(bar, "mb-1 h-2 w-3/5")} />
      {lines(4)}
      <AdSlot className="my-1.5 h-12" />
      {lines(3)}
    </div>
  )
}

/** A sponsored article card, labelled as such. */
export function SponsoredMock() {
  return (
    <div className="p-3">
      <div className={cn(block, "aspect-[16/8]")} />
      <span className="border-foreground/45 text-foreground/80 mt-2 inline-block rounded-sm border border-dashed px-1.5 py-0.5 font-mono text-[7px] font-bold tracking-[0.18em] uppercase">
        Ивээн тэтгэсэн
      </span>
      <span className={cn(bar, "mt-1.5 block h-2 w-full")} />
      <span className={cn(bar, "mt-1 block h-2 w-3/4")} />
      <span className={cn(bar, "mt-2 block h-1 w-full opacity-60")} />
      <span className={cn(bar, "mt-1 block h-1 w-5/6 opacity-60")} />
    </div>
  )
}

/** The weekly letter, with a sponsor block near the top. */
export function LetterMock() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 border-b pb-2">
        <span className="bg-foreground/80 text-background grid size-5 place-items-center rounded-sm font-mono text-[7px] font-bold">EZ</span>
        <div className="flex flex-1 flex-col gap-1">
          <span className={cn(bar, "h-1.5 w-1/2")} />
          <span className={cn(bar, "h-1 w-1/3 opacity-60")} />
        </div>
      </div>
      <AdSlot className="mt-2.5 h-9" label="Ивээн тэтгэгч" />
      <div className="mt-2.5 flex flex-col gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn(bar, "block h-1", i === 3 ? "w-1/2" : "w-full")} />
        ))}
      </div>
    </div>
  )
}

/** An EZ Talk episode with a sponsor read at the start of the timeline. */
export function VideoMock() {
  return (
    <div className="p-3">
      <div className="bg-foreground/[0.08] relative grid aspect-video place-items-center rounded">
        <span className="border-foreground/50 grid size-8 place-items-center rounded-full border text-[10px]">▶</span>
        <AdSlot className="absolute top-1.5 left-1.5 h-4" label="Ивээн тэтгэгч" />
      </div>
      <div className="mt-2 flex h-1 gap-0.5">
        <span className="border-foreground/50 bg-foreground/30 w-[14%] rounded-full border border-dashed" />
        <span className="bg-foreground/10 flex-1 rounded-full" />
      </div>
      <span className={cn(bar, "mt-2 block h-1.5 w-3/4")} />
    </div>
  )
}

/** A phone with an in-feed slot. */
export function PhoneMock() {
  return (
    <div className="bg-background mx-auto w-full overflow-hidden rounded-[1.4rem] border-4 border-foreground/70 shadow-2xl shadow-black/20">
      <div className="bg-foreground/70 mx-auto mt-1 h-1.5 w-10 rounded-full" />
      <div className="p-2.5">
        <span className="font-news text-[9px] font-semibold">EZ</span>
        <div className={cn(block, "mt-2 aspect-[4/3]")} />
        <span className={cn(bar, "mt-2 block h-1.5 w-full")} />
        <span className={cn(bar, "mt-1 block h-1.5 w-3/4")} />
        <AdSlot className="mt-2 h-10" />
        <div className="mt-2 flex flex-col gap-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-1.5">
              <div className={cn(block, "size-6 shrink-0")} />
              <div className="flex flex-1 flex-col gap-1 pt-0.5">
                <span className={cn(bar, "h-1 w-full")} />
                <span className={cn(bar, "h-1 w-1/2")} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A social post with the advertiser's mark. */
export function SocialMock() {
  return (
    <div className="bg-background overflow-hidden rounded-md border shadow-2xl shadow-black/20">
      <div className="flex items-center gap-1.5 p-2">
        <span className="bg-foreground/80 size-4 rounded-full" />
        <span className={cn(bar, "h-1.5 w-12")} />
      </div>
      <div className="bg-foreground/[0.08] relative aspect-square">
        <AdSlot className="absolute inset-x-3 bottom-3 h-6" label="Таны брэнд" />
      </div>
      <div className="flex gap-2 p-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="bg-foreground/15 size-2.5 rounded-full" />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Extra services: marketing, web development, branding, poster templates */
/* ------------------------------------------------------------------ */

/** Marketing: reach rising week by week. */
export function MarketingVisual() {
  const heights = [30, 38, 34, 50, 46, 62, 58, 76, 90]
  return (
    <div className="flex h-20 items-end gap-1.5">
      {heights.map((height, i) => (
        <span key={i} className={cn("flex-1 rounded-t-sm", i === heights.length - 1 ? "bg-foreground/70" : "bg-foreground/15")} style={{ height: `${height}%` }} />
      ))}
    </div>
  )
}

/** Web development: an editor with indented code lines. */
export function CodeVisual() {
  const lines: [number, number][] = [
    [0, 40], [1, 62], [2, 70], [1, 30], [2, 48], [0, 24],
  ]
  return (
    <div className="bg-background rounded-md border p-2.5 font-mono">
      <div className="mb-1.5 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="bg-foreground/20 size-1.5 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {lines.map(([indent, width], i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-muted-foreground w-3 text-right text-[7px] tabular-nums">{i + 1}</span>
            <span className={cn("h-1 rounded-full", i % 3 === 1 ? "bg-foreground/45" : "bg-foreground/15")} style={{ marginLeft: `${indent * 10}px`, width: `${width}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Branding: a mark, a type sample and a palette. */
export function BrandVisual() {
  return (
    <div className="flex h-20 items-center gap-4">
      <span className="bg-foreground text-background grid size-14 shrink-0 place-items-center rounded-xl font-news text-xl font-bold">Аа</span>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex gap-1.5">
          {["bg-foreground", "bg-foreground/60", "bg-foreground/30", "bg-foreground/10"].map((tone) => (
            <span key={tone} className={cn("h-6 flex-1 rounded-sm border", tone)} />
          ))}
        </div>
        <span className="bg-foreground/15 h-1.5 w-3/4 rounded-full" />
        <span className="bg-foreground/10 h-1.5 w-1/2 rounded-full" />
      </div>
    </div>
  )
}

/** Poster templates: three reusable layouts side by side. */
export function PosterTemplatesVisual() {
  return (
    <div className="grid h-20 grid-cols-3 gap-2">
      <div className="bg-foreground/80 flex flex-col justify-end gap-1 rounded-sm p-1.5">
        <span className="bg-background/70 h-1 w-3/4 rounded-full" />
        <span className="bg-background/40 h-1 w-1/2 rounded-full" />
      </div>
      <div className="flex flex-col gap-1 rounded-sm border p-1.5">
        <span className="bg-foreground/10 flex-1 rounded-sm" />
        <span className="bg-foreground/40 h-1 w-3/4 rounded-full" />
      </div>
      <div className="border-foreground/45 grid place-items-center rounded-sm border border-dashed">
        <span className="text-foreground/60 font-mono text-[7px] font-bold tracking-[0.15em] uppercase">Загвар</span>
      </div>
    </div>
  )
}
