// ============================================================================
// Shared request plumbing for the Vault Edge Functions: CORS, JWT
// verification, family-membership checks, and Drive connection lookup.
//
// Runtime: Deno (Supabase Edge Functions).
// ============================================================================

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptSecret, refreshAccessToken } from "./vault-google.ts";

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
 * Errors are thrown as `Error("code:detail")`. Everything the client is allowed
 * to see is mapped here; anything else becomes a generic 500 so internal
 * details never leak through the API surface.
 */
const STATUS_BY_CODE: Record<string, number> = {
  not_authenticated: 401,
  not_a_member: 403,
  not_a_family_admin: 403,
  not_allowed: 403,
  item_not_found: 404,
  game_not_found: 404,
  vault_not_configured: 501,
  drive_not_connected: 409,
  drive_reconnect_required: 409,
  bad_request: 400,
  missing_file: 400,
  unsupported_file: 415,
  forbidden: 403,
};

export function errorResponse(error: unknown): Response {
  const raw = error instanceof Error ? error.message : String(error);
  const code = raw.split(":")[0];
  const status = STATUS_BY_CODE[code] ?? 500;
  if (status === 500) {
    // Logged server-side only.
    console.error("[vault]", raw);
    return json({ error: "internal_error" }, 500);
  }
  return json({ error: code, detail: raw.slice(code.length + 1) || null }, status);
}

export function fail(code: string, detail?: string): never {
  throw new Error(detail ? `${code}:${detail}` : code);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type VaultConfig = {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  siteUrl: string;
};

/** `null` when the Google secrets have not been configured yet. */
export function readVaultConfig(): VaultConfig | null {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const encryptionKey = Deno.env.get("GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY");
  if (!clientId || !clientSecret || !encryptionKey) return null;
  return {
    clientId,
    clientSecret,
    encryptionKey,
    siteUrl: (Deno.env.get("SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, ""),
  };
}

export function requireVaultConfig(): VaultConfig {
  const config = readVaultConfig();
  if (!config) fail("vault_not_configured", "missing_google_secrets");
  return config;
}

// ---------------------------------------------------------------------------
// Clients & identity
// ---------------------------------------------------------------------------

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) fail("vault_not_configured", "missing_supabase_env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type RequestUser = { id: string };

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
  return { id: data.user.id };
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

// ---------------------------------------------------------------------------
// Drive connection
// ---------------------------------------------------------------------------

export type DriveConnection = {
  familyId: string;
  accountEmail: string | null;
  accountName: string | null;
  connectedAt: string;
  revokedAt: string | null;
};

export async function loadConnection(
  admin: SupabaseClient,
  familyId: string,
): Promise<DriveConnection | null> {
  const { data } = await admin
    .from("vault_connections")
    .select("family_id, account_email, account_name, connected_at, revoked_at")
    .eq("family_id", familyId)
    .maybeSingle();
  if (!data) return null;
  return {
    familyId: data.family_id as string,
    accountEmail: (data.account_email as string | null) ?? null,
    accountName: (data.account_name as string | null) ?? null,
    connectedAt: data.connected_at as string,
    revokedAt: (data.revoked_at as string | null) ?? null,
  };
}

/**
 * Decrypts the stored refresh token and trades it for a fresh access token.
 *
 * Google answers a token that has expired (7 days for an unverified app, or any
 * time the user revoked access) with `invalid_grant`; when that happens the row
 * is flagged so the UI can ask for a re-connect instead of failing opaquely.
 */
export async function accessTokenFor(
  admin: SupabaseClient,
  familyId: string,
  config: VaultConfig,
): Promise<string> {
  const { data, error } = await admin
    .from("vault_connections")
    .select("refresh_token_enc, revoked_at")
    .eq("family_id", familyId)
    .maybeSingle();
  if (error || !data) fail("drive_not_connected");
  if (data.revoked_at) fail("drive_reconnect_required");

  let refreshToken: string;
  try {
    refreshToken = await decryptSecret(
      data.refresh_token_enc as string,
      config.encryptionKey,
    );
  } catch {
    fail("drive_reconnect_required", "undecryptable_token");
  }

  try {
    const tokens = await refreshAccessToken(
      refreshToken,
      config.clientId,
      config.clientSecret,
    );
    return tokens.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("invalid_grant")) {
      await admin
        .from("vault_connections")
        .update({ revoked_at: new Date().toISOString() })
        .eq("family_id", familyId);
      fail("drive_reconnect_required", "invalid_grant");
    }
    throw error;
  }
}
