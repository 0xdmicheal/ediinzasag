import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "cn"

import { buttonClass } from "@/admin/ui"

/*
 * In-app replacement for window.confirm. The browser dialog only offers "OK",
 * blocks the tab and can't say what happens. This one names the result on the
 * button ("Устгах"), puts "Болих" (Cancel) first with keyboard focus so Enter
 * never destroys anything by accident, and closes on Escape or a click outside.
 * HIG alerts.md: no "OK" for a decision; a destructive action always has Cancel.
 */

export interface ConfirmOptions {
  title: string
  message?: string
  /** Verb for the action button, e.g. "Устгах". */
  confirmLabel: string
  destructive?: boolean
}

type Ask = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Ask | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  const ask = useCallback<Ask>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setRequest({ ...options, resolve })
      }),
    [],
  )

  function close(ok: boolean) {
    request?.resolve(ok)
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {request ? <Dialog options={request} onClose={close} /> : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ask = useContext(ConfirmContext)
  if (!ask) throw new Error("useConfirm needs ConfirmProvider")
  return ask
}

function Dialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  // Runs once per dialog: focus Cancel, trap Tab, and hand focus back on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    cancel.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        closeRef.current(false)
      }
      // Two buttons: Tab and Shift+Tab move between them and never leave the dialog.
      if (event.key === "Tab") {
        event.preventDefault()
        ;(document.activeElement === cancel.current ? confirm : cancel).current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-6">
      <div className="animate-in fade-in absolute inset-0 bg-black/30 duration-150" onClick={() => onClose(false)} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={options.message ? "confirm-message" : undefined}
        className="bg-popover text-popover-foreground animate-in fade-in zoom-in-95 relative w-full max-w-sm rounded-xl border p-5 shadow-xl duration-150"
      >
        <h2 id="confirm-title" className="text-[15px] font-semibold">
          {options.title}
        </h2>
        {options.message ? (
          <p id="confirm-message" className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
            {options.message}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancel} type="button" onClick={() => onClose(false)} className={buttonClass.ghost}>
            Болих
          </button>
          <button
            ref={confirm}
            type="button"
            onClick={() => onClose(true)}
            className={cn(
              options.destructive
                ? "inline-flex h-9 items-center justify-center rounded-full bg-[var(--down)] px-4 text-[13px] font-medium text-white transition hover:brightness-95 dark:text-[#131518]"
                : buttonClass.primary,
            )}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
