/*
 * Supabase settings from .env.local (see .env.example). Without them the
 * admin and reader accounts run in demo mode, inside this browser only.
 * Kept apart from supabase.ts so checking the mode does not load supabase-js.
 */
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey)
