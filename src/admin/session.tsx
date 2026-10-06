import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { getBackend } from "@/admin/backend"
import type { Backend, Member } from "@/admin/types"

interface Session {
  backend: Backend | null
  /** undefined while loading, null when signed out. */
  member: Member | null | undefined
  refresh: () => Promise<void>
}

const SessionContext = createContext<Session>({ backend: null, member: undefined, refresh: async () => {} })

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null)
  const [member, setMember] = useState<Member | null | undefined>(undefined)

  const refresh = useCallback(async () => {
    const current = await getBackend()
    setBackend(current)
    setMember(await current.currentMember())
  }, [])

  useEffect(() => {
    let unsubscribe = () => {}
    let cancelled = false
    getBackend().then((current) => {
      if (cancelled) return
      setBackend(current)
      current.currentMember().then((value) => !cancelled && setMember(value))
      unsubscribe = current.onAuthChange(() => {
        current.currentMember().then((value) => !cancelled && setMember(value))
      })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return <SessionContext.Provider value={{ backend, member, refresh }}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}

/** Backend + signed-in member, for pages inside the admin layout (both guaranteed there). */
export function useTeam() {
  const { backend, member, refresh } = useContext(SessionContext)
  return { backend: backend!, member: member!, refresh }
}
