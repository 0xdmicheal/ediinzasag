import { cn } from "cn"
import { useEffect, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { UserPlus } from "lucide-react"

import { canManageTeam, roleLabel } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import { Avatar, buttonClass, Field, inputClass, Notice } from "@/admin/ui"
import type { Member, Role } from "@/admin/types"

const roleRights: Record<Role, string> = {
  writer: "Ноорог бичиж, хянуулахаар илгээнэ. Өөрийн нийтлэлийг л засна.",
  editor: "Бүх нийтлэлийг засна, батална, засвар хүснэ, нийтэлнэ. Шошго удирдана.",
  admin: "Редакторын бүх эрх + гишүүдийн эрхийг өөрчилнө.",
}

export function TeamPage() {
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

  async function changeRole(target: Member, next: Role) {
    if (target.id === member.id && next !== "admin" && !window.confirm("Өөрийнхөө админ эрхийг хасах уу?")) return
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <p className="text-muted-foreground font-mono text-[11px] uppercase">Админ</p>
        <h1 className="font-news mt-1 text-3xl">Баг</h1>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(roleRights) as Role[]).map((key) => (
          <div key={key} className="bg-card rounded-lg border p-3">
            <p className="text-[13px] font-semibold">{roleLabel[key]}</p>
            <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">{roleRights[key]}</p>
          </div>
        ))}
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <ul className="bg-card divide-y rounded-xl border">
        {members.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar name={item.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">
                {item.name}
                {item.id === member.id ? <span className="text-muted-foreground font-normal"> (та)</span> : null}
              </p>
              <p className="text-muted-foreground truncate text-[12px]">{item.email}</p>
            </div>
            <label className="sr-only" htmlFor={`role-${item.id}`}>
              {item.name} эрх
            </label>
            <select
              id={`role-${item.id}`}
              value={item.role}
              onChange={(event) => changeRole(item, event.target.value as Role)}
              className={cn(inputClass, "w-auto")}
            >
              {(Object.keys(roleLabel) as Role[]).map((key) => (
                <option key={key} value={key}>
                  {roleLabel[key]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
        <p className="text-[14px] font-semibold">Гишүүн нэмэх{backend.mode === "demo" ? " (демо)" : ""}</p>
        {backend.mode === "supabase" ? (
          <p className="text-muted-foreground text-[12px]">
            И-мэйлийг энд нэмээд Supabase-аас урина. Уншигчаар бүртгэлтэй хүн бол шууд багт нэмэгдэнэ. Нээлттэй бүртгэлээр орсон уншигч
            багийн эрх авахгүй.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Нэр" htmlFor="member-name">
            <input id="member-name" required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </Field>
          <Field label="И-мэйл" htmlFor="member-email">
            <input id="member-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Эрх" htmlFor="member-role">
            <select id="member-role" value={role} onChange={(event) => setRole(event.target.value as Role)} className={inputClass}>
              {(Object.keys(roleLabel) as Role[]).map((key) => (
                <option key={key} value={key}>
                  {roleLabel[key]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button type="submit" className={`${buttonClass.primary} w-fit`}>
          <UserPlus className="size-4" />
          Нэмэх
        </button>
      </form>
    </div>
  )
}
