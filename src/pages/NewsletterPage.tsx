import { type FormEvent } from "react"
import { Link } from "react-router-dom"

import { SubstackShelf } from "@/components/site/SubstackShelf"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { channels, episodes } from "@/content/channels"
import { substackPosts } from "@/content/substack.posts"

export function NewsletterPage() {
  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.open(channels.substackSubscribe, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Substack</p>
          <h1 className="font-news mt-3 text-5xl">Нийтлэл</h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg leading-relaxed">
            Захидлууд энэ хуудсан дээр уншигдана. Захиалга Substack дээр баталгаажна.
          </p>
        </div>
        <form onSubmit={subscribe} className="border p-6">
          <label htmlFor="email" className="text-sm font-medium">
            И-мэйл
          </label>
          <Input id="email" name="email" type="email" required placeholder="name@email.com" className="mt-2" />
          <Button type="submit" className="mt-4">
            Subscribe
          </Button>
          <p className="text-muted-foreground mt-3 text-xs">
            Товчлуурыг дарахад Substack-ийн захиалгын хуудас нээгдэнэ.
          </p>
        </form>
      </section>

      <section className="mt-14 border p-6">
        <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">EZ Talk · {episodes[0].date}</p>
        <h2 className="font-news mt-2 text-3xl leading-tight">{episodes[0].title}</h2>
        <Button asChild className="mt-5 w-fit">
          <Link to="/ez-talk">Бүх дугаар</Link>
        </Button>
      </section>

      <section className="mt-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-news text-3xl">Сүүлийн захидлууд</h2>
            <p className="text-muted-foreground mt-2 text-sm">Захидал дээр дарахад бүтэн эх нь энэ сайтад нээгдэнэ.</p>
          </div>
          <Button asChild variant="outline" className="w-fit">
            <a href={channels.substack} target="_blank" rel="noreferrer">
              niots.substack.com
            </a>
          </Button>
        </div>
        <div className="mt-6">
          <SubstackShelf posts={substackPosts.slice(0, 12)} layout="list" />
        </div>
      </section>
    </div>
  )
}
