export function youtubeId(href: string) {
  try {
    return new URL(href).searchParams.get("v") ?? ""
  } catch {
    return ""
  }
}

export function YoutubeFrame({
  href,
  title,
  autoplay = false,
}: {
  href: string
  title: string
  autoplay?: boolean
}) {
  const id = youtubeId(href)
  if (!id) return null
  return (
    <iframe
      className="aspect-video w-full"
      src={`https://www.youtube-nocookie.com/embed/${id}${autoplay ? "?autoplay=1" : ""}`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
    />
  )
}
