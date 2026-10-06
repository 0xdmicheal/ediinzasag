import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase-env"

/* One Supabase client for the admin and reader accounts, so they share a session. */
let client: SupabaseClient | null = null

export function supabaseClient() {
  client ??= createClient(supabaseUrl!, supabaseAnonKey!)
  return client
}
