import { Node, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react"
import { ExternalLink, ImageIcon, ImageOff, Loader2, Trash2 } from "lucide-react"
import { cn } from "cn"

/*
 * Link cards: paste (or drop) a bare link on its own line and it becomes a card
 * with the page's picture, title, description and site, like Substack or
 * Telegram. The writer decides whether the picture shows. Saved as
 *   <figure data-card="link" data-image="on|off"><a href><img><strong/><em/><small/></a></figure>
 * (styles in index.css, display rules in lib/article-html.ts).
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ezLinkCard: {
      insertLinkCard: (attrs: { href: string; pending: string }, at?: number) => ReturnType
    }
  }
}

export interface LinkCardAttrs {
  href: string
  title: string
  description: string
  image: string
  site: string
  showImage: boolean
  /** Set while the preview is being fetched; never saved. */
  pending: string | null
}

export const EzLinkCard = Node.create({
  name: "linkCard",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: "" },
      site: { default: "" },
      showImage: { default: true },
      pending: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-card="link"]',
        priority: 60,
        getAttrs: (element) => {
          const figure = element as HTMLElement
          const link = figure.querySelector("a")
          if (!link?.getAttribute("href")) return false
          return {
            href: link.getAttribute("href"),
            title: figure.querySelector("strong")?.textContent?.trim() ?? "",
            description: figure.querySelector("em")?.textContent?.trim() ?? "",
            image: figure.querySelector("img")?.getAttribute("src") ?? "",
            site: figure.querySelector("small")?.textContent?.trim() ?? "",
            showImage: figure.dataset.image !== "off",
          }
        },
      },
    ]
  },

  renderHTML({ node }) {
    const { href, title, description, image, site, showImage } = node.attrs as LinkCardAttrs
    const parts: unknown[] = []
    if (image) parts.push(["img", { src: image, alt: "" }])
    parts.push(["strong", {}, title || site || href])
    if (description) parts.push(["em", {}, description])
    if (site) parts.push(["small", {}, site])
    return [
      "figure",
      { "data-card": "link", "data-image": image && showImage ? "on" : "off" },
      ["a", { href, target: "_blank", rel: "noreferrer" }, ...parts],
    ] as never
  },

  addCommands() {
    return {
      insertLinkCard:
        ({ href, pending }, at) =>
        ({ chain }) => {
          const content = { type: this.name, attrs: { href, pending, site: hostOf(href), title: "" } }
          return (at === undefined ? chain().insertContent(content) : chain().insertContentAt(at, content)).run()
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkCardView, {
      stopEvent: ({ event }) => Boolean((event.target as HTMLElement | null)?.closest("button")),
    })
  },
})

export function hostOf(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "")
  } catch {
    return href
  }
}

/** A bare http(s) link and nothing else. */
export function bareUrl(text: string | undefined | null) {
  const value = text?.trim() ?? ""
  if (!/^https?:\/\/\S+$/i.test(value)) return null
  try {
    return new URL(value).href
  } catch {
    return null
  }
}

function LinkCardView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const { href, title, description, image, site, showImage, pending } = node.attrs as LinkCardAttrs
  const editable = editor.isEditable
  const pictureShown = Boolean(image) && showImage

  return (
    <NodeViewWrapper as="figure" data-card="link" data-image={pictureShown ? "on" : "off"} className="not-prose relative" data-drag-handle>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => editable && event.preventDefault()}
        className={cn(selected && editable && "ring-brand ring-2 ring-offset-2 ring-offset-[var(--background)]")}
      >
        {image ? <img src={image} alt="" referrerPolicy="no-referrer" /> : null}
        {pending ? (
          <strong className="text-muted-foreground inline-flex! items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Холбоосыг уншиж байна…
          </strong>
        ) : (
          <strong>{title || site || href}</strong>
        )}
        {description ? <em>{description}</em> : null}
        <small>{site || hostOf(href)}</small>
      </a>

      {editable && !pending ? (
        <div
          role="toolbar"
          aria-label="Холбоосын карт"
          className="bg-popover absolute top-2 right-2 flex items-center gap-0.5 rounded-full border p-0.5 shadow-sm"
        >
          {image ? (
            <button
              type="button"
              aria-pressed={showImage}
              onClick={() => updateAttributes({ showImage: !showImage })}
              className="hover:bg-foreground/5 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium"
            >
              {showImage ? <ImageOff className="size-3.5" /> : <ImageIcon className="size-3.5" />}
              {showImage ? "Зураг нуух" : "Зураг харуулах"}
            </button>
          ) : null}
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label="Холбоосыг шинэ цонхонд нээх"
            title="Нээх"
            className="hover:bg-foreground/5 grid size-7 place-items-center rounded-full"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <button
            type="button"
            onClick={deleteNode}
            aria-label="Картыг устгах"
            title="Устгах"
            className="grid size-7 place-items-center rounded-full text-[var(--down)] hover:bg-[color-mix(in_oklch,var(--down)_10%,transparent)]"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}
