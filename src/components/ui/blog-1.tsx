import { Fragment } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlogPostAuthor {
  name: string;
  role: string;
}

interface BlogPost {
  date: string;
  title: string;
  author: BlogPostAuthor;
  href?: string;
  imageSrc?: string;
  imageAlt?: string;
}

interface BlogSectionHeader {
  badge: string;
  heading: string;
  description?: string;
  ctaText: string;
  ctaHref: string;
}

interface Blog1Props {
  id?: string;
  header: BlogSectionHeader;
  posts: BlogPost[];
  className?: string;
  /** Optional render override for the CTA link */
  renderCtaLink?: (props: {
    href: string;
    children: React.ReactNode;
  }) => React.ReactNode;
  /** Optional render override for individual card links */
  renderCardLink?: (props: {
    href: string;
    children: React.ReactNode;
  }) => React.ReactNode;
}

export default function Blog1({
  id,
  header,
  posts,
  className,
  renderCtaLink,
  renderCardLink,
}: Blog1Props) {
  const ctaContent = (
    <span className="group/cta inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-primary">
      {header.ctaText}
      <ArrowUpRight className="size-4 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
    </span>
  );

  return (
    <section
      id={id}
      className={cn(
        "w-full h-full bg-background px-4 py-8 flex justify-center items-center",
        className,
      )}
    >
      <div className="w-full">
        <div className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl space-y-3">
            <p className="text-muted-foreground text-[11px] tracking-[0.22em] uppercase">{header.badge}</p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl md:text-[2.75rem]">
              {header.heading}
            </h2>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 md:items-end md:text-right">
            {header.description ? (
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
                {header.description}
              </p>
            ) : null}

            {renderCtaLink ? (
              renderCtaLink({ href: header.ctaHref, children: ctaContent })
            ) : (
              <a href={header.ctaHref}>{ctaContent}</a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => {
            const card = (
              <div
                className={cn(
                  "group bg-muted/50 relative flex h-full flex-col overflow-hidden rounded-none shadow-[inset_0_0_2px_2px_rgba(255,255,255,1),inset_0_0_0_1px_rgba(0,0,0,0.2),0px_0px_0px_1px_rgba(0,0,0,0.08),0px_1px_2px_-1px_rgba(0,0,0,0.08),0px_2px_4px_0px_rgba(0,0,0,0.06)] duration-300 dark:shadow-[inset_0_0_2px_2px_rgba(255,255,255,0.04),inset_0_0_0_1px_rgba(255,255,255,0.08),0px_0px_0px_1px_rgba(255,255,255,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.5),0px_2px_4px_0px_rgba(0,0,0,0.4)]",
                )}
              >
                <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-muted">
                  {post.imageSrc ? (
                    <img
                      src={post.imageSrc}
                      alt={post.imageAlt ?? ""}
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-6">
                <span className="text-muted-foreground/70 line-clamp-1 text-sm font-medium">
                  {post.date}
                </span>

                <h3 className="text-foreground mt-4 line-clamp-3 h-[4.65rem] text-lg leading-snug font-medium">
                  {post.title}
                </h3>

                <div className="mt-auto flex items-end justify-between pt-8">
                  <div className="min-w-0 leading-tight">
                    <p className="text-primary text-md line-clamp-1 font-medium">
                      {post.author.name}
                    </p>
                    <p className="text-muted-foreground line-clamp-1 text-sm">
                      {post.author.role}
                    </p>
                  </div>

                  <div className="border-border bg-background text-muted-foreground group-hover:border-foreground/20 group-hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-none border transition-colors">
                    <ArrowUpRight className="size-3.5" />
                  </div>
                </div>
                </div>
              </div>
            );

            if (renderCardLink && post.href) {
              return (
                <Fragment key={post.href}>
                  {renderCardLink({
                    href: post.href,
                    children: card,
                  })}
                </Fragment>
              );
            }

            if (post.href) {
              return (
                <a
                  key={index}
                  href={post.href}
                  className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
                >
                  {card}
                </a>
              );
            }

            return card;
          })}
        </div>
      </div>
    </section>
  );
}
