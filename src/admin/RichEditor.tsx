import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Check,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  X,
} from "lucide-react"
import { cn } from "cn"

import { Select } from "@/admin/Select"
import { EzImage } from "@/admin/EditorImage"
import { bareUrl, EzLinkCard, type LinkCardAttrs } from "@/admin/EditorLinkCard"
import { plainPreview, type LinkPreview } from "@/admin/link-preview"
import { proseClass } from "@/components/site/article"
import { sanitize } from "@/lib/article-html"

const imageFiles = (files: FileList | null | undefined) => Array.from(files ?? []).filter((file) => file.type.startsWith("image/"))

/** Writing surface like Substack's: a toolbar on top, a clean page below. */
export function RichEditor({
  content,
  editable,
  onChange,
  onUploadImage,
  onLinkPreview,
  onWordCount,
}: {
  content: string
  editable: boolean
  onChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string>
  /** Reads a pasted link's page for its card (title, picture). */
  onLinkPreview: (url: string) => Promise<LinkPreview>
  onWordCount?: (words: number) => void
}) {
  const [uploads, setUploads] = useState(0)
  const [problem, setProblem] = useState("")
  // Paste/drop handlers are created once with the editor; keep them pointed at the latest upload function.
  const uploadRef = useRef(onUploadImage)
  useEffect(() => {
    uploadRef.current = onUploadImage
  }, [onUploadImage])
  const previewRef = useRef(onLinkPreview)
  useEffect(() => {
    previewRef.current = onLinkPreview
  }, [onLinkPreview])

  /** Inserts a loading card, then fills it in when the page has been read. */
  async function insertLinkCard(target: Editor, href: string, at?: number) {
    const token = Math.random().toString(36).slice(2)
    target.chain().focus().insertLinkCard({ href, pending: token }, at).run()
    const data = await previewRef.current(href).catch(() => plainPreview(href))
    const { state, view } = target
    state.doc.descendants((node, pos) => {
      if (node.type.name !== "linkCard" || node.attrs.pending !== token) return true
      const attrs: LinkCardAttrs = {
        href,
        title: data.title,
        description: data.description,
        image: data.image,
        site: data.site,
        showImage: true,
        pending: null,
      }
      view.dispatch(state.tr.setNodeMarkup(pos, undefined, attrs))
      return false
    })
  }

  async function insertImages(target: Editor, files: File[], at?: number) {
    for (const file of files) {
      setUploads((count) => count + 1)
      setProblem("")
      try {
        const src = await uploadRef.current(file)
        const chain = target.chain().focus()
        if (at !== undefined) chain.setTextSelection(at)
        chain.insertEzImage({ src }).run()
      } catch (failure) {
        setProblem(failure instanceof Error ? failure.message : "Зураг оруулж чадсангүй")
      } finally {
        setUploads((count) => count - 1)
      }
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noreferrer", target: "_blank" } },
      }),
      EzImage,
      EzLinkCard,
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
      // Paste or drop pictures straight into the text, like Substack.
      // A bare link pasted on an empty line becomes a link card; inside a sentence it stays a link.
      handlePaste: (view, event) => {
        if (!editorRef.current) return false
        const files = imageFiles(event.clipboardData?.files)
        if (files.length > 0) {
          insertImages(editorRef.current, files)
          return true
        }
        const href = bareUrl(event.clipboardData?.getData("text/plain"))
        const { empty, $from } = view.state.selection
        if (!href || !empty || $from.parent.type.name !== "paragraph" || $from.parent.content.size > 0) return false
        insertLinkCard(editorRef.current, href)
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = imageFiles(event.dataTransfer?.files)
        if (!moved && files.length === 0 && editorRef.current) {
          const uriList = event.dataTransfer?.getData("text/uri-list") ?? ""
          const href = bareUrl(uriList.split(/\s+/)[0] || event.dataTransfer?.getData("text/plain"))
          if (!href) return false
          event.preventDefault()
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
          insertLinkCard(editorRef.current, href, at)
          return true
        }
        if (moved || files.length === 0 || !editorRef.current) return false
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        insertImages(editorRef.current, files, at)
        return true
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(sanitize(current.getHTML()))
      onWordCount?.(current.getText().split(/\s+/).filter(Boolean).length)
    },
    onCreate: ({ editor: current }) => onWordCount?.(current.getText().split(/\s+/).filter(Boolean).length),
  })

  const editorRef = useRef<Editor | null>(null)
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  return (
    <div>
      {editable && editor ? (
        <Toolbar
          editor={editor}
          uploading={uploads > 0}
          problem={problem}
          onDismiss={() => setProblem("")}
          onPickImages={(files) => insertImages(editor, files)}
        />
      ) : null}
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

function Toolbar({
  editor,
  uploading,
  problem,
  onDismiss,
  onPickImages,
}: {
  editor: Editor
  uploading: boolean
  problem: string
  onDismiss: () => void
  onPickImages: (files: File[]) => void
}) {
  const file = useRef<HTMLInputElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkError, setLinkError] = useState("")
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

  function openLink() {
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "")
    setLinkError("")
    setLinkOpen(true)
  }

  function applyLink(event?: FormEvent) {
    event?.preventDefault()
    let url = linkUrl.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      setLinkOpen(false)
      return
    }
    if (!/^[a-z]+:/i.test(url)) url = `https://${url}`
    if (!/^https?:\/\//i.test(url)) {
      setLinkError("Холбоос https:// эсвэл http://-ээр эхэлнэ")
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    setLinkOpen(false)
  }

  // Ctrl/⌘ + K opens the link field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && editor.isFocused) {
        event.preventDefault()
        openLink()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const divider = <span className="bg-border mx-1 h-5 w-px shrink-0" aria-hidden />

  return (
    <div className="bg-background/90 sticky top-14 z-20 -mx-4 mb-8 border-y backdrop-blur-xl sm:mx-0 sm:rounded-lg sm:border">
      <div role="toolbar" aria-label="Форматлах" className="flex items-center gap-0.5 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:px-2">
        <Select
          label="Текстийн төрөл"
          value={state.block}
          onChange={setBlock}
          className="w-[9.5rem] shrink-0"
          options={[
            { value: "p", label: "Энгийн текст" },
            { value: "h2", label: "Гарчиг" },
            { value: "h3", label: "Дэд гарчиг" },
          ]}
        />
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
        <ToolButton label="Холбоос (Ctrl+K)" active={state.link || linkOpen} onClick={openLink}>
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
        <ToolButton label={uploading ? "Зураг оруулж байна…" : "Зураг (эсвэл хуулж буулгах, чирж оруулах)"} disabled={uploading} onClick={() => file.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
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
          multiple
          className="hidden"
          onChange={(event) => {
            onPickImages(imageFiles(event.target.files))
            event.target.value = ""
          }}
        />
      </div>

      {linkOpen ? (
        <form onSubmit={applyLink} className="flex items-center gap-2 border-t px-3 py-2">
          <Link2 className="text-muted-foreground size-4 shrink-0" />
          <label htmlFor="link-url" className="sr-only">
            Холбоос
          </label>
          <input
            id="link-url"
            autoFocus
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value)
              setLinkError("")
            }}
            onKeyDown={(event) => event.key === "Escape" && (event.preventDefault(), setLinkOpen(false), editor.commands.focus())}
            placeholder="https://… (хоосон бол холбоосыг арилгана)"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          />
          {linkError ? <span className="shrink-0 text-[12px] text-[var(--down)]">{linkError}</span> : null}
          <ToolButton label="Хэрэглэх" onClick={() => applyLink()}>
            <Check className="size-4" />
          </ToolButton>
          <ToolButton label="Болих" onClick={() => (setLinkOpen(false), editor.commands.focus())}>
            <X className="size-4" />
          </ToolButton>
        </form>
      ) : null}

      {problem ? (
        <p role="alert" className="flex items-center gap-2 border-t px-3 py-2 text-[13px] text-[var(--down)]">
          <span className="flex-1">{problem}</span>
          <button type="button" onClick={onDismiss} aria-label="Хаах" className="grid size-6 place-items-center rounded-md hover:bg-foreground/[0.07]">
            <X className="size-3.5" />
          </button>
        </p>
      ) : null}
    </div>
  )
}
