import type { Backend } from "@/admin/types"
import { hasSupabase } from "@/lib/supabase-env"

/**
 * Picks the backend. With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set
 * (see .env.example) it is Supabase; otherwise the in-browser demo.
 * Loaded lazily so the public site does not ship the admin code.
 */
export const backendMode: Backend["mode"] = hasSupabase ? "supabase" : "demo"

let instance: Promise<Backend> | null = null

export function getBackend(): Promise<Backend> {
  instance ??=
    backendMode === "supabase"
      ? import("@/admin/supabase-backend").then((module) => module.createSupabaseBackend())
      : import("@/admin/demo-backend").then((module) => module.createDemoBackend())
  return instance
}
