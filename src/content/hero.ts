import { youtubeId } from "@/components/site/YoutubeFrame"
import { channels, episodes } from "@/content/channels"
import { byDate, deskLabel, formatStoryDate, storyArt, topicLabel } from "@/content/stories"
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
  return `${Math.round(seconds / 60)} мин`
}

export function heroSlides(): HeroSlide[] {
  const stories = byDate()
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
        imageAlt: art.alt,
        cta: { label: "Унших", to: `/story/${story.slug}` },
      }
    })

  const episode = episodes[0]
  const videoId = youtubeId(episode.href)
  const talk: HeroSlide = {
    id: "talk",
    kind: "talk",
    tab: "EZ Talk",
    kicker: `EZ Talk · ${episode.date} · ${minutes(episode.seconds)}`,
    title: episode.title,
    dek: "Nio, Ulemj. Шинэ дугаар YouTube дээр.",
    image: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : undefined,
    imageFallback: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
    imageAlt: "",
    cta: { label: "Үзэх", to: "/ez-talk" },
    secondary: { label: "YouTube", href: episode.href },
  }

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

  return [stories[0], talk, stories[1], letter, stories[2], partnerSlide].filter(
    (slide): slide is HeroSlide => Boolean(slide),
  )
}
