import { Globe2, LineChart, Mail, Mic, Mountain, type LucideIcon } from "lucide-react"

/**
 * The newsroom's desks. Each colour desk owns one validated hue (see the
 * --desk-* tokens in index.css); Нийтлэл is deliberately neutral ink.
 * Desk colour always sits next to the desk's name, never alone.
 */
export type DeskId = "mongolia" | "world" | "markets" | "talk" | "letters"

export interface DeskStyle {
  id: DeskId
  label: string
  icon: LucideIcon
  /** CSS colour for dots, icons and tints. */
  color: string
}

export const desks: Record<DeskId, DeskStyle> = {
  mongolia: { id: "mongolia", label: "Монгол", icon: Mountain, color: "var(--desk-mongolia)" },
  world: { id: "world", label: "Дэлхий", icon: Globe2, color: "var(--desk-world)" },
  markets: { id: "markets", label: "Ханш", icon: LineChart, color: "var(--desk-markets)" },
  talk: { id: "talk", label: "EZ Talk", icon: Mic, color: "var(--desk-talk)" },
  letters: { id: "letters", label: "Нийтлэл", icon: Mail, color: "var(--foreground)" },
}
