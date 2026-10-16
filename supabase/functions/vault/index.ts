// ============================================================================
// Vault Edge Function — the only holder of the Google Drive credentials.
//
// Actions (all require a Supabase access token unless noted):
//
//   GET  ?action=status&family_id=<uuid>     connection + configuration state
//   GET  ?action=connect-url&family_id=<uuid>  signed Google consent URL (admin)
//   GET  ?action=content&item=<uuid>         stream a file's bytes (member)
//   POST ?action=upload                      multipart upload (member)
//   POST ?action=delete                      remove a memory (member)
//
// Deploy with:
//   supabase functions deploy vault --no-verify-jwt
//
// `--no-verify-jwt` is required because this function verifies the JWT itself
// (so it can distinguish "no token" from "bad token" and return clear errors).
// Membership is always re-checked against the database — the token alone is
// never treated as authorization.
// ============================================================================

import {
  accessTokenFor,
  corsHeaders,
  errorResponse,
  fail,
  json,
  loadConnection,
  readVaultConfig,
  requireFamilyAdmin,
  requireMember,
  requireUser,
  serviceClient,
} from "../_shared/vault-server.ts";
import {
  VAULT_ROOT_FOLDER,
  buildConsentUrl,
  deleteFile,
  downloadFile,
  ensureFolder,
  getFileMetadata,
  signState,
  uploadFile,
} from "../_shared/vault-google.ts";

const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const ALLOWED_KINDS = new Set(["photo", "video", "audio", "document", "other"]);

const DRIVE_METADATA_FIELDS =
  "id,name,mimeType,size,modifiedTime,imageMediaMetadata,videoMediaMetadata";

/** Maps a MIME type onto the `kind` enum stored in Postgres. */
function kindForMime(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation") ||
    mimeType === "application/json"
  ) {
    return "document";
  }
  return "other";
}

/** Year the memory happened: explicit value, else EXIF, else upload time. */
function yearFrom(capturedAt: string | null): number {
  if (!capturedAt) return new Date().getUTCFullYear();
  const parsed = new Date(capturedAt);
  return Number.isNaN(parsed.getTime())
    ? new Date().getUTCFullYear()
    : parsed.getUTCFullYear();
}

async function folderForFamily(
  accessToken: string,
  familyName: string,
): Promise<string> {
  const rootId = await ensureFolder(accessToken, VAULT_ROOT_FOLDER);
  // One subfolder per family keeps unrelated albums apart inside the single
  // connected Drive account.
  return ensureFolder(accessToken, familyName, rootId);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handleStatus(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
  familyId: string,
): Promise<Response> {
  const role = await requireMember(admin, familyId, userId);
  const config = readVaultConfig();
  const canConnect = role === "owner" || role === "admin";

  if (!config) {
    return json({
      configured: false,
      connected: false,
      canConnect,
      accountEmail: null,
      accountName: null,
      revoked: false,
      reason: "missing_google_secrets",
      folderName: VAULT_ROOT_FOLDER,
    });
  }

  const connection = await loadConnection(admin, familyId);
  return json({
    configured: true,
    connected: Boolean(connection && !connection.revokedAt),
    canConnect,
    accountEmail: connection?.accountEmail ?? null,
    accountName: connection?.accountName ?? null,
    revoked: Boolean(connection?.revokedAt),
    reason: connection?.revokedAt ? "invalid_grant" : null,
    folderName: VAULT_ROOT_FOLDER,
  });
}

async function handleConnectUrl(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
  familyId: string,
): Promise<Response> {
  const config = readVaultConfig();
  if (!config) fail("vault_not_configured", "missing_google_secrets");
  await requireFamilyAdmin(admin, familyId, userId);

  const { buildConsentUrl, signState } = await import("../_shared/vault-google.ts");
  const state = await signState(
    { f: familyId, u: userId, n: crypto.randomUUID(), t: Date.now() },
    config.encryptionKey,
  );
  return json({ url: buildConsentUrl(config.clientId, state) });
}

async function handleContent(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
  request: Request,
  itemId: string,
): Promise<Response> {
  const config = readVaultConfig();
  if (!config) fail("vault_not_configured", "missing_google_secrets");

  const { data: item } = await admin
    .from("vault_items")
    .select("id, family_id, drive_file_id, name, mime_type, upload_state")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) fail("item_not_found");

  // Membership is checked against the *item's* family, not the caller's active
  // one — that is what stops a member of family B reading family A's files.
  await requireMember(admin, item.family_id as string, userId);

  const driveFileId = item.drive_file_id as string | null;
  if (!driveFileId || item.upload_state !== "ready") {
    fail("bad_request", "upload_incomplete");
  }

  const accessToken = await accessTokenFor(admin, item.family_id as string, config);
  const upstream = await downloadFile(
    accessToken,
    driveFileId,
    request.headers.get("range"),
  );
  if (!upstream.ok && upstream.status !== 206) {
    const text = await upstream.text().catch(() => "");
    console.error("[vault] drive download failed", upstream.status, text.slice(0, 300));
    fail("bad_request", "drive_download_failed");
  }

  const headers = new Headers(corsHeaders);
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? (item.mime_type as string),
  );
  headers.set("accept-ranges", upstream.headers.get("accept-ranges") ?? "bytes");
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("content-range", contentRange);
  // Private: the response is gated by the caller's JWT, so shared caches must
  // never keep a copy.
  headers.set("cache-control", "private, max-age=300");

  return new Response(upstream.body, { status: upstream.status, headers });
}

async function handleUpload(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
  request: Request,
): Promise<Response> {
  const config = readVaultConfig();
  if (!config) fail("vault_not_configured", "missing_google_secrets");

  const form = await request.formData();
  const file = form.get("file");
  const familyId = form.get("family_id");
  if (!(file instanceof File)) fail("missing_file");
  if (typeof familyId !== "string" || !familyId) fail("bad_request", "family_id");
  if (file.size === 0) fail("missing_file");
  if (file.size > MAX_UPLOAD_BYTES) {
    fail("unsupported_file", `too_large:${file.size}`);
  }

  await requireMember(admin, familyId, userId);

  const rawName = form.get("name");
  const name =
    typeof rawName === "string" && rawName.trim()
      ? rawName.trim().slice(0, 300)
      : file.name.slice(0, 300) || "Memory";
  const mimeType = file.type || "application/octet-stream";

  const rawKind = form.get("kind");
  const kind =
    typeof rawKind === "string" && ALLOWED_KINDS.has(rawKind)
      ? rawKind
      : kindForMime(mimeType);

  const rawCaption = form.get("caption");
  const caption =
    typeof rawCaption === "string" && rawCaption.trim()
      ? rawCaption.trim().slice(0, 2000)
      : null;

  const rawCapturedAt = form.get("captured_at");
  let capturedAt: string | null = null;
  if (typeof rawCapturedAt === "string" && rawCapturedAt.trim()) {
    const parsed = new Date(rawCapturedAt);
    if (Number.isNaN(parsed.getTime())) fail("bad_request", "captured_at");
    capturedAt = parsed.toISOString();
  }

  const rawEventId = form.get("event_id");
  const eventId =
    typeof rawEventId === "string" && rawEventId.trim() ? rawEventId.trim() : null;

  if (eventId) {
    // The event must belong to the same family; a forged id would otherwise
    // let a memory be filed against another family's calendar entry.
    const { data: event } = await admin
      .from("family_events")
      .select("id")
      .eq("id", eventId)
      .eq("family_id", familyId)
      .maybeSingle();
    if (!event) fail("bad_request", "event_id");
  }

  // Row first, Drive second: if the upload dies half-way the row is left in
  // `pending` and can be cleaned up, rather than orphaning a file with no index.
  const { data: row, error: insertError } = await admin
    .from("vault_items")
    .insert({
      family_id: familyId,
      added_by: userId,
      name,
      mime_type: mimeType,
      size_bytes: file.size,
      kind,
      caption,
      captured_at: capturedAt,
      year: yearFrom(capturedAt),
      event_id: eventId,
      upload_state: "pending",
    })
    .select("id")
    .single();
  if (insertError || !row) {
    console.error("[vault] insert failed", insertError?.message);
    fail("bad_request", "insert_failed");
  }
  const itemId = row.id as string;

  try {
    const accessToken = await accessTokenFor(admin, familyId, config);
    const { data: family } = await admin
      .from("families")
      .select("name")
      .eq("id", familyId)
      .maybeSingle();
    const folderId = await folderForFamily(
      accessToken,
      (family?.name as string | undefined)?.slice(0, 120) ?? "Family",
    );

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadFile(accessToken, {
      name,
      mimeType,
      bytes,
      parentId: folderId,
      modifiedTime: capturedAt ?? undefined,
    });

    // Ask Drive what it actually stored (size and capture time can differ from
    // what the browser claimed).
    let sizeBytes = file.size;
    let finalCapturedAt = capturedAt;
    try {
      const metadata = await getFileMetadata(
        accessToken,
        uploaded.id,
        DRIVE_METADATA_FIELDS,
      );
      if (metadata.size) sizeBytes = Number(metadata.size);
      if (!finalCapturedAt) {
        const exifTime =
          metadata.imageMediaMetadata?.time ??
          metadata.videoMediaMetadata?.creationTime ??
          null;
        if (exifTime) {
          const parsed = new Date(exifTime);
          if (!Number.isNaN(parsed.getTime())) finalCapturedAt = parsed.toISOString();
        }
      }
    } catch (error) {
      // Non-fatal: the index row is still correct enough to be useful.
      console.error("[vault] metadata lookup failed", error);
    }

    const { data: updated } = await admin
      .from("vault_items")
      .update({
        drive_file_id: uploaded.id,
        drive_folder_id: folderId,
        size_bytes: sizeBytes,
        captured_at: finalCapturedAt,
        year: yearFrom(finalCapturedAt),
        upload_state: "ready",
      })
      .eq("id", itemId)
      .select("id")
      .single();

    return json({ item: updated ?? { id: itemId } }, 201);
  } catch (error) {
    await admin
      .from("vault_items")
      .update({ upload_state: "failed" })
      .eq("id", itemId);
    throw error;
  }
}

async function handleDelete(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
  request: Request,
): Promise<Response> {
  const config = readVaultConfig();
  if (!config) fail("vault_not_configured", "missing_google_secrets");

  let itemId = new URL(request.url).searchParams.get("item");
  if (!itemId) {
    const body = (await request.json().catch(() => ({}))) as { item?: string };
    itemId = body.item ?? null;
  }
  if (!itemId) fail("bad_request", "item");

  const { data: item } = await admin
    .from("vault_items")
    .select("id, family_id, added_by, drive_file_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) fail("item_not_found");

  const role = await requireMember(admin, item.family_id as string, userId);
  const canDelete =
    item.added_by === userId || role === "owner" || role === "admin";
  if (!canDelete) fail("not_allowed", "only_the_uploader_or_admin");

  if (item.drive_file_id) {
    const accessToken = await accessTokenFor(admin, item.family_id as string, config);
    await deleteFile(accessToken, item.drive_file_id as string);
  }

  // Tags cascade; the index row is the last thing to go.
  const { error } = await admin.from("vault_items").delete().eq("id", itemId);
  if (error) {
    console.error("[vault] delete failed", error.message);
    fail("bad_request", "delete_failed");
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const admin = serviceClient();
    const user = await requireUser(request, admin);

    switch (action) {
      case "status": {
        const familyId = url.searchParams.get("family_id");
        if (!familyId) fail("bad_request", "family_id");
        return await handleStatus(admin, user.id, familyId);
      }
      case "connect-url": {
        const familyId = url.searchParams.get("family_id");
        if (!familyId) fail("bad_request", "family_id");
        return await handleConnectUrl(admin, user.id, familyId);
      }
      case "content": {
        const itemId = url.searchParams.get("item");
        if (!itemId) fail("bad_request", "item");
        return await handleContent(admin, user.id, request, itemId);
      }
      case "upload":
        return await handleUpload(admin, user.id, request);
      case "delete":
        return await handleDelete(admin, user.id, request);
      default:
        fail("bad_request", "unknown_action");
    }
  } catch (error) {
    return errorResponse(error);
  }
});
