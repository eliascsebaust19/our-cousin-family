// ============================================================================
// Shared Google Drive plumbing for the Vault Edge Functions.
//
// Runtime: Deno (Supabase Edge Functions). This folder is deliberately excluded
// from the Next.js tsconfig and eslint config — it is deployed with
// `supabase functions deploy`, never bundled into the app.
//
// Secrets consumed (set with `supabase secrets set ...`):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
//   GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY (base64, 32 random bytes),
//   SITE_URL (where to send the browser after the OAuth dance)
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are injected into
// every Edge Function by the platform.
// ============================================================================

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
export const GOOGLE_DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

/** The one folder the app owns inside the connected Drive account. */
export const VAULT_ROOT_FOLDER = "Our Cousin Family";

/**
 * `drive.file` only ever exposes files this app created, which is the narrowest
 * scope that still lets the Vault work. `openid email profile` is used purely to
 * show which account is connected.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile",
].join(" ");

// ---------------------------------------------------------------------------
// base64 helpers (Deno's atob/btoa are available but only handle latin1)
// ---------------------------------------------------------------------------

function base64ToBytes(value: string): Uint8Array {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Refresh-token encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

/**
 * The 32-byte master secret is run through HKDF so each purpose gets its own
 * key — the same secret can then encrypt tokens *and* sign OAuth state without
 * the two uses sharing key material.
 */
async function deriveAesKey(secretBase64: string, purpose: string, usage: KeyUsage[]) {
  const master = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secretBase64),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("our-cousin-family/vault/v1"),
      info: encoder.encode(purpose),
    },
    master,
    { name: "AES-GCM", length: 256 },
    false,
    usage,
  );
}

/** Returns `base64(iv).base64(ciphertext||tag)` — never stored anywhere else. */
export async function encryptSecret(plaintext: string, secretBase64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secretBase64, "refresh-token", ["encrypt"]);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

export async function decryptSecret(payload: string, secretBase64: string): Promise<string> {
  const [ivPart, dataPart] = payload.split(".");
  if (!ivPart || !dataPart) throw new Error("malformed_ciphertext");
  const key = await deriveAesKey(secretBase64, "refresh-token", ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivPart) },
    key,
    base64ToBytes(dataPart),
  );
  return decoder.decode(plain);
}

// ---------------------------------------------------------------------------
// OAuth `state`
//
// `state` names the family the connection belongs to, so it must be impossible
// to forge: without a signature an attacker could point another family's vault
// at their own Drive account and read everything that family uploads.
// ---------------------------------------------------------------------------

export type OAuthState = {
  /** family id */
  f: string;
  /** user id who started the flow */
  u: string;
  /** nonce */
  n: string;
  /** issued-at, ms */
  t: number;
};

const STATE_MAX_AGE_MS = 15 * 60 * 1000;

async function hmacKey(secretBase64: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(secretBase64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

export async function signState(state: OAuthState, secretBase64: string): Promise<string> {
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(state)));
  const key = await hmacKey(secretBase64, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`vault-state.${body}`));
  return `${body}.${bytesToBase64Url(new Uint8Array(mac))}`;
}

export async function verifyState(token: string, secretBase64: string): Promise<OAuthState> {
  const [body, mac] = token.split(".");
  if (!body || !mac) throw new Error("malformed_state");
  const key = await hmacKey(secretBase64, ["verify"]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64ToBytes(mac),
    encoder.encode(`vault-state.${body}`),
  );
  if (!valid) throw new Error("bad_state_signature");
  const state = JSON.parse(decoder.decode(base64ToBytes(body))) as OAuthState;
  if (typeof state.f !== "string" || typeof state.u !== "string") {
    throw new Error("malformed_state");
  }
  if (Date.now() - state.t > STATE_MAX_AGE_MS) throw new Error("state_expired");
  return state;
}

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export function googleRedirectUri(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("missing_supabase_url");
  return `${supabaseUrl}/functions/v1/drive-oauth-callback`;
}

export function buildConsentUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    // `offline` + `consent` is what makes Google hand back a refresh token.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function postToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    // Google reports things like {"error":"invalid_grant"} — surface it verbatim
    // so the UI can say "reconnect your Drive account" instead of "unknown".
    throw new Error(`google_token_error:${response.status}:${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as GoogleTokenResponse;
}

export function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokenResponse> {
  return postToken(
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  );
}

export function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokenResponse> {
  return postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

export type GoogleIdentity = { email: string | null; name: string | null };

export async function fetchGoogleIdentity(accessToken: string): Promise<GoogleIdentity> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return { email: null, name: null };
  const body = (await response.json()) as { email?: string; name?: string };
  return { email: body.email ?? null, name: body.name ?? null };
}

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------

export type DriveFile = {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  imageMediaMetadata?: { time?: string };
  videoMediaMetadata?: { creationTime?: string };
};

async function driveError(response: Response, fallback: string): Promise<Error> {
  const text = await response.text().catch(() => "");
  return new Error(`${fallback}:${response.status}:${text.slice(0, 300)}`);
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Finds (or creates) a folder by name inside `parentId`. `drive.file` scope
 * means the app only ever sees folders it created itself, so a name match is
 * unambiguous.
 */
export async function ensureFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const query = [
    `name = '${escapeDriveQuery(name)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const listUrl = new URL(GOOGLE_DRIVE_FILES_URL);
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("fields", "files(id,name)");
  listUrl.searchParams.set("spaces", "drive");
  listUrl.searchParams.set("pageSize", "1");

  const list = await fetch(listUrl, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!list.ok) throw await driveError(list, "drive_folder_lookup_failed");
  const found = (await list.json()) as { files?: DriveFile[] };
  if (found.files && found.files.length > 0) return found.files[0].id;

  const create = await fetch(GOOGLE_DRIVE_FILES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!create.ok) throw await driveError(create, "drive_folder_create_failed");
  const created = (await create.json()) as DriveFile;
  return created.id;
}

export type UploadResult = DriveFile;

/**
 * Single-request multipart upload (metadata + bytes). Kept to one request
 * because Edge Functions have a bounded memory budget; the client downscales
 * images before sending so payloads stay small.
 */
export async function uploadFile(
  accessToken: string,
  options: {
    name: string;
    mimeType: string;
    bytes: Uint8Array;
    parentId: string;
    modifiedTime?: string;
  },
): Promise<UploadResult> {
  const boundary = `ocf-${crypto.randomUUID()}`;
  const metadata = {
    name: options.name,
    parents: [options.parentId],
    ...(options.modifiedTime ? { modifiedTime: options.modifiedTime } : {}),
  };

  const preamble = encoder.encode(
    `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${options.mimeType}\r\n\r\n`,
  );
  const epilogue = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(preamble.length + options.bytes.length + epilogue.length);
  body.set(preamble, 0);
  body.set(options.bytes, preamble.length);
  body.set(epilogue, preamble.length + options.bytes.length);

  const response = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) throw await driveError(response, "drive_upload_failed");
  return (await response.json()) as DriveFile;
}

export async function getFileMetadata(
  accessToken: string,
  fileId: string,
  fields = "id,name,mimeType,size,modifiedTime,imageMediaMetadata,videoMediaMetadata",
): Promise<DriveFile> {
  const url = new URL(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`);
  url.searchParams.set("fields", fields);
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw await driveError(response, "drive_metadata_failed");
  return (await response.json()) as DriveFile;
}

/**
 * Streams the file bytes back. The `Range` header is forwarded so image and
 * video tags can seek without pulling the whole file.
 */
export function downloadFile(
  accessToken: string,
  fileId: string,
  range: string | null,
): Promise<Response> {
  const url = new URL(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");
  return fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(range ? { range } : {}),
    },
  });
}

export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  const response = await fetch(
    `${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } },
  );
  // 404 means someone already removed it in Drive — nothing left to do.
  if (!response.ok && response.status !== 404) {
    throw await driveError(response, "drive_delete_failed");
  }
}
