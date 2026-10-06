import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { getReaderAuth } from "@/reader/auth"
import type { LibraryEntry, ReadTags, Reader, ReaderAuth } from "@/reader/types"

interface ReaderSession {
  auth: ReaderAuth | null
  /** undefined while loading, null when signed out. */
  reader: Reader | null | undefined
  /** Re-reads the reader, e.g. after a name change (which fires no auth event). */
  refresh: () => Promise<void>
  /** The signed-in reader's finished and saved stories (empty when signed out). */
  reads: LibraryEntry[]
  saved: LibraryEntry[]
  markRead: (slug: string, tags?: ReadTags) => void
  toggleSaved: (slug: string) => Promise<void>
  /** The login popup (see LoginModal). */
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
}

const empty: LibraryEntry[] = []

const ReaderContext = createContext<ReaderSession>({
  auth: null,
  reader: undefined,
  refresh: async () => {},
  reads: [],
  saved: [],
  markRead: () => {},
  toggleSaved: async () => {},
  loginOpen: false,
  openLogin: () => {},
  closeLogin: () => {},
})

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<ReaderAuth | null>(null)
  const [reader, setReader] = useState<Reader | null | undefined>(undefined)
  /** Tagged with the reader it belongs to, so a sign-out or account switch never shows stale lists. */
  const [loginOpen, setLoginOpen] = useState(false)
  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])
  const [library, setLibrary] = useState<{ readerId: string; reads: LibraryEntry[]; saved: LibraryEntry[] } | null>(null)

  const refresh = useCallback(async () => {
    setReader(await (await getReaderAuth()).current())
  }, [])

  useEffect(() => {
    let unsubscribe = () => {}
    let cancelled = false
    getReaderAuth().then((current) => {
      if (cancelled) return
      setAuth(current)
      const load = () => current.current().then((value) => !cancelled && setReader(value))
      load()
      unsubscribe = current.onChange(load)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const readerId = reader?.id
  const current = library && library.readerId === readerId ? library : null
  const reads = current?.reads ?? empty
  const saved = current?.saved ?? empty

  const update = useCallback(
    (kind: "reads" | "saved", change: (entries: LibraryEntry[]) => LibraryEntry[]) => {
      setLibrary((value) => {
        if (!readerId) return value
        const base = value && value.readerId === readerId ? value : { readerId, reads: [], saved: [] }
        return { ...base, [kind]: change(base[kind]) }
      })
    },
    [readerId],
  )

  useEffect(() => {
    if (!auth || !readerId) return
    let cancelled = false
    Promise.all([auth.listReads(), auth.listSaved()])
      .then(([nextReads, nextSaved]) => {
        if (!cancelled) setLibrary({ readerId, reads: nextReads, saved: nextSaved })
      })
      .catch(() => {
        // Library unavailable (e.g. schema not updated yet): the account still works.
      })
    return () => {
      cancelled = true
    }
  }, [auth, readerId])

  const markRead = useCallback(
    (slug: string, tags?: ReadTags) => {
      if (!auth || !readerId) return
      update("reads", (entries) => (entries.some((entry) => entry.slug === slug) ? entries : [{ slug, at: new Date().toISOString() }, ...entries]))
      auth.markRead(slug, tags).catch(() => {})
    },
    [auth, readerId, update],
  )

  const toggleSaved = useCallback(
    async (slug: string) => {
      if (!auth || !readerId) return
      const was = saved.some((entry) => entry.slug === slug)
      update("saved", (entries) => (was ? entries.filter((entry) => entry.slug !== slug) : [{ slug, at: new Date().toISOString() }, ...entries]))
      try {
        await auth.setSaved(slug, !was)
      } catch (failure) {
        const actual = await auth.listSaved().catch(() => saved)
        update("saved", () => actual)
        throw failure
      }
    },
    [auth, readerId, saved, update],
  )

  return (
    <ReaderContext.Provider value={{ auth, reader, refresh, reads, saved, markRead, toggleSaved, loginOpen, openLogin, closeLogin }}>{children}</ReaderContext.Provider>
  )
}

export function useReader() {
  return useContext(ReaderContext)
}
