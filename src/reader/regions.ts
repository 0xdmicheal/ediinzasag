/*
 * Where a reader lives, picked by them in their profile (optional). Ids are
 * stored in readers.region (schema.sql checks the shape, not the list), so
 * keep ids stable; labels can change freely.
 */
export const regions = [
  { id: "ulaanbaatar", label: "Улаанбаатар" },
  { id: "arkhangai", label: "Архангай" },
  { id: "bayan-ulgii", label: "Баян-Өлгий" },
  { id: "bayankhongor", label: "Баянхонгор" },
  { id: "bulgan", label: "Булган" },
  { id: "govi-altai", label: "Говь-Алтай" },
  { id: "govisumber", label: "Говьсүмбэр" },
  { id: "darkhan-uul", label: "Дархан-Уул" },
  { id: "dornogovi", label: "Дорноговь" },
  { id: "dornod", label: "Дорнод" },
  { id: "dundgovi", label: "Дундговь" },
  { id: "zavkhan", label: "Завхан" },
  { id: "orkhon", label: "Орхон" },
  { id: "uvurkhangai", label: "Өвөрхангай" },
  { id: "umnugovi", label: "Өмнөговь" },
  { id: "sukhbaatar", label: "Сүхбаатар" },
  { id: "selenge", label: "Сэлэнгэ" },
  { id: "tuv", label: "Төв" },
  { id: "uvs", label: "Увс" },
  { id: "khovd", label: "Ховд" },
  { id: "khuvsgul", label: "Хөвсгөл" },
  { id: "khentii", label: "Хэнтий" },
  { id: "abroad", label: "Гадаадад" },
] as const

export type RegionId = (typeof regions)[number]["id"]

const labels = new Map<string, string>(regions.map((region) => [region.id, region.label]))

export function regionLabel(id: string) {
  return labels.get(id) ?? (id === "unknown" || !id ? "Тодорхойгүй" : id)
}
