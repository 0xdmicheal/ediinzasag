import BoringAvatar from "boring-avatars"
import { Shapes, Shuffle, Smile, UserRound } from "lucide-react"

/*
 * Profile pictures, drawn in the browser by boring-avatars (MIT): a face
 * ("beam") or abstract shapes ("bauhaus"). A reader's picture is stored as
 * "<style>:<seed>"; readers who never picked one get a face from their name.
 * Anonymous "Зочин" gets a plain silhouette, so nothing gives them away.
 */

export type AvatarStyle = "beam" | "bauhaus"

export const avatarStyles: { id: AvatarStyle; label: string; icon: typeof Smile }[] = [
  { id: "beam", label: "Нүүр", icon: Smile },
  { id: "bauhaus", label: "Дүрс", icon: Shapes },
]

/** Brand blue, warm accents and the studio dark. */
const palette = ["#298dff", "#ffb84d", "#ff6b4a", "#2ec4b6", "#1b2a41"]

export function parseAvatar(avatar: string | undefined, fallbackSeed: string): { style: AvatarStyle; seed: string } {
  const match = /^(beam|bauhaus):(.+)$/.exec(avatar ?? "")
  return match ? { style: match[1] as AvatarStyle, seed: match[2] } : { style: "beam", seed: fallbackSeed.trim().toLowerCase() || "?" }
}

export const formatAvatar = (style: AvatarStyle, seed: string) => `${style}:${seed}`

/** A fresh random seed for "shuffle"; random, so it says nothing about the reader. */
export function randomSeed() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => byte.toString(36).padStart(2, "0")).join("")
}

const sizes = { sm: 28, md: 32, lg: 64, xl: 128 } as const

export function ReaderAvatar({
  name,
  avatar,
  anonymous = false,
  size = "md",
}: {
  /** Seed for readers who never picked a picture. */
  name: string
  /** "<style>:<seed>", or empty for the default face. */
  avatar?: string
  anonymous?: boolean
  size?: keyof typeof sizes
}) {
  const px = sizes[size]
  if (anonymous) {
    return (
      <span className="bg-muted text-muted-foreground grid shrink-0 place-items-center rounded-full" style={{ width: px, height: px }} aria-hidden>
        <UserRound style={{ width: px * 0.5, height: px * 0.5 }} />
      </span>
    )
  }
  const { style, seed } = parseAvatar(avatar, name)
  return (
    <span className="block shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]" style={{ width: px, height: px }} aria-hidden>
      <BoringAvatar variant={style} name={seed} colors={palette} size={px} />
    </span>
  )
}

/**
 * Choose a picture: faces or shapes, and shuffle for a new one. `compact`
 * is a single row for phones and tight spots.
 */
export function AvatarPicker({
  name,
  value,
  onChange,
  compact = false,
}: {
  name: string
  value: string
  onChange: (avatar: string) => void
  compact?: boolean
}) {
  const { style, seed } = parseAvatar(value, name)
  const styleButtons = (
    <div role="radiogroup" aria-label="Зургийн төрөл" className="bg-muted inline-flex gap-1 rounded-full p-1">
      {avatarStyles.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={style === item.id}
          onClick={() => onChange(formatAvatar(item.id, seed))}
          className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors ${style === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          <item.icon className="size-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  )
  const shuffle = (
    <button
      type="button"
      onClick={() => onChange(formatAvatar(style, randomSeed()))}
      className="border-foreground/15 hover:bg-foreground/5 inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors"
    >
      <Shuffle className="size-4" />
      Өөр зураг
    </button>
  )

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <ReaderAvatar name={name} avatar={value} size="lg" />
        <div className="flex min-w-0 flex-col items-start gap-2">
          {styleButtons}
          <button
            type="button"
            onClick={() => onChange(formatAvatar(style, randomSeed()))}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12px] font-medium"
          >
            <Shuffle className="size-3.5" />
            Өөр зураг
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <ReaderAvatar name={name} avatar={value} size="xl" />
      {styleButtons}
      {shuffle}
    </div>
  )
}
