export function youtubeId(href: string) {
  try {
    return new URL(href).searchParams.get("v") ?? ""
  } catch {
    return ""
  }
}

export function YoutubeFrame({ href, title }: { href: string; title: string }) {
  const id = youtubeId(href)
  if (!id) return null
  return (
    <iframe
      className="aspect-video w-full"
      src={`https://www.youtube-nocookie.com/embed/${id}`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
    />
  )
}
