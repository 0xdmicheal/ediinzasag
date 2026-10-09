import type { ReactNode } from "react"
import { cn } from "cn"

import { roleLabel, statusMeta } from "@/admin/rules"
import type { Role, Status } from "@/admin/types"

/* Small shared pieces for the admin screens. */

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap", statusMeta[status].tone, className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {statusMeta[status].label}
    </span>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase",
        role === "admin" ? "bg-foreground text-background" : "bg-foreground/[0.07] text-foreground/80",
      )}
    >
      {roleLabel[role]}
    </span>
  )
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <span
      className={cn(
        "bg-foreground/[0.07] text-foreground grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-11 text-[14px]" : "size-8 text-[12px]",
      )}
      aria-hidden
    >
      {initials || "?"}
    </span>
  )
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-muted-foreground text-[12px]">{hint}</p> : null}
    </div>
  )
}

export const inputClass =
  "bg-card w-full rounded-md border px-3 py-2 text-[14px] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"

export const buttonClass = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/85 inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  brand:
    "bg-brand text-brand-foreground hover:brightness-95 inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "border-foreground/20 hover:bg-foreground/5 inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-4 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "text-[var(--down)] hover:bg-[color-mix(in_oklch,var(--down)_10%,transparent)] inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors disabled:opacity-50",
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "bg-brand-soft text-foreground",
    error: "bg-[color-mix(in_oklch,var(--down)_12%,transparent)] text-[var(--down)]",
    success: "bg-[color-mix(in_oklch,var(--up)_12%,transparent)] text-[var(--up)]",
  }
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-md px-3 py-2 text-[13px]", tones[tone])}>
      {children}
    </p>
  )
}
