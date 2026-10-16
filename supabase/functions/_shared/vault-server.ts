// ============================================================================
// Vault-specific server helpers: Google secret handling and the stored Drive
// connection. Generic request plumbing (CORS, JWT, membership) lives in
// ./http.ts.
//
// Runtime: Deno (Supabase Edge Functions).
//
// Secrets consumed (set with `supabase secrets set ...`):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
//   GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY (base64, 32 random bytes),
//   SITE_URL (where to send the browser after the OAuth dance)
// ============================================================================

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptSecret, refreshAccessToken } from "./vault-google.ts";
import { fail } from "./http.ts";

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
