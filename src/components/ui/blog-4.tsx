"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  Heart,
  type LucideIcon,
  UserRound,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Blog4Accent = "violet" | "green" | "blue";

export interface Blog5Article {
  category: string;
  readTime: string;
  title: string;
  href?: string;
  accent: Blog4Accent;
  imageSrc: string;
  imageAlt: string;
  icon: LucideIcon;
}

export interface Blog4Data {
  badge: string;
  heading: string;
  description?: string;
  viewAllLabel: string;
  viewAllHref: string;
  aside?: string;
  readLabel?: string;
  articles: Blog5Article[];
  activeSlide?: number;
  slideCount?: number;
}

export interface Blog4Props {
  id?: string;
  data?: Blog4Data;
  className?: string;
  renderViewAllLink?: (props: {
    href: string;
    children: ReactNode;
  }) => ReactNode;
  renderArticleLink?: (props: {
    href: string;
    children: ReactNode;
  }) => ReactNode;
}

const accentClasses: Record<
  Blog4Accent,
  {
    dot: string;
    iconTile: string;
    icon: string;
    cta: string;
    ctaText: string;
  }
> = {
  violet: {
    dot: "bg-violet-500",
    iconTile: "bg-violet-100 dark:bg-violet-500/20",
    icon: "text-violet-700 dark:text-violet-300",
    cta: "bg-violet-50 hover:bg-violet-100 dark:bg-violet-500/10 dark:hover:bg-violet-500/20",
    ctaText: "text-violet-700 dark:text-violet-300",
  },
  green: {
    dot: "bg-green-500",
    iconTile: "bg-green-100 dark:bg-green-500/20",
    icon: "text-green-700 dark:text-green-300",
    cta: "bg-green-50 hover:bg-green-100 dark:bg-green-500/10 dark:hover:bg-green-500/20",
    ctaText: "text-green-700 dark:text-green-300",
  },
  blue: {
    dot: "bg-blue-500",
    iconTile: "bg-blue-100 dark:bg-blue-500/20",
    icon: "text-blue-700 dark:text-blue-300",
    cta: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20",
    ctaText: "text-blue-700 dark:text-blue-300",
  },
};

const defaultBlog4Data: Blog4Data = {
  badge: "RESOURCES",
  heading: "Design systems and\nfrontend engineering",
  description:
    "Guides, patterns, and practical insights for building scalable modern interfaces.",
  viewAllLabel: "Browse all posts",
  viewAllHref: "#",
  activeSlide: 0,
  slideCount: 3,
  articles: [
    {
      category: "Design Systems",
      readTime: "7 min read",
      title: "How semantic color tokens make large UI systems easier to scale",
      href: "#",
      accent: "violet",
      imageSrc:
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
      icon: UsersRound,
      imageAlt: "Developer workspace with monitor and keyboard",
    },
    {
      category: "Frontend",
      readTime: "5 min read",
      title: "Building cleaner dashboards with spacing, hierarchy, and motion",
      href: "#",
      accent: "green",
      imageSrc:
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80",
      icon: Heart,
      imageAlt: "Modern UI dashboard on laptop screen",
    },
    {
      category: "Performance",
      readTime: "6 min read",
      title: "Simple ways to improve perceived performance in React apps",
      href: "#",
      accent: "blue",
      imageSrc:
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80",
      icon: UserRound,
      imageAlt: "Code editor open on a desktop setup",
    },
  ],
};

export default function Blog4({
  id,
  data = defaultBlog4Data,
  className,
  renderViewAllLink,
  renderArticleLink,
}: Blog4Props) {
  const viewAll = (
    <Button
      asChild
      variant="ghost"
      className="text-foreground h-auto rounded-none border-b px-0 pb-3 text-lg font-semibold hover:bg-transparent"
    >
      <span>
        {data.viewAllLabel}
        <ArrowRight className="ml-4 size-5" />
      </span>
    </Button>
  );

  return (
    <section id={id} className={cn("bg-muted/30 w-full py-8", className)}>
      <div className="w-full px-4 sm:px-6 xl:px-[440px]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-news text-foreground max-w-xl text-3xl leading-tight font-medium">
              {data.heading}
            </h2>

            {data.description ? (
              <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
                {data.description}
              </p>
            ) : null}
          </div>

          <div>
            {data.aside ? (
              <p className="text-muted-foreground max-w-sm text-lg leading-relaxed">
                {data.aside}
              </p>
            ) : null}
            <div className={data.aside ? "mt-10 w-fit" : "w-fit"}>
              {renderViewAllLink ? (
                renderViewAllLink({
                  href: data.viewAllHref,
                  children: viewAll,
                })
              ) : (
                <a href={data.viewAllHref}>{viewAll}</a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-4">
          {data.articles.map((article) => (
            <Blog5ArticleCard
              key={`${article.category}-${article.title}`}
              article={article}
              readLabel={data.readLabel}
              renderArticleLink={renderArticleLink}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Blog5ArticleCard({
  article,
  readLabel = "Read article",
  renderArticleLink,
}: {
  article: Blog5Article;
  readLabel?: string;
  renderArticleLink?: Blog4Props["renderArticleLink"];
}) {
  const accent = accentClasses[article.accent];

  const card = (
    <Card className="group border-border bg-card flex h-full flex-col overflow-hidden rounded-2xl pt-0 pb-4 shadow-sm transition-all hover:shadow-md">
      <div className="relative h-60 overflow-hidden sm:h-64 dark:mask-b-from-50%">
        <img
          src={article.imageSrc}
          alt={article.imageAlt}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className={cn("size-2 rounded-full", accent.dot)} />
            <span className="font-medium">{article.category}</span>
          </div>
          <span className="text-muted-foreground shrink-0 text-sm">
            {article.readTime}
          </span>
        </div>

        <h3 className="text-foreground mt-2 mb-2 text-xl font-semibold tracking-tight">
          {article.title}
        </h3>

        <div className="mt-auto">
          <span className={cn("flex items-center gap-0.5 text-sm font-medium", accent.ctaText)}>
            {readLabel}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (renderArticleLink && article.href) {
    return renderArticleLink({ href: article.href, children: card });
  }

  if (article.href) {
    return (
      <a
        href={article.href}
        className="focus-visible:ring-ring block rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {card}
      </a>
    );
  }

  return card;
}
