import { youtubeId } from "@/components/site/YoutubeFrame"
import { publicUrl } from "@/lib/public-url"
import { channels, type Episode } from "@/content/channels"
import { deskLabel, formatStoryDate, storyArt, topicLabel, type Story } from "@/content/stories"
import { substackPosts } from "@/content/substack.posts"

export interface HeroSlide {
  id: string
  kind: "story" | "talk" | "letter" | "partner"
  /** Short label for the slide list beside the stage. */
  tab: string
  kicker: string
  title: string
  dek?: string
  image?: string
  /** Fallback when the first image fails, e.g. a YouTube video without a maxres thumbnail. */
  imageFallback?: string
  imageAlt?: string
  cta: { label: string; to: string }
  secondary?: { label: string; href: string }
}

/**
 * The sponsor / partner slot. Swap the copy and link here to run a campaign;
 * set `image` to a file in public/ (via publicUrl) for a branded visual.
 */
export const partnerSlide: HeroSlide = {
  id: "partner",
  kind: "partner",
  tab: "Хамтрах",
  kicker: "Хамтрах · Сурталчилгаа",
  title: "Таны брэнд эдийн засгийг дагадаг уншигчдын өмнө.",
  dek: "Сайт, EZ Talk, Substack, Telegram нэг багцаар. Зочин дугаар, ивээн тэтгэх тойм, судалгааны хамтын ажил.",
  cta: { label: "Хамтрах санал", to: "/about#partner" },
  secondary: { label: "Telegram", href: channels.telegram },
}

function minutes(seconds: number) {
  if (seconds <= 0) return "" // live feed items carry no duration.
  return `${Math.round(seconds / 60)} мин`
}

/**
 * The hero showcase, built from live content: the newest articles (admin-
 * published and built-in, whichever are most recent) and the latest YouTube
 * upload. Pass the already-sorted story list (newest first) and the newest
 * episode. New uploads flow in automatically; no manual hero editing.
 */
export function heroSlides(stories: Story[], episode: Episode | undefined): HeroSlide[] {
  const storySlides = stories
    .slice(0, 3)
    .map<HeroSlide>((story) => {
      const art = storyArt(story.slug)
      return {
        id: `story-${story.slug}`,
        kind: "story",
        tab: `${deskLabel[story.desk]} · ${topicLabel[story.topic]}`,
        kicker: `${deskLabel[story.desk]} · ${topicLabel[story.topic]} · ${formatStoryDate(story.date)}`,
        title: story.title,
        dek: story.dek,
        image: art.src,
        imageFallback: publicUrl("og.png"), // admin article without a cover: degrade to the brand image.
        imageAlt: art.alt,
        cta: { label: "Унших", to: `/story/${story.slug}` },
      }
    })

  const videoId = episode ? youtubeId(episode.href) : ""
  const talk: HeroSlide | null = episode
    ? {
        id: "talk",
        kind: "talk",
        tab: "EZ Talk",
        kicker: `EZ Talk · ${episode.date}${episode.seconds > 0 ? ` · ${minutes(episode.seconds)}` : ""}`,
        title: episode.title,
        dek: "Nio, Ulemj. Шинэ дугаар YouTube дээр.",
        image: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : undefined,
        imageFallback: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        imageAlt: "",
        cta: { label: "Үзэх", to: "/ez-talk" },
        secondary: { label: "YouTube", href: episode.href },
      }
    : null

  const post = substackPosts[0]
  const letter: HeroSlide | null = post
    ? {
        id: `letter-${post.slug}`,
        kind: "letter",
        tab: "Нийтлэл",
        kicker: "Нийтлэл · Substack",
        title: post.title,
        dek: post.excerpt,
        image: post.image || undefined,
        imageAlt: "",
        cta: { label: "Унших", to: `/letter/${post.slug}` },
        secondary: { label: "Subscribe", href: channels.substackSubscribe },
      }
    : null

  return [storySlides[0], talk, storySlides[1], letter, storySlides[2], partnerSlide].filter(
    (slide): slide is HeroSlide => Boolean(slide),
  )
}
