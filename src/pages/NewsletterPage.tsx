import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"

import { EpisodeThumb } from "@/components/site/home-sections"
import { SubstackShelf } from "@/components/site/SubstackShelf"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { channels, episodes } from "@/content/channels"
import { subscribeNewsletter } from "@/content/newsletter"
import { substackPosts } from "@/content/substack.posts"

export function NewsletterPage() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState("")

  // The address is saved on our side; an editor imports the list into Substack.
  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setState("sending")
    try {
      await subscribeNewsletter(String(new FormData(event.currentTarget).get("email") ?? ""))
      setState("done")
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Бүртгэж чадсангүй. Дахин оролдоно уу.")
      setState("idle")
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Substack</p>
          <h1 className="font-news mt-3 text-5xl">Нийтлэл</h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg leading-relaxed">
            Захидлууд энэ хуудсан дээр уншигдана. И-мэйлээ үлдээвэл шинэ захидал тань руу очно.
          </p>
        </div>
        {state === "done" ? (
          <div className="bg-card rounded-lg border p-6" role="status">
            <p className="text-sm font-medium">Баярлалаа!</p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              И-мэйлийг тань бүртгэлээ. Шинэ захидал гармагц тань руу очно.
            </p>
          </div>
        ) : (
          <form onSubmit={subscribe} className="bg-card rounded-lg border p-6">
            <label htmlFor="email" className="text-sm font-medium">
              И-мэйл
            </label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="name@email.com" className="mt-2" aria-invalid={error ? true : undefined} aria-describedby={error ? "email-error" : undefined} />
            {error ? (
              <p id="email-error" className="text-destructive mt-2 text-xs">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="mt-4" disabled={state === "sending"}>
              {state === "sending" ? "Илгээж байна…" : "Захиалах"}
            </Button>
            <p className="text-muted-foreground mt-3 text-xs">Хүссэн үедээ захиалгаа цуцлах боломжтой.</p>
          </form>
        )}
      </section>

      {/* The latest episode's thumbnail behind the text, faded to dark on the left and bottom so the title stays readable. */}
      <section className="bg-studio text-photo-foreground relative isolate mt-14 flex min-h-[16rem] flex-col justify-end overflow-hidden rounded-lg border p-6 sm:min-h-[20rem] sm:p-8">
        <EpisodeThumb episode={episodes[0]} quality="max" className="absolute inset-0 -z-10 size-full" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <p className="text-photo-foreground/70 text-[11px] tracking-[0.18em] uppercase">EZ Talk · {episodes[0].date}</p>
        <h2 className="font-news mt-2 max-w-2xl text-3xl leading-tight">{episodes[0].title}</h2>
        <Link to="/ez-talk" className="ez-glass-light mt-5 inline-flex h-10 w-fit items-center rounded-full px-5 text-[14px] font-medium text-[#131518]">
          Бүх дугаар
        </Link>
      </section>

      <section className="mt-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-news text-3xl">Сүүлийн нийтлэлүүд</h2>
            <p className="text-muted-foreground mt-2 text-sm">Нийтлэл дээр дарахад бүтэн эх нь энэ сайтад нээгдэнэ.</p>
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
