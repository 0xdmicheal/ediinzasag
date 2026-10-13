import { useState, type CSSProperties } from "react"
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { cn } from "cn"
import {
  BookMarked,
  BookOpen,
  Compass,
  Flame,
  Globe,
  Library,
  LibraryBig,
  LogOut,
  Pencil,
  Trophy,
  VenetianMask,
  type LucideIcon,
} from "lucide-react"

import { buttonClass } from "@/admin/ui"
import { ContinuousTabs } from "@/components/ui/continuous-tabs"
import { EditProfile, type ProfileValues } from "@/components/ui/edit-profile"
import { POINTS_PER_ACHIEVEMENT, POINTS_PER_READ, readerProgress, type AchievementIcon } from "@/reader/achievements"
import { BadgeMark } from "@/reader/badges"
import { BadgeShop } from "@/reader/BadgeShop"
import { LibraryList } from "@/reader/LibraryList"
import { useLibraryItems } from "@/reader/library-items"
import { formatPhone } from "@/reader/phone"
import { ReaderAvatar } from "@/reader/ReaderAvatar"
import { useReader } from "@/reader/session"

type Tab = "saved" | "read"

const icons: Record<AchievementIcon, LucideIcon> = {
  book: BookOpen,
  books: Library,
  library: LibraryBig,
  globe: Globe,
  compass: Compass,
  bookmark: BookMarked,
  flame: Flame,
  trophy: Trophy,
}

/** Each achievement's own colours (light → deep). */
const achievementColors: Record<AchievementIcon, [string, string]> = {
  book: ["#38bdf8", "#2563eb"],
  books: ["#a78bfa", "#7c3aed"],
  library: ["#f472b6", "#be185d"],
  globe: ["#2dd4bf", "#0f766e"],
  compass: ["#fbbf24", "#d97706"],
  bookmark: ["#fb923c", "#ea580c"],
  flame: ["#f87171", "#dc2626"],
  trophy: ["#fde047", "#ca8a04"],
}

/** Sparks when the mask lands: brand blues with a little white. */
const MASK_SPARKS = ["#298dff", "#5ca9ff", "#ffffff", "#1759c4", "#9cc9ff", "#298dff", "#ffffff", "#5ca9ff"]

/**
 * Guest mode under the reader's e-mail, always in place so the header never
 * changes height: the label and its switch sit faint when off and at full
 * strength when on. Saved the moment it is flipped (new comments show «Зочин»),
 * and rolled back if saving fails.
 */
function GuestSwitch({ on, onChange }: { on: boolean; onChange: (next: boolean) => Promise<void> }) {
  const [shown, setShown] = useState(on)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function flip() {
    const next = !shown
    setShown(next)
    setBusy(true)
    setFailed(false)
    try {
      await onChange(next)
    } catch {
      setShown(!next)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-busy={busy}
      title={failed ? "Хадгалж чадсангүй. Дахин оролдоно уу." : shown ? "Шинэ сэтгэгдэл «Зочин» нэрээр гарна" : "Сэтгэгдэлд нэрээ нуух"}
      onClick={flip}
      className={`ez-hit mt-1 inline-flex h-7 items-center gap-2 rounded-full text-[12.5px] font-medium transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-40 hover:opacity-70"} ${failed ? "text-[var(--down)]" : ""}`}
    >
      <VenetianMask className="size-4" />
      Зочин горим
      <span className={`relative h-5 w-8 shrink-0 rounded-full transition-colors duration-200 ${shown ? "bg-foreground" : "bg-foreground/30"}`}>
        <span className={`bg-background absolute top-0.5 left-0.5 size-4 rounded-full shadow-sm transition-transform duration-200 ${shown ? "translate-x-3" : ""}`} />
      </span>
    </button>
  )
}

/** The signed-in reader's profile: points, achievements, saved and read stories, settings. */
export function AccountPage() {
  const { auth, reader, refresh, reads, saved } = useReader()
  const items = useLibraryItems()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const resetting = params.get("reset") === "1"
  const [tab, setTab] = useState<Tab>("saved")
  const [guestPreview, setGuestPreview] = useState<boolean | null>(null)
  /** The last guest-mode flip, which picks and replays the picture's animation. */
  const [flip, setFlip] = useState<{ dir: "in" | "out"; n: number } | null>(null)
  // A password-reset link, or "солих" under the comment box, opens the edit dialog straight away.
  const [editing, setEditing] = useState(resetting || Boolean((location.state as { edit?: boolean } | null)?.edit))

  if (reader === undefined || !auth) {
    return <p className="text-muted-foreground mx-auto max-w-3xl px-4 py-20 text-sm sm:px-6">Ачаалж байна…</p>
  }
  if (!reader) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  const masked = guestPreview ?? reader.anonymous
  const progress = readerProgress(reads, saved, items)
  const avatarSeed = reader.name || reader.email || reader.phone
  const contact = [reader.email, reader.phone && formatPhone(reader.phone)].filter(Boolean).join(" · ")

  async function signOut() {
    await auth!.signOut()
    navigate("/", { replace: true })
  }

  async function saveProfile(next: ProfileValues) {
    const notes: string[] = []
    if (next.name !== reader!.name) await auth!.updateName(next.name)
    if (next.anonymous !== reader!.anonymous) await auth!.setAnonymous(next.anonymous)
    if (
      next.avatar !== reader!.avatar ||
      next.birthDate !== reader!.birthDate ||
      next.gender !== reader!.gender ||
      next.region !== reader!.region
    ) {
      await auth!.updateProfile({
        avatar: next.avatar,
        region: next.region,
        ...(next.birthDate ? { birthDate: next.birthDate } : {}),
        ...(next.gender ? { gender: next.gender } : {}),
      })
    }
    if (next.password) {
      await auth!.updatePassword(next.password)
      notes.push("Нууц үг хадгалагдлаа.")
    }
    if (next.email && next.email.toLowerCase() !== reader!.email.toLowerCase()) {
      const mustConfirm = await auth!.updateEmail(next.email)
      if (mustConfirm) notes.push(`${next.email} хаяг руу баталгаажуулах холбоос илгээлээ. Түүн дээр дарсны дараа и-мэйл солигдоно.`)
    }
    await refresh()
    // Keep the dialog open to confirm a new password or ask to check the inbox; a name change just closes it.
    return notes.length ? notes.join(" ") : undefined
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <header className="bg-card flex flex-col items-center gap-4 rounded-xl border p-5 text-center sm:flex-row sm:text-left">
        {/*
          Guest mode badge and chip: shown whenever guest mode is saved (also behind
          the open dialog, so the header keeps its height and the page never jumps).
        */}
        {/*
          Guest mode masks the picture (keyframes in index.css): on, a veil wipes down,
          the mask swings in, a ring spins and sparks fly; off, the mask is tossed away
          and the veil drains out. Nothing animates on page load, only after a flip.
        */}
        <span className="relative shrink-0" title={masked ? "Зочин горим: сэтгэгдэл нэргүй гарна" : undefined}>
          <span className={`block rounded-full transition-[filter,transform] duration-700 ${masked ? "scale-[0.97] grayscale" : ""}`}>
            <ReaderAvatar name={avatarSeed} avatar={reader.avatar} size="lg" />
          </span>
          {masked || flip?.dir === "out" ? (
            <span
              key={`veil-${flip?.n ?? 0}`}
              aria-hidden
              className={`text-background absolute inset-0 grid place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,color-mix(in_oklab,var(--foreground)_70%,transparent),color-mix(in_oklab,var(--foreground)_92%,transparent))] ${flip ? (flip.dir === "in" ? "ez-veil-in" : "ez-veil-out") : ""}`}
            >
              <VenetianMask className={`size-8 ${flip ? (flip.dir === "in" ? "ez-mask-drop" : "ez-mask-toss") : ""}`} />
            </span>
          ) : null}
          {flip ? <span key={`ring-${flip.n}`} aria-hidden className={`ez-mask-ring ${flip.dir === "out" ? "is-out" : ""}`} /> : null}
          {flip?.dir === "in" ? (
            <span key={`sparks-${flip.n}`} aria-hidden className="text-brand pointer-events-none absolute inset-0">
              {MASK_SPARKS.map((color, index, all) => (
                <span
                  key={index}
                  className="ez-spark"
                  style={
                    {
                      background: color,
                      "--ez-angle": `${(360 / all.length) * index + 20}deg`,
                      "--ez-distance": `${-44 - (index % 2) * 8}px`,
                      animationDelay: `${420 + (index % 3) * 30}ms`,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          ) : null}
        </span>
        <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-1 sm:items-start">
          <h1 className="font-news inline-flex flex-wrap items-center justify-center gap-2 text-2xl leading-tight break-words sm:justify-start sm:text-3xl">
            {reader.name || "Уншигч"}
            {reader.badge ? <BadgeMark id={reader.badge} memberNo={reader.memberNo} size={26} /> : null}
          </h1>
          {contact ? (
            <p className="text-muted-foreground flex max-w-full flex-col text-[13px] sm:flex-row sm:gap-2">
              {reader.email ? <span className="truncate">{reader.email}</span> : null}
              {reader.email && reader.phone ? (
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
              ) : null}
              {reader.phone ? <span className="truncate">{formatPhone(reader.phone)}</span> : null}
            </p>
          ) : null}
          <GuestSwitch
            key={String(reader.anonymous)}
            on={reader.anonymous}
            onChange={async (next) => {
              // The picture follows the switch at once, not after the save round-trip.
              setGuestPreview(next)
              setFlip((last) => ({ dir: next ? "in" : "out", n: (last?.n ?? 0) + 1 }))
              try {
                await auth!.setAnonymous(next)
                await refresh()
              } finally {
                setGuestPreview(null)
              }
            }}
          />
        </div>
        <div className="grid w-full grid-cols-[1fr_auto] gap-2 sm:flex sm:w-auto">
          <button type="button" onClick={() => setEditing(true)} className={buttonClass.primary}>
            <Pencil className="size-4" />
            Профайл засах
          </button>
          <button type="button" onClick={signOut} aria-label="Гарах" className={buttonClass.ghost}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Гарах</span>
          </button>
        </div>
      </header>


      <div className="bg-card rounded-xl border p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-[12px] font-medium">Оноо</p>
            <p className="font-news text-4xl leading-none tabular-nums">{progress.points}</p>
          </div>
          <div className="text-right">
            <p className="text-[14px] font-semibold">{progress.level}</p>
            <p className="text-muted-foreground text-[12px]">
              {progress.next ? `${progress.next.label} хүртэл ${progress.next.remaining} оноо` : "Хамгийн дээд түвшин"}
            </p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Дараагийн түвшин"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((progress.next?.share ?? 1) * 100)}
          className="bg-muted mt-4 h-2.5 overflow-hidden rounded-full border"
        >
          <div className="bg-primary h-full rounded-full" style={{ width: `${(progress.next?.share ?? 1) * 100}%` }} />
        </div>
        <p className="text-muted-foreground mt-3 text-[12px]">
          Тойм, нийтлэл бүрийг эцэс хүртэл уншихад +{POINTS_PER_READ}, амжилт бүрт +{POINTS_PER_ACHIEVEMENT} оноо.
        </p>
      </div>

      <section aria-labelledby="achievements-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="achievements-heading" className="font-news text-2xl">
            Амжилт
          </h2>
          <span className="text-muted-foreground text-[13px]">
            {progress.unlocked} / {progress.achievements.length}
          </span>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {progress.achievements.map((item) => {
            const Icon = icons[item.icon]
            const [light, deep] = achievementColors[item.icon]
            return (
              <li
                key={item.id}
                className="bg-card flex flex-col gap-2 rounded-xl border p-4"
                aria-label={`${item.title}: ${item.unlocked ? "нээгдсэн" : `${item.progress}/${item.goal}`}`}
              >
                <span
                  className={cn("grid size-11 place-items-center rounded-2xl", !item.unlocked && "bg-muted text-muted-foreground/70")}
                  style={
                    item.unlocked
                      ? {
                          backgroundImage: `linear-gradient(145deg, ${light}, ${deep})`,
                          boxShadow: `0 8px 20px -8px ${deep}, inset 0 1px 0 rgb(255 255 255 / 0.35)`,
                          color: "white",
                        }
                      : undefined
                  }
                >
                  <Icon className="size-5 drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]" strokeWidth={2.25} />
                </span>
                <span className={cn("text-[14px] font-semibold", !item.unlocked && "text-muted-foreground")}>{item.title}</span>
                <span className="text-muted-foreground text-[12px] leading-snug">{item.description}</span>
                {item.unlocked ? (
                  <span className="mt-auto text-[12px] font-semibold" style={{ color: deep }}>
                    Нээгдсэн
                  </span>
                ) : (
                  <span className="mt-auto flex items-center gap-2">
                    <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                      <span className="block h-full rounded-full" style={{ width: `${(item.progress / item.goal) * 100}%`, backgroundImage: `linear-gradient(90deg, ${light}, ${deep})` }} />
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {item.progress}/{item.goal}
                    </span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <BadgeShop points={progress.points} />

      <section className="mt-2 flex flex-col gap-5">
        <ContinuousTabs
          label="Миний сан"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "saved", label: `Хадгалсан · ${progress.saved}` },
            { id: "read", label: `Уншсан · ${progress.finished}` },
          ]}
        />
        <div role="tabpanel">
          {tab === "saved" ? (
            <LibraryList
              mode="saved"
              entries={saved}
              items={items}
              empty="Хадгалсан зүйл алга. Тойм, нийтлэл дээрх “Хадгалах” товчоор энд нэмнэ."
            />
          ) : null}
          {tab === "read" ? (
            <LibraryList
              mode="read"
              entries={reads}
              items={items}
              empty="Уншсан зүйл алга. Тойм, нийтлэлийг эцэс хүртэл уншихад энд бүртгэгдэнэ."
            />
          ) : null}
        </div>
      </section>

      <EditProfile
        open={editing}
        onClose={() => setEditing(false)}
        values={{
          name: reader.name,
          email: reader.email,
          anonymous: reader.anonymous,
          avatar: reader.avatar,
          birthDate: reader.birthDate,
          gender: reader.gender,
          region: reader.region,
        }}
        phone={reader.phone ? formatPhone(reader.phone) : undefined}
        onSave={saveProfile}
      />
    </section>
  )
}
