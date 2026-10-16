// ============================================================================
// Google OAuth callback for the Memory Vault.
//
// This is the redirect URI registered in Google Cloud Console:
//   https://<project-ref>.supabase.co/functions/v1/drive-oauth-callback
//
// Google sends the browser here with `?code=...&state=...`. The function:
//   1. verifies the HMAC signature on `state` (so a forged family id cannot
//      point another family's vault at the attacker's Drive account),
//   2. re-checks that the caller is still an owner/admin of that family,
//   3. exchanges the code for a refresh token,
//   4. encrypts it with GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY and upserts it into
//      `vault_connections`, which no client role can read,
//   5. creates the `Our Cousin Family` folder tree,
//   6. bounces the browser back to SITE_URL/vault with a result flag.
//
// The browser NEVER sees the client secret, the refresh token, or the access
// token.
//
// Deploy with:
//   supabase functions deploy drive-oauth-callback --no-verify-jwt
//
// `--no-verify-jwt` is required: Google's redirect carries no Supabase token.
// Authorization comes from the signed `state` plus a fresh database check.
// ============================================================================

import {
  VAULT_ROOT_FOLDER,
  encryptSecret,
  ensureFolder,
  exchangeCodeForTokens,
  fetchGoogleIdentity,
  verifyState,
} from "../_shared/vault-google.ts";
import {
  fail,
  familyRole,
  readVaultConfig,
  serviceClient,
} from "../_shared/vault-server.ts";

/** Where the browser lands when something goes wrong. */
function backTo(siteUrl: string, params: Record<string, string>): Response {
  const url = new URL(`${siteUrl}/vault`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Response(null, { status: 302, headers: { location: url.toString() } });
}

Deno.serve(async (request: Request) => {
  const config = readVaultConfig();
  const siteUrl = config?.siteUrl ?? "http://localhost:3000";

  try {
    if (!config) fail("vault_not_configured", "missing_google_secrets");

    const url = new URL(request.url);
    const denied = url.searchParams.get("error");
    if (denied) {
      return backTo(siteUrl, { drive: "error", reason: denied.slice(0, 60) });
    }

    const code = url.searchParams.get("code");
    const stateToken = url.searchParams.get("state");
    if (!code || !stateToken) fail("bad_request", "missing_code_or_state");

    // The signature is what makes `state` trustworthy.
    const state = await verifyState(stateToken, config.encryptionKey);

    const admin = serviceClient();
    const role = await familyRole(admin, state.f, state.u);
    if (role !== "owner" && role !== "admin") fail("not_a_family_admin");

    const tokens = await exchangeCodeForTokens(
      code,
      config.clientId,
      config.clientSecret,
    );
    if (!tokens.refresh_token) {
      // Google only returns a refresh token on the first consent; `prompt=consent`
      // forces it again, so reaching here means the grant was reused.
      fail("bad_request", "no_refresh_token");
    }

    const identity = await fetchGoogleIdentity(tokens.access_token);

    // Encrypt before it touches the database.
    const encrypted = await encryptSecret(tokens.refresh_token, config.encryptionKey);

    const { error: upsertError } = await admin.from("vault_connections").upsert(
      {
        family_id: state.f,
        account_email: identity.email,
        account_name: identity.name,
        refresh_token_enc: encrypted,
        scope: tokens.scope ?? null,
        revoked_at: null,
        connected_by: state.u,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "family_id" },
    );
    if (upsertError) {
      console.error("[drive-oauth] upsert failed", upsertError.message);
      fail("bad_request", "connection_store_failed");
    }

    // Create the folder tree now so the first upload has somewhere to go.
    try {
      const rootId = await ensureFolder(tokens.access_token, VAULT_ROOT_FOLDER);
      const { data: family } = await admin
        .from("families")
        .select("name")
        .eq("id", state.f)
        .maybeSingle();
      if (family?.name) {
        await ensureFolder(
          tokens.access_token,
          String(family.name).slice(0, 120),
          rootId,
        );
      }
    } catch (error) {
      // The connection is already saved; folders are created lazily on upload.
      console.error("[drive-oauth] folder bootstrap failed", error);
    }

    return backTo(siteUrl, { drive: "connected" });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error("[drive-oauth]", raw);
    const code = raw.split(":")[0];
    return backTo(siteUrl, { drive: "error", reason: code.slice(0, 60) });
  }
});
