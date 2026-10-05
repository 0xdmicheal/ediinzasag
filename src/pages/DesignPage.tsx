import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"

import { buttonClass, DeskChip, SimplyBox } from "@/components/ds/primitives"
import { ChangePill } from "@/components/site/market-charts"
import { UnitChip } from "@/components/site/money"
import { desks, type DeskId } from "@/design/desks"
import { storyArt, storyBySlug } from "@/content/stories"
import { top20 } from "@/content/markets"
import { publicUrl } from "@/lib/public-url"

/*
 * EZ design system, from Brand Book v2 (2026.10). Every token and component on
 * one page so new work stays on brand. Not linked from the nav.
 */

const alphabet = "АБВГДЕЁЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯ"

const families = [
  {
    name: "Geologica",
    role: "Гарчиг, тоо · Display & figures",
    rule: "800 · −2% tracking · 1.05 leading",
    className: "font-display text-ds-h2",
    sample: "Оюу Толгойн ногдол ашиг таны халаасанд хүрэх үү?",
  },
  {
    name: "Onest",
    role: "Текст, UI · Text & interface",
    rule: "400–700",
    className: "font-body text-ds-lead",
    sample: "Монголын эдийн засгийг энгийн хэлээр тайлбарлана.",
  },
  {
    name: "Literata",
    role: "Урт уншлага · Long reads",
    rule: "400 · 18–20px · 1.6 leading",
    className: "font-read text-[1.1875rem] leading-[1.6]",
    sample:
      "Энэ долоо хоногт Оюу Толгой ногдол ашгаа зарлалаа. Үүнийг ойлгохын тулд эхлээд хэн хувьцаа эзэмшдэгийг харъя.",
  },
  {
    name: "JetBrains Mono",
    role: "Тоо, ханш · Data & tickers",
    rule: "400–700 · always tabular",
    className: "font-mono text-ds-lead",
    sample: "ТОП-20 66,842.06 ▲0.49% · Эх сурвалж: МХБ · 2026.10.02",
  },
]

const scale = [
  ["ds-display", "72px", "text-ds-display"],
  ["ds-h1", "52px", "text-ds-h1"],
  ["ds-h2", "36px", "text-ds-h2"],
  ["ds-h3", "24px", "text-ds-h3"],
  ["ds-lead", "20px", "text-ds-lead"],
  ["ds-body", "16px", "text-ds-body"],
  ["ds-label", "13px", "text-ds-label"],
  ["ds-caption", "12px", "text-ds-caption"],
] as const

const primaries = [
  { name: "Black", hex: "#000000", role: "Text, dark fields", text: "#FFFFFF" },
  { name: "White", hex: "#FFFFFF", role: "Ground", text: "#000000" },
  { name: "Gray 500", hex: "#6C7584", role: "Secondary, graphics", text: "#000000" },
  { name: "Blue 500", hex: "#298DFF", role: "The accent", text: "#000000" },
] as const

const extended = {
  Blue: [
    ["900", "#00060F"], ["800", "#001129"], ["700", "#002E6A"], ["600", "#1759C4"], ["500*", "#298DFF"],
    ["400", "#5CA9FF"], ["300", "#8FCBFF"], ["200", "#BCE2FF"], ["100", "#DDF2FF"], ["50", "#F6FCFF"],
  ],
  Gray: [
    ["900", "#131518"], ["800", "#222529"], ["700", "#343940"], ["600", "#4B515B"], ["500*", "#6C7584"],
    ["400", "#89919F"], ["300", "#A1A7B2"], ["200", "#C2C6CD"], ["100", "#E0E2E6"], ["50", "#F4F5F7"],
  ],
} as const

/** Pairings the site actually uses, plus the two it must never use. */
const pairings = [
  { fg: "#000000", bg: "#298DFF", label: "Black on Blue 500", use: "Товч · buttons" },
  { fg: "#1759C4", bg: "#FFFFFF", label: "Blue 600 on White", use: "Холбоос · links, labels" },
  { fg: "#4B515B", bg: "#F4F5F7", label: "Gray 600 on Gray 50", use: "Туслах текст · muted text" },
  { fg: "#5CA9FF", bg: "#000000", label: "Blue 400 on Black", use: "Харанхуй горим · dark links" },
  { fg: "#FFFFFF", bg: "#298DFF", label: "White on Blue 500", use: "Хэрэглэхгүй · never" },
  { fg: "#6C7584", bg: "#F4F5F7", label: "Gray 500 on Gray 50", use: "Хэрэглэхгүй · never" },
] as const

/** WCAG 2 contrast ratio between two hex colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function grades(ratio: number) {
  return [
    ["Normal text", ratio >= 4.5 ? "AA" : "FAIL", ratio >= 7 ? "AAA" : "FAIL"],
    ["Large text", ratio >= 3 ? "AA" : "FAIL", ratio >= 4.5 ? "AAA" : "FAIL"],
    ["Graphics", ratio >= 3 ? "AA" : "FAIL", ratio >= 3 ? "AAA" : "FAIL"],
  ] as const
}

export function DesignPage() {
  const story = storyBySlug("oyu-tolgoi-dividend") ?? storyBySlug("mse-friday-close")
  const art = story ? storyArt(story.slug) : null

  return (
    <div className="font-body mx-auto flex max-w-[1200px] flex-col gap-20 px-4 pt-10 pb-24 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-brand-strong font-mono text-[12px] uppercase">EZ · Brand book v2 · 2026.10</p>
          <h1 className="font-display text-ds-h1 mt-3 text-balance">Эдийн засаг is easy.</h1>
          <p className="text-ds-lead text-muted-foreground mt-4">
            Дөрвөн үндсэн өнгө, дөрвөн фонт, нэг дуу хоолой. Шинэ хуудас бүр эндээс эхэлнэ.
          </p>
        </div>
        <div className="flex gap-3">
          <span className="bg-background grid h-20 place-items-center rounded-lg border px-5">
            <img src={publicUrl("brand/logo-black.png")} alt="Эдийн засаг" className="h-8 w-auto dark:hidden" />
            <img src={publicUrl("brand/logo-white.png")} alt="" className="hidden h-8 w-auto dark:block" />
          </span>
          <span className="bg-brand grid h-20 place-items-center rounded-lg px-5">
            <img src={publicUrl("brand/logo-white.png")} alt="" className="h-8 w-auto" />
          </span>
        </div>
      </header>

      <Block title="Өнгө" note="Black, White, Gray 500, Blue 500. Ногоон, улаан зөвхөн ханшид.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {primaries.map((color) => (
            <div
              key={color.name}
              className="flex h-36 flex-col justify-between rounded-lg border p-4"
              style={{ background: color.hex, color: color.text }}
            >
              <p className="font-display text-ds-h3">{color.name}</p>
              <p className="font-mono text-[12px]">
                {color.hex} · {color.role}
              </p>
            </div>
          ))}
        </div>

        <h3 className="font-display text-ds-lead mt-10">Өргөтгөсөн палитр · Extended palette</h3>
        <p className="text-muted-foreground text-ds-label mt-1">Вэб, диаграм, зурагт уян хатан хэрэглэнэ. * = үндсэн өнгө.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(Object.keys(extended) as (keyof typeof extended)[]).map((family) => (
            <ul key={family} className="overflow-hidden rounded-lg border">
              {extended[family].map(([step, hex], index) => (
                <li
                  key={step}
                  className="flex h-12 items-center justify-between px-4 font-mono text-[12px]"
                  style={{ background: hex, color: index < 5 ? "#FFFFFF" : "#000000" }}
                >
                  <span>
                    {family} {step}
                  </span>
                  <span>{hex}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>

        <h3 className="font-display text-ds-lead mt-10">Хүртээмж · Accessibility</h3>
        <p className="text-muted-foreground text-ds-label mt-1 max-w-3xl">
          Вэб болон интерактив хэрэглээнд өнгөний хослол бүр WCAG AA-г хангана, AAA-г зорино. AA-д тэнцэхгүй хослолыг хэрэглэхгүй.
          Харьцааг энд шууд тооцоолов.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pairings.map((pair) => {
            const ratio = contrast(pair.fg, pair.bg)
            const banned = ratio < 4.5
            return (
              <article key={pair.label} className="overflow-hidden rounded-lg border">
                <div className="grid h-28 place-items-center" style={{ background: pair.bg, color: pair.fg }}>
                  <span className="font-display text-[2.5rem] leading-none">{ratio.toFixed(2)}:1</span>
                </div>
                <div className="bg-card p-4">
                  <p className="text-ds-label font-semibold">{pair.label}</p>
                  <p className={`text-ds-caption mt-0.5 ${banned ? "text-[var(--down)]" : "text-muted-foreground"}`}>{pair.use}</p>
                  <table className="mt-3 w-full font-mono text-[11px]">
                    <tbody>
                      {grades(ratio).map(([row, aa, aaa]) => (
                        <tr key={row}>
                          <td className="py-0.5">{row}</td>
                          {[aa, aaa].map((grade, i) => (
                            <td key={i} className="w-14 py-0.5 text-right">
                              <span
                                className={`inline-block w-12 rounded-sm px-1 text-center ${grade === "FAIL" ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200" : "bg-blue-200 text-blue-700"}`}
                              >
                                {grade}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-wrap items-center gap-4 font-mono text-[12px]">
            <span className="flex items-center gap-2">
              <span className="size-8 rounded-md bg-[var(--up)]" /> ▲ up #087A4B
            </span>
            <span className="flex items-center gap-2">
              <span className="size-8 rounded-md bg-[var(--down)]" /> ▼ down #C2380F
            </span>
          </div>
          <p className="text-ds-label text-muted-foreground">
            Графикт: цэнхэр = өсөлт, саарал = бууралт. Өөрчлөлт бүр ▲/▼ тэмдэгтэй тул зөвхөн өнгөнд найддаггүй.
          </p>
        </div>
      </Block>

      <Block title="Үсэг" note="Дөрвөн фонт бүгд Ө ө Ү ү-г бүрэн дэмжинэ.">
        <ul className="divide-y border-y">
          {families.map((family) => (
            <li key={family.name} className="grid gap-3 py-6 lg:grid-cols-[16rem_1fr]">
              <div>
                <p className="font-semibold">{family.name}</p>
                <p className="text-muted-foreground text-ds-label">{family.role}</p>
                <p className="text-brand-strong mt-1 font-mono text-[11px]">{family.rule}</p>
              </div>
              <div className="min-w-0">
                <p className={`${family.className} text-balance`}>{family.sample}</p>
                <p className={`${family.className} text-muted-foreground mt-2 truncate !text-ds-body`}>{alphabet}</p>
              </div>
            </li>
          ))}
        </ul>
        <ul className="mt-8 divide-y border-y">
          {scale.map(([name, size, cls]) => (
            <li key={name} className="grid items-baseline gap-2 py-3 sm:grid-cols-[10rem_1fr]">
              <span className="text-muted-foreground font-mono text-[11px]">
                {name} · {size}
              </span>
              <span className={`${cls} ${/h\d|display/.test(cls) ? "font-display" : ""} truncate`}>Хөрөнгийн зах зээл</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Зураг" note="Бодит газар, байгалийн өнгөөр. Шүүлтүүр хэрэглэхгүй. Үргэлж эх сурвалжтай.">
        {art ? (
          <figure>
            <img src={art.src} alt={art.alt} className="aspect-[21/9] w-full rounded-lg object-cover" />
            <figcaption className="text-muted-foreground mt-2 font-mono text-[11px]">{art.alt} · Зураглал</figcaption>
          </figure>
        ) : null}
      </Block>

      <Block title="Бүрэлдэхүүн хэсэг" note="Бүх хуудас эдгээрээс бүтнэ.">
        <div className="grid gap-8 lg:grid-cols-2">
          <Specimen label="Дэд брэнд, ширээ">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(desks) as DeskId[]).map((id) => (
                <DeskChip key={id} desk={id} />
              ))}
            </div>
          </Specimen>
          <Specimen label="Ханшийн өөрчлөлт, нэгж">
            <div className="flex flex-wrap items-center gap-2">
              <ChangePill pct={0.49} />
              <ChangePill pct={-1.25} />
              <ChangePill pct={-0.06} />
              <UnitChip denom={{ kind: "money", currency: "MNT" }} />
              <UnitChip denom={{ kind: "money", currency: "USD" }} />
              <UnitChip denom={{ kind: "index" }} />
            </div>
          </Specimen>
          <Specimen label="Товч">
            <div className="flex flex-wrap items-center gap-2">
              <a href="#" className={buttonClass("primary")}>
                Унших <ArrowRight className="size-4" />
              </a>
              <a href="#" className={buttonClass("secondary")}>
                Захиалах
              </a>
              <a href="#" className={buttonClass("ghost")}>
                Бүх тойм
              </a>
            </div>
          </Specimen>
          <Specimen label="Энгийнээр">
            <SimplyBox desk="markets">{story?.dek ?? ""}</SimplyBox>
          </Specimen>
          <Specimen label="Тооны карт (brand p.14)" wide>
            <div className="bg-studio text-photo-foreground grid gap-6 rounded-lg p-6 sm:grid-cols-[1fr_1.2fr] sm:p-8">
              <div>
                <p className="text-photo-foreground/60 font-mono text-[12px]">ТОП-20 · 2026.10.02</p>
                <p className="font-display mt-2 text-[4.5rem] leading-none">66,842</p>
                <p className="mt-3 font-mono text-[14px] text-[#2fae74]">
                  ▲ {top20.move} · +{top20.pct}%
                </p>
              </div>
              <ul className="flex flex-col justify-center gap-3 font-mono text-[13px]">
                {[
                  ["Nasdaq", 1.19],
                  ["S&P 500", 0.73],
                  ["ТОП-20", 0.49],
                  ["Nikkei", -0.94],
                  ["Hang Seng", -2.6],
                ].map(([name, pct]) => {
                  const value = pct as number
                  const mongolia = name === "ТОП-20"
                  return (
                    <li key={name as string} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-3">
                      <span className={mongolia ? "text-blue-400" : ""}>{name}</span>
                      <span
                        className={`h-3 rounded-r-[4px] ${mongolia ? "bg-photo-foreground" : value >= 0 ? "bg-blue-500" : "bg-gray-600"}`}
                        style={{ width: `${(Math.abs(value) / 2.6) * 100}%` }}
                      />
                      <span className="text-right">{value > 0 ? `+${value}` : `−${Math.abs(value)}`}</span>
                    </li>
                  )
                })}
                <li className="text-photo-foreground/50 border-photo-foreground/15 mt-2 border-t pt-3 text-[11px]">
                  Цэнхэр = өсөлт · саарал = бууралт · цагаан = Монгол
                </li>
              </ul>
            </div>
          </Specimen>
        </div>
      </Block>

      <Block title="Дуу хоолой" note="Багш шиг. Найз шиг.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-5">
            <p className="font-mono text-[12px] text-[var(--up)]">✓ Ингэж бичнэ</p>
            <p className="font-read mt-2 text-ds-lead">“Монголбанк бодлогын хүүг хэвээр үлдээлээ. Таны зээлийн хүүд энэ юу гэсэн үг вэ?”</p>
          </div>
          <div className="rounded-lg border p-5">
            <p className="font-mono text-[12px] text-[var(--down)]">✕ Ингэхгүй</p>
            <p className="font-read text-muted-foreground mt-2 text-ds-lead line-through">“ШОК! Ханш нурлаа!!! Одоо л худалдаж ав!”</p>
          </div>
        </div>
      </Block>
    </div>
  )
}

function Block({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <h2 className="font-display text-ds-h3">{title}</h2>
        <p className="text-ds-label text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  )
}

function Specimen({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "lg:col-span-2" : ""}>
      <p className="text-brand-strong mb-3 font-mono text-[11px] uppercase">{label}</p>
      {children}
    </div>
  )
}
