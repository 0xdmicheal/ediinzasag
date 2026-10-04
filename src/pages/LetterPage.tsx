import { Link, useParams } from "react-router-dom"

import { SubstackShelf } from "@/components/site/SubstackShelf"
import { formatStoryDate } from "@/content/stories"
import { substackPosts } from "@/content/substack.posts"

export function LetterPage() {
  const { slug = "" } = useParams()
  const post = substackPosts.find((item) => item.slug === slug)

  if (!post) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="font-news text-4xl">Захидал олдсонгүй</h1>
        <Link to="/newsletter" className="mt-4 inline-block underline">
          Нийтлэл лүү
        </Link>
      </section>
    )
  }

  const more = substackPosts.filter((item) => item.slug !== post.slug).slice(0, 3)

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
        <Link to="/newsletter" className="hover:text-foreground">
          Нийтлэл
        </Link>
        {post.author ? ` · ${post.author}` : ""}
      </p>
      <h1 className="font-news mt-3 text-4xl leading-tight sm:text-5xl">{post.title}</h1>
      {post.excerpt ? <p className="mt-4 text-xl leading-relaxed">{post.excerpt}</p> : null}
      <p className="text-muted-foreground mt-4 text-sm">
        {/^\d{4}-\d{2}-\d{2}$/.test(post.date) ? formatStoryDate(post.date) : post.date}
      </p>
      {post.image ? (
        <img src={post.image} alt="" className="mt-8 aspect-[16/9] w-full object-cover" referrerPolicy="no-referrer" />
      ) : null}
      {post.html ? (
        <div
          className="mt-8 text-[1.05rem] leading-8 [&_a]:underline [&_h3]:font-news [&_h3]:mt-8 [&_h3]:text-2xl [&_img]:my-6 [&_img]:w-full [&_li]:ml-5 [&_ol]:my-4 [&_ol]:list-decimal [&_p]:mt-4 [&_ul]:my-4 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      ) : null}
      {more.length > 0 ? (
        <section className="mt-14">
          <h2 className="font-news text-2xl">Бусад захидал</h2>
          <div className="mt-4">
            <SubstackShelf posts={more} layout="list" />
          </div>
        </section>
      ) : null}
    </article>
  )
}
