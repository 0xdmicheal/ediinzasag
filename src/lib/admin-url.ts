/** Where the newsroom admin lives: its own site, not part of the public bundle (src/admin-main.tsx). */
export const adminUrl = (
  import.meta.env.VITE_ADMIN_URL || (import.meta.env.DEV ? "http://localhost:5181" : "https://admin.ediinzasag.mn")
).replace(/\/$/, "")
