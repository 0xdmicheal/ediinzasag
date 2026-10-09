export interface Reader {
  id: string
  /** Empty for readers who signed up with a phone number only. */
  email: string
  /** E.164, empty unless they signed up or confirmed a phone. */
  phone: string
  name: string
  /** Editors and admins signed in on the site may remove anyone's comment. */
  moderator: boolean
  /** Profile setting: comments are posted as "Зочин" instead of the name. */
  anonymous: boolean
  /** Profile picture, "<style>:<seed>" (see ReaderAvatar); empty for the default face. */
  avatar: string
  /** YYYY-MM-DD, empty until the reader fills in their profile. */
  birthDate: string
  gender: Gender | ""
  /** Region id from regions.ts (aimag, Улаанбаатар or abroad); empty when not shared. */
  region: string
  /** Worn badge id (see badges.tsx), empty for none. */
  badge: string
  /** Order of sign-up (1, 2, 3…); the first 3,000 get the founder badge. */
  memberNo: number | null
}

/** Desk and topic of a finished story, so the database can count achievements too. */
export interface ReadTags {
  desk?: string
  topic?: string
}

export type Gender = "female" | "male" | "unspecified"

export const genderLabel: Record<Gender, string> = {
  female: "Эмэгтэй",
  male: "Эрэгтэй",
  unspecified: "Хэлэхгүй",
}

/** Fields a reader edits on their profile (name has its own call, as before). */
export interface ProfilePatch {
  avatar?: string
  birthDate?: string
  gender?: Gender
  /** Region id, or "" to stop sharing it. */
  region?: string
}

/** Readers must be at least this old (birth date check). */
export const MIN_AGE = 13

export interface StoryComment {
  id: string
  slug: string
  /** True when the signed-in reader wrote it. Who wrote a comment is never sent to the browser otherwise. */
  mine: boolean
  /** Posted as "Зочин": the name is not stored on the comment at all. */
  anonymous: boolean
  authorName: string
  /** The author's picture when they posted (empty for "Зочин"). */
  authorAvatar: string
  /** The author's worn badge (empty for "Зочин" or none). */
  authorBadge: string
  body: string
  createdAt: string
  editedAt: string | null
  /** Like total, kept by the database. */
  likes: number
}

export const COMMENT_MAX = 2000

export type CodeChannel = "email" | "phone"

/** A story the reader finished or saved, by slug, newest first. */
export interface LibraryEntry {
  slug: string
  at: string
}

/** Reader accounts on the public site. Staff roles live in the admin, not here. */
export interface ReaderAuth {
  mode: "demo" | "supabase"
  current(): Promise<Reader | null>
  onChange(callback: () => void): () => void
  /** Resolves to true when the reader must confirm their e-mail before signing in. */
  signUp(name: string, email: string, password: string): Promise<boolean>
  signIn(email: string, password: string): Promise<void>
  /**
   * Sends a one-time code by e-mail or SMS (creating the account if new).
   * `value` is the e-mail, or the phone in E.164. Demo mode returns the code, since nothing is sent.
   */
  requestCode(channel: CodeChannel, value: string): Promise<string | null>
  verifyCode(channel: CodeChannel, value: string, code: string): Promise<void>
  /** Google sign-in (creating the account if new); comes back to `returnTo`, a path on this site. */
  signInWithGoogle(returnTo: string): Promise<void>
  signOut(): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  updateName(name: string): Promise<void>
  /** Picture, birth date and gender. */
  updateProfile(patch: ProfilePatch): Promise<void>
  /** Sets a password, or changes it; works for Google, code and phone accounts too. */
  updatePassword(password: string): Promise<void>
  /** Adds or changes the e-mail. Resolves to true when the reader must confirm it from their inbox first. */
  updateEmail(email: string): Promise<boolean>
  /** Post future comments as "Зочин" (true) or under the name (false). Past comments keep how they were posted. */
  setAnonymous(anonymous: boolean): Promise<void>

  listReads(): Promise<LibraryEntry[]>
  /** Records a finished story once; reading it again keeps the first date. */
  markRead(slug: string, tags?: ReadTags): Promise<void>
  listSaved(): Promise<LibraryEntry[]>
  setSaved(slug: string, saved: boolean): Promise<void>

  /** 🔥 on a story or letter: public total, and whether the signed-in reader gave one. */
  getFire(slug: string): Promise<{ count: number; mine: boolean }>
  setFire(slug: string, on: boolean): Promise<void>

  /** Ids of the badges the reader bought (the founder badge is not listed; it comes with memberNo). */
  listBadges(): Promise<string[]>
  /** Spends points on a badge; the database checks the balance. */
  buyBadge(id: string): Promise<void>
  /** Wears an owned badge next to the name; "" takes it off. */
  wearBadge(id: string): Promise<void>

  /** Public: anyone can read a story's comments, oldest first. */
  listComments(slug: string): Promise<StoryComment[]>
  /** Posted under the name or as "Зочин", following the reader's profile setting. */
  addComment(slug: string, body: string): Promise<StoryComment>
  editComment(id: string, body: string): Promise<StoryComment>
  deleteComment(id: string): Promise<void>
  /** Ids of this story's comments the signed-in reader liked. */
  listMyLikes(slug: string): Promise<string[]>
  like(commentId: string, liked: boolean): Promise<void>
}
