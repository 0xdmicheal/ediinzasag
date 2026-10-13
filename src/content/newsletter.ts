import { hasSupabase } from "@/lib/supabase-env"

/*
 * The Нийтлэл page's subscribe form. Addresses are kept on our side
 * (public.newsletter_signups via subscribe_newsletter) and imported into
 * Substack from /admin/readers → Захиалагчид. Demo mode keeps them in this browser.
 */

const DEMO_KEY = "ez-newsletter-demo-v1"

export async function subscribeNewsletter(email: string, source = "newsletter") {
  const address = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) throw new Error("И-мэйл хаягаа зөв оруулна уу.")
  if (!hasSupabase) {
    let rows: { email: string; source: string; createdAt: string }[] = []
    try {
      rows = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "[]")
    } catch {
      // Storage blocked or corrupted: start a fresh list.
    }
    if (!rows.some((row) => row.email === address)) rows.push({ email: address, source, createdAt: new Date().toISOString() })
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(rows))
    } catch {
      // Private window: the demo simply forgets.
    }
    return
  }
  const { supabaseClient } = await import("@/lib/supabase")
  const { error } = await supabaseClient().rpc("subscribe_newsletter", { address, origin: source })
  if (error) throw new Error("Бүртгэж чадсангүй. Дахин оролдоно уу.")
}
