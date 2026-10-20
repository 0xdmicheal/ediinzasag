/*
 * Free stand-in for Supabase's leaked-password protection (a Pro-plan feature):
 * asks HaveIBeenPwned whether a password appeared in a known breach. Only the
 * first five characters of its SHA-1 hash leave the browser (k-anonymity).
 * Any network failure counts as "not found", so sign-up never breaks on it.
 */
export async function isPwnedPassword(password: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password))
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return false
    const suffix = hash.slice(5)
    return (await res.text()).split("\n").some((line) => {
      const [tail, count] = line.trim().split(":")
      return tail === suffix && Number(count) > 0
    })
  } catch {
    return false
  }
}
