/*
 * Phone numbers for SMS codes, in E.164 (+97699112233). Readers can type an
 * 8-digit Mongolian number as they usually write it; it gets +976 in front.
 */

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, "")
  let phone: string
  if (trimmed.startsWith("+")) phone = `+${digits}`
  else if (digits.length === 8) phone = `+976${digits}`
  else if (digits.length === 11 && digits.startsWith("976")) phone = `+${digits}`
  else phone = `+${digits}`
  return /^\+\d{8,15}$/.test(phone) ? phone : null
}

/** "+97699112233" → "+976 9911 2233"; other countries are shown as stored. */
export function formatPhone(phone: string) {
  const match = /^\+976(\d{4})(\d{4})$/.exec(phone)
  return match ? `+976 ${match[1]} ${match[2]}` : phone
}
