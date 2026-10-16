// ============================================================================
// Shared request plumbing for every Edge Function in this project: CORS, JWT
// verification, family-membership checks, and error mapping.
//
// Runtime: Deno (Supabase Edge Functions). This folder is excluded from the
// Next.js tsconfig and eslint config — it is deployed with
// `supabase functions deploy`, never bundled into the app.
//
// Every function here re-derives authorization from the DATABASE. A valid JWT
// only proves *who* is calling; it never proves what they may do.
// ============================================================================

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  // So the <img>/<video> proxy can read byte-range metadata.
  "access-control-expose-headers": "content-range, content-length, accept-ranges",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

/**
 * Errors travel as `Error("code:detail")`. Only codes in this map are ever
 * described to the client; anything else is logged and reported as a generic
 * 500 so internal details cannot be probed through the API.
 */
const STATUS_BY_CODE: Record<string, number> = {
  // 401 — no usable identity
  not_authenticated: 401,
  // 403 — identified, but not allowed
  not_a_member: 403,
  not_a_family_admin: 403,
  not_a_conversation_member: 403,
  not_allowed: 403,
  forbidden: 403,
  // 404
  not_found: 404,
  item_not_found: 404,
  call_not_found: 404,
  // 409 — configured, but the integration is not usable right now
  drive_not_connected: 409,
  drive_reconnect_required: 409,
  call_ended: 409,
  // 400 / 415 — malformed request
  bad_request: 400,
  unknown_room: 400,
  missing_file: 400,
  unsupported_file: 415,
  // 501 — the server-side integration has not been configured yet
  not_configured: 501,
  vault_not_configured: 501,
  calls_not_configured: 501,
};

export function errorResponse(error: unknown): Response {
  const raw = error instanceof Error ? error.message : String(error);
  const code = raw.split(":")[0];
  const status = STATUS_BY_CODE[code] ?? 500;
  if (status === 500) {
    console.error("[edge]", raw);
    return json({ error: "internal_error" }, 500);
  }
  return json({ error: code, detail: raw.slice(code.length + 1) || null }, status);
}

export function fail(code: string, detail?: string): never {
  throw new Error(detail ? `${code}:${detail}` : code);
}

/** The service-role client: bypasses RLS, so it is only used after its own checks. */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) fail("not_configured", "missing_supabase_env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type RequestUser = { id: string; email: string | null; name: string | null };

/** Verifies the caller's Supabase access token. Throws `not_authenticated`. */
export async function requireUser(
  request: Request,
  admin: SupabaseClient,
): Promise<RequestUser> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token) fail("not_authenticated");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) fail("not_authenticated");
  const user = data.user;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name : null;
  return { id: user.id, email: user.email ?? null, name: fullName };
}

/** Active membership role, or null. */
export async function familyRole(
  admin: SupabaseClient,
  familyId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("family_members")
    .select("role")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

export async function requireMember(
  admin: SupabaseClient,
  familyId: string,
  userId: string,
): Promise<string> {
  const role = await familyRole(admin, familyId, userId);
  if (!role) fail("not_a_member");
  return role;
}

export async function requireFamilyAdmin(
  admin: SupabaseClient,
  familyId: string,
  userId: string,
): Promise<string> {
  const role = await requireMember(admin, familyId, userId);
  if (role !== "owner" && role !== "admin") fail("not_a_family_admin");
  return role;
}

/** Membership of a conversation, regardless of whether it is a DM or a group. */
export async function requireConversationMember(
  admin: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<void> {
  const { data } = await admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) fail("not_a_conversation_member");
}
