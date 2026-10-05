/**
 * Ad slots. Until a sponsor is booked, the slot promotes partnerships itself.
 * To run a campaign, replace this object (or add an `image` from public/ via
 * publicUrl, or an external https URL) and the article sidebar updates.
 */
export interface AdSlot {
  /** Small label above the card, required by ad disclosure norms. */
  label: string
  title: string
  body: string
  cta: string
  href: string
  image?: string
  /** True for an external sponsor link (opens in a new tab). */
  external?: boolean
}

export const articleAd: AdSlot = {
  label: "Сурталчилгаа",
  title: "Таны брэнд энд",
  body: "Эдийн засгийг дагадаг уншигчдад хүрэх сурталчилгааны байр. Зочин дугаар, ивээн тэтгэх тойм.",
  cta: "Хамтрах санал",
  href: "/about#partner",
}
