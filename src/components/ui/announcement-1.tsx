import { X } from "lucide-react"
import { HiArrowUpRight } from "react-icons/hi2"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Announcement1Props {
  badge: string
  message: string
  href: string
  action: string
  onDismiss: () => void
}

export default function Announcement1({
  badge,
  message,
  href,
  action,
  onDismiss,
}: Announcement1Props) {
  return (
    <div className="border-primary bg-background flex w-full items-center justify-between gap-3 border-t px-4 py-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Badge className="shrink-0 text-xs">{badge}</Badge>
        <p className="text-muted-foreground truncate">{message}</p>
        <Link
          to={href}
          className="group text-primary hidden shrink-0 items-center gap-1 font-medium sm:flex"
        >
          <span className="relative before:bg-primary before:absolute before:-bottom-0.5 before:left-0 before:h-px before:w-full before:origin-right before:scale-x-0 before:transition-transform before:duration-300 group-hover:before:scale-x-100">
            {action}
          </span>
          <HiArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-primary shrink-0"
        onClick={onDismiss}
        aria-label="Зарлалыг хаах"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
