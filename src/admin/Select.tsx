import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "cn"

/*
 * Select 12: a rounded trigger with an icon, and a rounded menu.
 * Listbox pattern: arrows move, Enter/Space picks, Esc closes, typing a letter jumps.
 */

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  value,
  options,
  onChange,
  label,
  icon,
  className,
  up = false,
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** Accessible name. */
  label: string
  icon?: ReactNode
  className?: string
  /** Open the list above the button (for controls near the bottom of the screen). */
  up?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState({ top: 0, bottom: 0, left: 0, width: 0, openUp: false })
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function placeMenu() {
      const rect = root.current?.getBoundingClientRect()
      if (!rect) return
      const spaceBelow = window.innerHeight - rect.bottom
      setPlace({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        openUp: up || spaceBelow < 240,
      })
    }
    placeMenu()
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!root.current?.contains(target) && !list.current?.contains(target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    window.addEventListener("resize", placeMenu)
    window.addEventListener("scroll", placeMenu, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      window.removeEventListener("resize", placeMenu)
      window.removeEventListener("scroll", placeMenu, true)
    }
  }, [open, up])

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  function show() {
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }

  function pick(index: number) {
    const option = options[index]
    if (option) onChange(option.value)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault()
        show()
      }
      return
    }
    if (event.key === "Escape") {
      // Close only this list, not the panel or dialog around it.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    } else if (event.key === "Tab") {
      setOpen(false)
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => Math.min(options.length - 1, index + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => Math.max(0, index - 1))
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      pick(active)
    } else if (event.key.length === 1) {
      const letter = event.key.toLowerCase()
      const found = options.findIndex((option, index) => index > active && option.label.replace(/^#/, "").toLowerCase().startsWith(letter))
      const wrapped = found >= 0 ? found : options.findIndex((option) => option.label.replace(/^#/, "").toLowerCase().startsWith(letter))
      if (wrapped >= 0) setActive(wrapped)
    }
  }

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-background px-3 text-left text-[13px] font-medium shadow-xs outline-none transition-colors",
          "hover:bg-muted",
          open && "border-foreground/30",
        )}
      >
        {icon ? <span className="text-muted-foreground shrink-0">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open
        ? createPortal(
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          style={{
            position: "fixed",
            left: place.left,
            width: Math.max(place.width, 160),
            top: place.openUp ? undefined : place.bottom + 6,
            bottom: place.openUp ? window.innerHeight - place.top + 6 : undefined,
          }}
          className="bg-popover text-popover-foreground z-[140] max-h-72 overflow-y-auto rounded-xl border p-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === selected?.value
            return (
              <li
                key={option.value}
                id={`${id}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] whitespace-nowrap",
                  index === active && "bg-muted",
                  isSelected && "font-semibold",
                )}
              >
                <span className="flex-1">{option.label}</span>
                {isSelected ? <Check className="size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
              </li>
            )
          })}
        </ul>,
          document.body,
        )
      : null}
    </div>
  )
}
