/** One lesson inside an EZ Edu course. `href` is a YouTube watch URL. */
export type Lesson = {
  n: number
  title: string
  seconds: number
  href: string
}

/** A course is an ordered list of lessons. Titles come from the real videos. */
export type Course = {
  slug: string
  title: string
  dek: string
  lessons: Lesson[]
}

/**
 * Economy courses. Push a course here when the videos exist.
 * Example shape, not a published course:
 * { slug: "money", title: "Мөнгө", dek: "...", lessons: [{ n: 1, title: "...", seconds: 600, href: "https://www.youtube.com/watch?v=..." }] }
 */
export const courses: Course[] = []
