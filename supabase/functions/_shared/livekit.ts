// ============================================================================
// LiveKit server helpers: room-name parsing, AccessToken minting, and the one
// server-side query we need (who is already in a room).
//
// Runtime: Deno (Supabase Edge Functions).
//
// Secrets consumed:
//   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL (wss://...)
//
// Tokens are signed here with WebCrypto (HS256) rather than with the LiveKit
// Node SDK: it is ~40 lines, has no dependency, and keeps the grant shape
// visible in this file, which is the security-relevant part.
// ============================================================================

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlText(text: string): string {
  return base64Url(encoder.encode(text));
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RoomKind = "family" | "dm";

export type ParsedRoom = {
  kind: RoomKind;
  /** family id or conversation id */
  id: string;
  /** the exact LiveKit room name, e.g. `family:<uuid>` */
  room: string;
};

/**
 * Room names are derived from existing rows so no extra state is needed:
 *   family:<family_id>          → any active member of that family
 *   dm:<conversation_id>        → any member of that conversation
 *
 * The prefix is part of the room identity, so `dm:` and `family:` rooms can
 * never collide, and the uuid is validated here so a crafted room name cannot
 * reach LiveKit or a database query.
 */
export function parseRoom(room: string | null | undefined): ParsedRoom {
  if (!room) throw new Error("unknown_room:missing");
  const separator = room.indexOf(":");
  if (separator < 0) throw new Error("unknown_room:no_prefix");
  const prefix = room.slice(0, separator);
  const id = room.slice(separator + 1);
  if (prefix !== "family" && prefix !== "dm") {
    throw new Error("unknown_room:unsupported_prefix");
  }
  if (!UUID_RE.test(id)) throw new Error("unknown_room:bad_id");
  return { kind: prefix, id, room: `${prefix}:${id}` };
}

export type LiveKitConfig = {
  apiKey: string;
  apiSecret: string;
  url: string;
};

/** `null` when LiveKit has not been configured yet. */
export function readLiveKitConfig(): LiveKitConfig | null {
  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const url = Deno.env.get("LIVEKIT_URL") ?? Deno.env.get("NEXT_PUBLIC_LIVEKIT_URL");
  if (!apiKey || !apiSecret || !url) return null;
  return { apiKey, apiSecret, url: url.replace(/\/+$/, "") };
}

export type VideoGrant = {
  roomJoin?: boolean;
  room?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  roomAdmin?: boolean;
};

export type AccessTokenOptions = {
  identity: string;
  name?: string | null;
  grant: VideoGrant;
  ttlSeconds: number;
};

/**
 * Signs a LiveKit AccessToken (JWT, HS256).
 *
 * The `video` claim is the entire authorization surface: the token is useless
 * outside the single room named in `grant.room`.
 */
export async function signAccessToken(
  config: LiveKitConfig,
  options: AccessTokenOptions,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: Record<string, unknown> = {
    iss: config.apiKey,
    sub: options.identity,
    nbf: now - 10,
    exp: now + options.ttlSeconds,
    jti: crypto.randomUUID(),
    video: options.grant,
  };
  if (options.name) payload.name = options.name;
  if (options.grant.room) payload.room = options.grant.room;

  const signingInput = `${base64UrlText(JSON.stringify(header))}.${base64UrlText(
    JSON.stringify(payload),
  )}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

/** `wss://x.livekit.cloud` → `https://x.livekit.cloud` (the Twirp REST base). */
export function livekitHttpBase(url: string): string {
  return url.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
}

export type RoomParticipant = {
  identity: string;
  name: string | null;
  /** ISO timestamp, or null when the platform's format was not understood. */
  joinedAt: string | null;
};

/**
 * Lists who is currently in a room (Twirp REST). An unknown or empty room is
 * not an error — it simply has nobody in it, which is the normal state.
 */
export async function listParticipants(
  config: LiveKitConfig,
  room: string,
): Promise<RoomParticipant[]> {
  const serverToken = await signAccessToken(config, {
    identity: "ocf-server",
    grant: { roomAdmin: true, room },
    ttlSeconds: 60,
  });

  const response = await fetch(
    `${livekitHttpBase(config.url)}/twirp/livekit.RoomService/ListParticipants`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${serverToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ room }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    // LiveKit answers "not_found" when the room has never been created.
    if (response.status === 404 || text.includes("not_found")) return [];
    throw new Error(`livekit_list_failed:${response.status}:${text.slice(0, 200)}`);
  }

  const body = (await response.json()) as {
    participants?: Array<{ identity?: string; name?: string; joined_at?: unknown }>;
  };

  return (body.participants ?? [])
    .filter((participant) => typeof participant.identity === "string")
    .map((participant) => ({
      identity: participant.identity as string,
      name: participant.name?.trim() ? participant.name : null,
      joinedAt: normaliseTimestamp(participant.joined_at),
    }));
}

/** LiveKit sends a protobuf Timestamp; older builds send int64 nanoseconds. */
function normaliseTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "number") {
    const date = new Date(value / 1_000_000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}
