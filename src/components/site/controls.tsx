import type { ReactNode } from "react"
import { cn } from "cn"

export { Field } from "@/admin/ui"

/*
 * Buttons, inputs and notices for the reader pages (login, account, comments, library).
 * They used to share the admin's; the admin now has its own look (src/admin/admin.css),
 * so the site keeps these, unchanged.
 */

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
