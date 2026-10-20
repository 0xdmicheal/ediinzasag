/*
 * Team calls must come from a session that passed two-step verification
 * (aal2), like current_team_role() in schema.sql. Read the claim only from a
 * token that auth.getUser() has already accepted.
 */
export function verifiedTwoStep(token: string): boolean {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "="))).aal === "aal2"
  } catch {
    return false
  }
}

export const TWO_STEP_REQUIRED = "Хоёр шатлалт баталгаажуулалтаар дахин нэвтэрнэ үү"
