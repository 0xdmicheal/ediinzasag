import { FaFacebookF, FaInstagram, FaLink, FaTelegram, FaXTwitter, FaYoutube } from "react-icons/fa6"
import { SiSubstack } from "react-icons/si"
import { Link } from "react-router-dom"

import { channels } from "@/content/channels"
import { Button } from "@/components/ui/button"

const channelsList = [
  { label: "YouTube", href: channels.youtube, icon: FaYoutube },
  { label: "Substack", href: channels.substack, icon: SiSubstack },
  { label: "Telegram", href: channels.telegram, icon: FaTelegram },
  { label: "Facebook", href: channels.facebook, icon: FaFacebookF },
  { label: "Instagram", href: channels.instagram, icon: FaInstagram },
  { label: "X", href: channels.x, icon: FaXTwitter },
  { label: "Linktree", href: channels.linktree, icon: FaLink },
  { label: "EZ Talk", to: "/ez-talk" },
] as const

const facts = [
  ["Тойм", "Монголын эдийн засаг, дэлхийн зах зээл нэг тавцан дээр."],
  ["Тоо", "Тоо бүрт огноо, нэрлэсэн эх сурвалж. Гэрээний нарийн хувь, албан бус ишлэлийг зохиодоггүй."],
  ["EZ Talk", "Эдийн засагч Nio, зах зээлийн шинжээч Ulemj. Дугаар эхлээд YouTube дээр гарна."],
  ["Нийтлэл", "Захидал энэ сайт дээр уншигдана. Захиалга Substack дээр баталгаажна."],
] as const

const partnerTopics = ["Зочин дугаар", "Брэнд", "Судалгаа"] as const

export function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-muted-foreground text-[11px] tracking-[0.22em] uppercase">Бид · {channels.domain}</p>
      <div className="mt-4 grid items-end gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
        <h1 className="font-news text-5xl leading-[0.95] sm:text-6xl">Эдийн засаг is easy.</h1>
        <div className="text-muted-foreground space-y-3 text-base leading-7">
          <p>
            EZ Эдийн засаг Монголын эдийн засаг, дэлхийн зах зээлийн тоймыг нэг ширээн дээр тавьдаг. Уншигч нь өрхийн орлого, төсөв, уурхай, хүүг хамт харахыг хүссэн хүн.
          </p>
          <p>
            Энэ сайт суваг, нийтлэл, өдрийн тоймын тавиур. Эхний тоймууд Монголбанк, Дэлхийн банк, ЕСБХБ, Bloomberg, Reuters, Eurostat зэрэг нийтийн мэдээллийг нэгтгэсэн.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <section id="contact" className="scroll-mt-24 flex flex-col justify-between rounded-lg border p-6 sm:p-8">
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase">Холбоо барих</p>
            <h2 className="font-news mt-3 text-4xl leading-tight">Шууд шугам Telegram.</h2>
            <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
              Асуулт, засвар, дугаар санал. Имэйл хаяг нийтлээгүй. Эхлээд Telegram, бусад сувгаар бас хүрдэг.
            </p>
          </div>
          <Button asChild className="mt-8 w-fit">
            <a href={channels.telegram} target="_blank" rel="noreferrer">
              <FaTelegram />
              Telegram нээх
            </a>
          </Button>
        </section>

        <section
          id="partner"
          className="scroll-mt-24 flex flex-col justify-between rounded-lg border bg-ink p-6 text-ink-foreground sm:p-8"
        >
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase">Хамтрах</p>
            <h2 className="font-news mt-3 text-4xl leading-tight">Зочин, брэнд, судалгаа.</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {partnerTopics.map((topic) => (
                <li key={topic} className="rounded-md border border-ink-foreground/25 px-3 py-1 text-xs tracking-wide">
                  {topic}
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-foreground/75">
              Нөхцөл, үнийг энд бичдэггүй. Хамтрах саналаа Telegram дээр ярина.
            </p>
          </div>
          <Button
            asChild
            className="mt-8 w-fit bg-brand text-brand-foreground hover:bg-brand/90"
          >
            <a href={channels.telegram} target="_blank" rel="noreferrer">
              Хамтрах санал
            </a>
          </Button>
        </section>
      </div>

      <dl
        id="standards"
        className="mt-4 grid scroll-mt-24 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4"
      >
        {facts.map(([title, body]) => (
          <div key={title} className="bg-background p-5">
            <dt className="text-[11px] tracking-[0.18em] uppercase">{title}</dt>
            <dd className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {channelsList.map((item) => {
          const Icon = "icon" in item ? item.icon : null
          const className = "flex h-full items-center justify-between gap-3 bg-background px-5 py-4 text-sm hover:bg-muted/60"
          const body = (
            <>
              <span className="inline-flex items-center gap-3">
                {Icon ? <Icon className="size-4" aria-hidden="true" /> : <span className="size-4" aria-hidden="true" />}
                {item.label}
              </span>
              <span className="text-muted-foreground">Нээх</span>
            </>
          )
          return (
            <li key={item.label}>
              {"to" in item ? (
                <Link to={item.to} className={className}>
                  {body}
                </Link>
              ) : (
                <a href={item.href} target="_blank" rel="noreferrer" className={className}>
                  {body}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
