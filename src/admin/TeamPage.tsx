import { cn } from "cn"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { Crown, PenLine, ShieldCheck, UserPlus } from "lucide-react"

import { useConfirm } from "@/admin/ConfirmDialog"
import { canManageTeam, roleLabel } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { Avatar, buttonClass, Field, inputClass, Notice } from "@/admin/ui"
import type { Member, Role } from "@/admin/types"

const roles: Role[] = ["writer", "editor", "admin"]

const roleRights: Record<Role, string> = {
  writer: "Ноорог бичиж, хянуулахаар илгээнэ. Өөрийн нийтлэлийг л засна.",
  editor: "Бүх нийтлэлийг засна, батална, засвар хүснэ, нийтэлнэ. Шошго удирдана.",
  admin: "Редакторын бүх эрх + гишүүдийн эрхийг өөрчилнө.",
}

const roleIcon: Record<Role, ReactNode> = {
  writer: <PenLine className="size-4" />,
  editor: <ShieldCheck className="size-4" />,
  admin: <Crown className="size-4" />,
}

/** A segmented control instead of a dropdown: all three roles visible, one tap to change. */
function RolePicker({ value, onChange, label, size = "md" }: { value: Role; onChange: (role: Role) => void; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-muted inline-flex rounded-full p-1">
      {roles.map((role) => {
        const active = role === value
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && onChange(role)}
            className={cn(
              "rounded-full font-medium transition-colors",
              size === "sm" ? "h-7 px-3 text-[12px]" : "h-8 px-3.5 text-[13px]",
              active ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {roleLabel[role]}
          </button>
        )
      })}
    </div>
  )
}

export function TeamPage() {
  const confirm = useConfirm()
  const { backend, member, refresh } = useTeam()
  const [members, setMembers] = useState<Member[]>([])
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("writer")

  useEffect(() => {
    backend.listMembers().then(setMembers)
  }, [backend])

  if (!canManageTeam(member)) return <Navigate to="/admin" replace />

  const count = (key: Role) => members.filter((item) => item.role === key).length
  const sorted = [...members].sort((a, b) => roles.indexOf(b.role) - roles.indexOf(a.role) || a.name.localeCompare(b.name))

  async function changeRole(target: Member, next: Role) {
    if (
      target.id === member.id &&
      next !== "admin" &&
      !(await confirm({
        title: "Өөрийнхөө админ эрхийг хасах уу?",
        message: "Баг, уншигч, хяналтын хуудас танд хаагдана. Буцааж авахын тулд өөр админ хэрэгтэй.",
        confirmLabel: "Эрх хасах",
        destructive: true,
      }))
    )
      return
    try {
      await backend.setRole(target.id, next)
      setMembers((current) => current.map((item) => (item.id === target.id ? { ...item, role: next } : item)))
      setMessage({ tone: "success", text: `${target.name}: ${roleLabel[next]}` })
      if (target.id === member.id) refresh()
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Өөрчилж чадсангүй" })
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    try {
      await backend.addMember(name.trim(), email.trim(), role)
      const next = await backend.listMembers()
      const joined = next.some((item) => item.email.toLowerCase() === email.trim().toLowerCase())
      setMembers(next)
      setName("")
      setEmail("")
      setMessage({
        tone: "success",
        text: joined
          ? "Гишүүн нэмэгдлээ"
          : "Урилга бүртгэгдлээ. Одоо Supabase → Authentication → Users → “Invite user”-ээр энэ и-мэйлийг урина уу.",
      })
    } catch (failure) {
      setMessage({ tone: "error", text: failure instanceof Error ? failure.message : "Нэмж чадсангүй" })
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Админ</p>
          <h1 className="font-news mt-1 text-3xl">Баг</h1>
          <p className="text-muted-foreground mt-1 text-[14px]">
            {members.length} гишүүн · эрх нь хэн юу хийж чадахыг тодорхойлно
          </p>
        </div>
      </header>

      {/* Roles: what each can do, and how many people hold it. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {roles.map((key) => (
          <section key={key} className="bg-card rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <span className="bg-muted text-foreground grid size-9 place-items-center rounded-lg border">{roleIcon[key]}</span>
              <span className="font-news text-2xl tabular-nums">{count(key)}</span>
            </div>
            <h2 className="mt-3 text-[14px] font-semibold">{roleLabel[key]}</h2>
            <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">{roleRights[key]}</p>
          </section>
        ))}
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <section aria-labelledby="members-title" className="bg-card overflow-hidden rounded-xl border">
        <h2 id="members-title" className="border-b px-4 py-3 text-[14px] font-semibold">
          Гишүүд
        </h2>
        <ul className="divide-y">
          {sorted.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <Avatar name={item.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[14px] font-semibold">
                  {item.name}
                  {item.id === member.id ? (
                    <span className="bg-foreground/[0.07] text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">та</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground truncate text-[12px]">{item.email}</p>
              </div>
              <RolePicker value={item.role} onChange={(next) => changeRole(item, next)} label={`${item.name} эрх`} size="sm" />
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={add} className="bg-card overflow-hidden rounded-xl border">
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          <span className="bg-muted text-foreground grid size-8 place-items-center rounded-lg border">
            <UserPlus className="size-4" />
          </span>
          <div>
            <p className="text-[14px] font-semibold">Гишүүн нэмэх{backend.mode === "demo" ? " (демо)" : ""}</p>
            {backend.mode === "supabase" ? (
              <p className="text-muted-foreground text-[12px]">
                И-мэйлийг энд нэмээд Supabase-аас урина. Уншигчаар бүртгэлтэй хүн бол шууд багт нэмэгдэнэ.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Нэр" htmlFor="member-name">
              <input id="member-name" required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
            </Field>
            <Field label="И-мэйл" htmlFor="member-email">
              <input id="member-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Эрх</span>
              <RolePicker value={role} onChange={setRole} label="Шинэ гишүүний эрх" />
            </div>
            <button type="submit" className={buttonClass.primary}>
              <UserPlus className="size-4" />
              Нэмэх
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
