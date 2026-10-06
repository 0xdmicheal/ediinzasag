import { useRef, type ReactNode } from "react"
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react"
import { cn } from "cn"

import { proseClass } from "@/components/site/article"
import { sanitize } from "@/lib/article-html"

/** Writing surface like Substack's: a toolbar on top, a clean page below. */
export function RichEditor({
  content,
  editable,
  onChange,
  onUploadImage,
  onWordCount,
}: {
  content: string
  editable: boolean
  onChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string>
  onWordCount?: (words: number) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noreferrer", target: "_blank" } },
      }),
      Image,
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "heading" ? "Дэд гарчиг" : "Энд бичиж эхэлнэ үү…"),
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(proseClass, "ez-editor min-h-[50vh] outline-none"),
        "aria-label": "Нийтлэлийн текст",
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(sanitize(current.getHTML()))
      onWordCount?.(current.getText().split(/\s+/).filter(Boolean).length)
    },
    onCreate: ({ editor: current }) => onWordCount?.(current.getText().split(/\s+/).filter(Boolean).length),
  })

  return (
    <div>
      {editable && editor ? <Toolbar editor={editor} onUploadImage={onUploadImage} /> : null}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md transition-colors disabled:opacity-30",
        active ? "bg-foreground text-background" : "text-foreground/75 hover:bg-foreground/[0.07] hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor, onUploadImage }: { editor: Editor; onUploadImage: (file: File) => Promise<string> }) {
  const file = useRef<HTMLInputElement>(null)
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      link: e.isActive("link"),
      quote: e.isActive("blockquote"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  function setBlock(value: string) {
    const chain = editor.chain().focus()
    if (value === "p") chain.setParagraph().run()
    else chain.setHeading({ level: value === "h2" ? 2 : 3 }).run()
  }

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Холбоос (https://…). Хоосон орхивол холбоосыг арилгана.", previous ?? "https://")
    if (url === null) return
    if (!url.trim() || url.trim() === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      window.alert("Холбоос https:// эсвэл http://-ээр эхэлнэ")
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  async function addImage(picked: File | undefined) {
    if (!picked) return
    try {
      const src = await onUploadImage(picked)
      const alt = window.prompt("Зургийн тайлбар (хараагүй уншигчид ч сонсоно):", "") ?? ""
      editor.chain().focus().setImage({ src, alt }).run()
    } catch (failure) {
      window.alert(failure instanceof Error ? failure.message : "Зураг оруулж чадсангүй")
    }
  }

  const divider = <span className="bg-border mx-1 h-5 w-px shrink-0" aria-hidden />

  return (
    <div
      role="toolbar"
      aria-label="Форматлах"
      className="bg-background/90 sticky top-14 z-20 -mx-4 mb-8 flex items-center gap-0.5 overflow-x-auto border-y px-4 py-1.5 backdrop-blur-xl [scrollbar-width:none] sm:mx-0 sm:rounded-lg sm:border"
    >
      <label htmlFor="block-style" className="sr-only">
        Текстийн төрөл
      </label>
      <select
        id="block-style"
        value={state.block}
        onChange={(event) => setBlock(event.target.value)}
        className="hover:bg-foreground/[0.07] h-8 shrink-0 rounded-md bg-transparent px-2 text-[13px] font-medium outline-none"
      >
        <option value="p">Энгийн текст</option>
        <option value="h2">Гарчиг</option>
        <option value="h3">Дэд гарчиг</option>
      </select>
      {divider}
      <ToolButton label="Тод (Ctrl+B)" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton label="Налуу (Ctrl+I)" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolButton>
      <ToolButton label="Дарах зураас" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </ToolButton>
      <ToolButton label="Холбоос" active={state.link} onClick={setLink}>
        <Link2 className="size-4" />
      </ToolButton>
      {divider}
      <ToolButton label="Ишлэл" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </ToolButton>
      <ToolButton label="Жагсаалт" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </ToolButton>
      <ToolButton label="Дугаартай жагсаалт" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </ToolButton>
      <ToolButton label="Зураг" onClick={() => file.current?.click()}>
        <ImagePlus className="size-4" />
      </ToolButton>
      <ToolButton label="Хуваах шугам" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="size-4" />
      </ToolButton>
      <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-2">
        <ToolButton label="Буцаах (Ctrl+Z)" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-4" />
        </ToolButton>
        <ToolButton label="Дахих" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-4" />
        </ToolButton>
      </span>
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          addImage(event.target.files?.[0])
          event.target.value = ""
        }}
      />
    </div>
  )
}
