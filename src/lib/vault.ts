import { createClient } from "@/lib/supabase/client";
import type { VaultKind, VaultStatus } from "@/lib/types";

/**
 * Client for the `vault` Supabase Edge Function.
 *
 * The Edge Function holds the Google credentials, so the browser never talks to
 * Drive directly — it sends its Supabase access token and the function checks
 * family membership itself. When the function has not been deployed yet the
 * calls fail cleanly with `not_deployed`, which the UI turns into real setup
 * instructions instead of a fake success.
 */

export class VaultError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: string | null;

  constructor(code: string, status: number, detail: string | null = null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "VaultError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function functionUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/functions/v1/vault` : null;
}

async function accessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new VaultError("not_authenticated", 401);
  return session.access_token;
}

async function callVault<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = functionUrl();
  if (!base) throw new VaultError("not_configured", 501, "missing_supabase_url");

  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    // Network-level failure: almost always "the function is not deployed".
    throw new VaultError("not_deployed", 0);
  }

  if (!response.ok) {
    let code = response.status === 404 ? "not_deployed" : "unknown";
    let detail: string | null = null;
    try {
      const body = (await response.json()) as { error?: string; detail?: string | null };
      code = body.error ?? code;
      detail = body.detail ?? null;
    } catch {
      // Non-JSON body (e.g. the platform's own 404 page).
    }
    throw new VaultError(code, response.status, detail);
  }

  return (await response.json()) as T;
}

/** Mirrors `kindForMime` in the Edge Function, for a nicer default in the UI. */
export function kindFromMime(mimeType: string): VaultKind {
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation")
  ) {
    return "document";
  }
  return "other";
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function getVaultStatus(familyId: string): Promise<VaultStatus> {
  return callVault<VaultStatus>(
    `?action=status&family_id=${encodeURIComponent(familyId)}`,
  );
}

export async function getVaultConnectUrl(familyId: string): Promise<string> {
  const body = await callVault<{ url: string }>(
    `?action=connect-url&family_id=${encodeURIComponent(familyId)}`,
  );
  return body.url;
}

export type UploadVaultInput = {
  familyId: string;
  file: File;
  name: string;
  kind: VaultKind;
  caption?: string | null;
  capturedAt?: string | null;
  eventId?: string | null;
};

/**
 * Uploads one file. The bytes travel browser → Edge Function → Drive, so the
 * Google credentials stay server-side. `onProgress` is not available with
 * `fetch`, so callers show progress at the file level.
 */
export async function uploadVaultItem(input: UploadVaultInput): Promise<string> {
  const form = new FormData();
  form.set("file", input.file, input.file.name);
  form.set("family_id", input.familyId);
  form.set("name", input.name);
  form.set("kind", input.kind);
  if (input.caption) form.set("caption", input.caption);
  if (input.capturedAt) form.set("captured_at", input.capturedAt);
  if (input.eventId) form.set("event_id", input.eventId);

  const body = await callVault<{ item?: { id?: string } }>("?action=upload", {
    method: "POST",
    body: form,
  });
  return body.item?.id ?? "";
}

export async function deleteVaultItem(itemId: string): Promise<void> {
  await callVault<{ ok: boolean }>("?action=delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ item: itemId }),
  });
}

/**
 * Cookie-authenticated URL for `<img>`/`<video>`. The Next.js route forwards the
 * Supabase session to the Edge Function, because media tags cannot send headers.
 */
export function vaultContentUrl(itemId: string): string {
  return `/api/drive/content?item=${encodeURIComponent(itemId)}`;
}

/** Player-facing copy for every failure the Vault can produce. */
export function vaultErrorMessage(error: unknown): string {
  if (!(error instanceof VaultError)) return "Something went wrong. Try again.";
  switch (error.code) {
    case "not_deployed":
      return "The Vault server function has not been deployed yet — see docs/SETUP-GOOGLE-DRIVE.md.";
    case "vault_not_configured":
    case "not_configured":
      return "The Google Drive credentials are not set on the server yet — see docs/SETUP-GOOGLE-DRIVE.md.";
    case "drive_not_connected":
      return "No Google Drive account is connected for this family yet.";
    case "drive_reconnect_required":
      return "Google revoked the stored access (refresh tokens expire after 7 days while the OAuth app is in Testing). Reconnect Drive.";
    case "not_a_family_admin":
      return "Only a family owner or admin can connect Google Drive.";
    case "not_a_member":
      return "You are not a member of this family.";
    case "not_allowed":
      return "Only the person who added a memory, or a family admin, can delete it.";
    case "unsupported_file":
      return error.detail?.startsWith("too_large")
        ? "That file is larger than the 40 MB server limit. Downscaled images are fine; large videos need another route."
        : "That file type cannot be stored in the Vault.";
    case "missing_file":
      return "Pick a file first.";
    case "item_not_found":
      return "That memory no longer exists.";
    case "not_authenticated":
      return "Please sign in again.";
    default:
      return "The Vault could not complete that request. Try again.";
  }
}
