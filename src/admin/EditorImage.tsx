import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { mergeAttributes, Node, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react"
import { Trash2 } from "lucide-react"
import { cn } from "cn"

import { IMAGE_WIDTHS, MIN_IMAGE_WIDTH } from "@/lib/article-html"

/*
 * Images in the article body, like Substack's: the picture goes in straight
 * away (no pop-up), with an optional caption typed under it and optional alt
 * text. Width is a percentage of the column (drag a side handle, or pick
 * S / M / L), so it still fits on phones. Saved as
 *   <figure data-width="60"><img src alt><figcaption>…</figcaption></figure>
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ezImage: {
      insertEzImage: (attrs: { src: string; alt?: string; caption?: string; width?: number }) => ReturnType
    }
  }
}

const clampWidth = (value: number) => Math.min(100, Math.max(MIN_IMAGE_WIDTH, Math.round(value / 5) * 5))

export const EzImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
      width: { default: 100 },
    }
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (element) => {
          const img = (element as HTMLElement).querySelector("img")
          // Link cards are figures with a picture too; EzLinkCard owns those.
          if ((element as HTMLElement).dataset.card || !img?.getAttribute("src")) return false
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") ?? "",
            caption: (element as HTMLElement).querySelector("figcaption")?.textContent?.trim() ?? "",
            width: clampWidth(Number((element as HTMLElement).dataset.width) || 100),
          }
        },
      },
      // Older drafts: a bare <img>.
      { tag: "img[src]", getAttrs: (element) => ({ src: (element as HTMLElement).getAttribute("src"), alt: (element as HTMLElement).getAttribute("alt") ?? "" }) },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, caption, width } = HTMLAttributes as { src: string; alt: string; caption: string; width: number }
    const figure = mergeAttributes(width < 100 ? { "data-width": String(width) } : {})
    const img = ["img", { src, alt: alt ?? "" }] as const
    return caption ? ["figure", figure, img, ["figcaption", {}, caption]] : ["figure", figure, img]
  },

  addCommands() {
    return {
      insertEzImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { width: 100, alt: "", caption: "", ...attrs } }),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView, {
      // Let the caption and alt fields take typing and clicks instead of the editor.
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null
        return Boolean(target?.closest("input, textarea, button, [data-resize-handle]"))
      },
    })
  },
})

function ImageView({ node, deleteNode, selected, editor, getPos }: ReactNodeViewProps) {
  const { src, alt, caption, width } = node.attrs as { src: string; alt: string; caption: string; width: number }
  const editable = editor.isEditable
  const frame = useRef<HTMLDivElement>(null)
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const [altOpen, setAltOpen] = useState(false)
  const shown = dragWidth ?? width

  // Change one attribute on the node as it is now (the node view helper can merge stale values from an earlier render).
  function setAttr(name: "alt" | "caption" | "width", value: string | number) {
    editor.commands.command(({ tr }) => {
      const pos = getPos()
      if (typeof pos !== "number") return false
      tr.setNodeAttribute(pos, name, value)
      return true
    })
  }

  function startResize(event: ReactPointerEvent<HTMLSpanElement>, side: "left" | "right") {
    event.preventDefault()
    const column = frame.current?.parentElement?.getBoundingClientRect()
    if (!column) return
    const startX = event.clientX
    const startWidth = width
    let latest = startWidth
    // The image is centred, so each side moves half the width change.
    const onMove = (move: PointerEvent) => {
      const delta = ((move.clientX - startX) / column.width) * 100 * 2 * (side === "right" ? 1 : -1)
      latest = clampWidth(startWidth + delta)
      setDragWidth(latest)
    }
    // Listen on the window: the handle re-renders while dragging and would drop the pointerup.
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      setDragWidth(null)
      setAttr("width", latest)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  return (
    <NodeViewWrapper as="figure" className="ez-figure not-prose my-8" data-drag-handle>
      <div ref={frame} className="relative mx-auto" style={{ width: `${shown}%`, minWidth: `min(100%, 220px)` }}>
        <img
          src={src}
          alt={alt}
          draggable={false}
          // Clicking the picture always selects it, so the size, alt and caption controls show.
          onClick={() => {
            const pos = getPos()
            if (editable && typeof pos === "number") editor.commands.setNodeSelection(pos)
          }}
          className={cn("!my-0 block w-full rounded-lg", selected && editable && "ring-brand ring-2 ring-offset-2 ring-offset-[var(--background)]")}
        />

        {editable && selected ? (
          <>
            {(["left", "right"] as const).map((side) => (
              <span
                key={side}
                data-resize-handle
                role="separator"
                aria-label="Хэмжээг өөрчлөх"
                onPointerDown={(event) => startResize(event, side)}
                className={cn(
                  "bg-background absolute top-1/2 h-12 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-full border shadow-md",
                  side === "left" ? "-left-1.5" : "-right-1.5",
                )}
              />
            ))}
            <div className="bg-background absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border p-1 text-[12px] shadow-lg">
              {IMAGE_WIDTHS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAttr("width", value)}
                  className={cn("h-7 rounded-full px-2.5 font-medium", width === value ? "bg-foreground text-background" : "hover:bg-foreground/[0.07]")}
                >
                  {label}
                </button>
              ))}
              <span className="text-muted-foreground px-1.5 font-mono text-[11px] tabular-nums">{shown}%</span>
              <span className="bg-border mx-0.5 h-4 w-px" aria-hidden />
              <button
                type="button"
                onClick={() => setAltOpen((open) => !open)}
                className={cn("h-7 rounded-full px-2.5 font-medium", alt ? "text-[var(--up)]" : "", altOpen ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.07]")}
                title="Хараагүй уншигчид зориулсан тайлбар (заавал биш)"
              >
                Alt
              </button>
              <button type="button" onClick={deleteNode} aria-label="Зургийг устгах" className="grid size-7 place-items-center rounded-full text-[var(--down)] hover:bg-[color-mix(in_oklch,var(--down)_10%,transparent)]">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </>
        ) : null}
      </div>

      {editable && selected && altOpen ? (
        <input
          autoFocus
          value={alt}
          onChange={(event) => setAttr("alt", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && setAltOpen(false)}
          placeholder="Зурагт юу байгааг товч бичнэ (заавал биш)"
          className="bg-muted mx-auto mt-2 block w-full max-w-md rounded-md border px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand)]"
        />
      ) : null}

      {editable && (selected || caption) ? (
        <input
          value={caption}
          onChange={(event) => setAttr("caption", event.target.value)}
          placeholder={selected ? "Тайлбар нэмэх (заавал биш)" : ""}
          aria-label="Зургийн тайлбар"
          className="text-muted-foreground placeholder:text-muted-foreground/80 mt-2 block w-full bg-transparent text-center text-[13px] outline-none"
        />
      ) : caption ? (
        <figcaption className="text-muted-foreground mt-2 text-center text-[13px]">{caption}</figcaption>
      ) : null}
    </NodeViewWrapper>
  )
}
