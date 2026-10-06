import { hasSupabase } from "@/lib/supabase-env"
import type { ReaderAuth } from "@/reader/types"

let instance: Promise<ReaderAuth> | null = null

/** Supabase when configured, otherwise accounts kept in this browser. Loaded on demand. */
export function getReaderAuth(): Promise<ReaderAuth> {
  instance ??= hasSupabase
    ? import("@/reader/supabase-reader").then((module) => module.createSupabaseReader())
    : import("@/reader/demo-reader").then((module) => module.createDemoReader())
  return instance
}

/** Full URL of a path on this site (Google and e-mail links come back here). */
export function siteUrl(path: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`
}

/** Where e-mail links (confirmation, password reset) bring the reader back to. */
export function accountUrl() {
  return siteUrl("account")
}
