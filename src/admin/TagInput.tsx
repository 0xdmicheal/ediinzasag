import { useId, useMemo, useState, type KeyboardEvent } from "react"
import { Plus, X } from "lucide-react"

import { slugify } from "@/admin/rules"
import type { Tag } from "@/admin/types"

/**
 * Tag picker: type to filter, Enter or click to add, × to remove.
 * Editors can create a new tag from what they typed; writers pick existing ones.
 */
export function TagInput({
  value,
  tags,
  canCreate,
  onChange,
  onCreate,
  disabled,
  max = 5,
}: {
  value: string[]
  tags: Tag[]
  canCreate: boolean
  onChange: (next: string[]) => void
  onCreate: (label: string) => Promise<Tag>
  disabled?: boolean
  max?: number
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const listId = useId()
  const labels = useMemo(() => new Map(tags.map((tag) => [tag.slug, tag.label])), [tags])
  const q = query.trim().toLowerCase()
  const suggestions = tags.filter((tag) => !value.includes(tag.slug) && (!q || tag.label.toLowerCase().includes(q) || tag.slug.includes(q))).slice(0, 8)
  const exact = tags.some((tag) => tag.label.toLowerCase() === q || tag.slug === slugify(query))
  const full = value.length >= max

  async function add(tag?: Tag) {
    if (full) return
    let chosen = tag
    if (!chosen && q) {
      chosen = suggestions[0]
      if (!chosen && canCreate && !exact) chosen = await onCreate(query.trim())
    }
    if (chosen && !value.includes(chosen.slug)) onChange([...value, chosen.slug])
    setQuery("")
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      add()
    } else if (event.key === "Backspace" && !query && value.length > 0) {
      onChange(value.slice(0, -1))
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <div className="bg-card focus-within:border-brand focus-within:ring-brand/20 flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2">
        {value.map((slug) => (
          <span key={slug} className="bg-foreground text-background inline-flex h-7 items-center gap-1 rounded-full pr-1 pl-2.5 text-[12px]">
            #{labels.get(slug) ?? slug}
            {!disabled ? (
              <button
                type="button"
                aria-label={`${labels.get(slug) ?? slug} шошгыг хасах`}
                onClick={() => onChange(value.filter((item) => item !== slug))}
                className="hover:bg-background/20 grid size-5 place-items-center rounded-full"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          id="tag-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Шошго нэмэх"
          disabled={disabled || full}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={full ? `Дээд тал нь ${max} шошго` : value.length ? "" : "Шошго хайх эсвэл нэмэх…"}
          className="min-w-[8rem] flex-1 bg-transparent px-1 text-[14px] outline-none disabled:cursor-not-allowed"
        />
      </div>
      {open && !disabled && !full && (suggestions.length > 0 || (q && canCreate && !exact)) ? (
        <ul id={listId} role="listbox" className="bg-popover absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border shadow-lg">
          {suggestions.map((tag) => (
            <li key={tag.slug}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(tag)}
                className="hover:bg-foreground/5 flex w-full items-center justify-between px-3 py-2 text-left text-[13px]"
              >
                #{tag.label}
                <span className="text-muted-foreground font-mono text-[11px]">{tag.slug}</span>
              </button>
            </li>
          ))}
          {q && canCreate && !exact ? (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add()}
                className="hover:bg-foreground/5 text-brand-strong flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[13px]"
              >
                <Plus className="size-3.5" />
                Шинэ шошго: “{query.trim()}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
