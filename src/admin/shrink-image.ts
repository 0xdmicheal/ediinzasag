/**
 * Covers and article images go to the public site as they were uploaded, so a
 * 5 MB phone photo became a 1.5 MB+ download on the home page. Photos (JPEG,
 * WebP) are redrawn at most 1600 px wide as JPEG; PNG (charts, screenshots)
 * stays PNG and is only scaled down. Anything already small is left alone.
 */

const MAX_WIDTH = 1600
const SMALL = 300 * 1024

export async function shrinkImage(file: File): Promise<File> {
  const photo = file.type === "image/jpeg" || file.type === "image/webp"
  if (!photo && file.type !== "image/png") return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width)
  if (scale === 1 && (file.size <= SMALL || !photo)) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const type = photo ? "image/jpeg" : "image/png"
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82))
  if (!blob || blob.size >= file.size) return file
  const name = photo ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name
  return new File([blob], name, { type })
}
