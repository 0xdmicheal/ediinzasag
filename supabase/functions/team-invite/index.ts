// Team invites for the admin's Баг page: a Supabase Edge Function (Deno).
//
// An admin enters a name, e-mail and role. The invite is recorded in team_invites (which
// gives the account its role, see handle_new_user / apply_team_invite in schema.sql) and,
// for a new address, Supabase sends the invite e-mail. Its link opens
// admin.ediinzasag.mn/welcome, where the new member sets a password and links an
// authenticator app. Someone who already has a reader account joins at once.
//
// Only admins in a two-step session (aal2) may call it.
//
// Deploy: supabase functions deploy team-invite
// Auth → URL Configuration must allow https://admin.ediinzasag.mn/welcome as a redirect URL.

import { createClient } from "npm:@supabase/supabase-js@2"
import { TWO_STEP_REQUIRED, verifiedTwoStep } from "../_shared/assurance.ts"

const ADMIN_URL = (Deno.env.get("ADMIN_URL") || "https://admin.ediinzasag.mn").replace(/\/$/, "")
const ROLES = new Set(["writer", "editor", "admin"])

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } })

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (request.method !== "POST") return json({ error: "POST only" }, 405)

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  })
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  const { data } = await db.auth.getUser(token)
  if (!data.user) return json({ error: "Нэвтэрнэ үү" }, 401)
  if (!verifiedTwoStep(token)) return json({ error: TWO_STEP_REQUIRED }, 403)
  const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
  if (profile?.role !== "admin") return json({ error: "Зөвхөн админ гишүүн урина" }, 403)

  const body = (await request.json().catch(() => ({}))) as { name?: string; email?: string; role?: string }
  const email = (body.email ?? "").trim().toLowerCase()
  const name = (body.name ?? "").trim().slice(0, 80)
  const role = body.role ?? "writer"
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return json({ error: "И-мэйл буруу байна" }, 400)
  if (!name) return json({ error: "Нэр бичнэ үү" }, 400)
  if (!ROLES.has(role)) return json({ error: "Эрх буруу байна" }, 400)

  const { data: member } = await db.from("profiles").select("id").eq("email", email).maybeSingle()
  if (member) {
    // Invited before but never opened the link: send the e-mail again.
    const { data: account } = await db.auth.admin.getUserById(member.id)
    if (account.user && !account.user.last_sign_in_at) {
      const { error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${ADMIN_URL}/welcome`, data: { name } })
      if (error) return json({ error: error.message }, 500)
      return json({ status: "resent" })
    }
    return json({ error: "Энэ и-мэйл багт бүртгэлтэй байна" }, 409)
  }

  // A fresh row each time, so apply_team_invite (after insert) runs for an existing reader account.
  await db.from("team_invites").delete().eq("email", email)
  const { error: inviteError } = await db.from("team_invites").insert({ email, name, role })
  if (inviteError) return json({ error: inviteError.message }, 500)

  // An existing account joined through the trigger: no e-mail needed.
  const { data: joined } = await db.from("profiles").select("id").eq("email", email).maybeSingle()
  if (joined) return json({ status: "joined" })

  const { error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${ADMIN_URL}/welcome`, data: { name } })
  if (error) {
    await db.from("team_invites").delete().eq("email", email)
    return json({ error: /rate limit/i.test(error.message) ? "Хэт олон урилга. Түр хүлээгээд дахин оролдоно уу" : error.message }, 500)
  }
  return json({ status: "invited" })
})
