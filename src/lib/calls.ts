import { createClient } from "@/lib/supabase/client";
import { callTokenRequestSchema } from "@/lib/validation";
import type { CallParticipant, CallToken } from "@/lib/types";

/**
 * Client for the `livekit-token` Supabase Edge Function.
 *
 * The function resolves a room back to a family or conversation and re-checks
 * membership in the database before it signs anything — the browser cannot mint
 * itself into a room. Room names and their URL slugs live in `@/lib/call-rooms`.
 */

export class CallsError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: string | null;

  constructor(code: string, status: number, detail: string | null = null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "CallsError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/** `NEXT_PUBLIC_LIVEKIT_URL` is the only LiveKit value the browser may hold. */
export function livekitUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  return url && url.trim() ? url.trim().replace(/\/+$/, "") : null;
}

// ---------------------------------------------------------------------------
// Edge Function calls
// ---------------------------------------------------------------------------

function functionUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/functions/v1/livekit-token` : null;
}

async function accessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new CallsError("not_authenticated", 401);
  return session.access_token;
}

async function callFunction<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = functionUrl();
  if (!base) throw new CallsError("not_configured", 501, "missing_supabase_url");

  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    // Network-level failure: almost always "the function is not deployed".
    throw new CallsError("not_deployed", 0);
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
    throw new CallsError(code, response.status, detail);
  }

  return (await response.json()) as T;
}

/** Who is in the room right now. An empty room is a normal answer, not an error. */
export async function getRoomParticipants(room: string): Promise<CallParticipant[]> {
  const body = await callFunction<{ participants?: CallParticipant[] }>(
    `?action=participants&room=${encodeURIComponent(room)}`,
  );
  return body.participants ?? [];
}

/** Mints a short-lived, single-room join token. */
export async function requestCallToken(
  room: string,
  canPublish = true,
): Promise<CallToken> {
  // Client-side gate only: the function re-validates the room and then re-checks
  // membership in the database. This just keeps malformed requests at home.
  const payload = callTokenRequestSchema.parse({ room, canPublish });
  return callFunction<CallToken>("?action=token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Copy for every failure the calls surface can produce. */
export function callsErrorMessage(error: unknown): string {
  if (!(error instanceof CallsError)) return "Something went wrong. Try again.";
  switch (error.code) {
    case "not_deployed":
      return "The calls server function has not been deployed yet — see docs/SETUP-LIVEKIT.md.";
    case "calls_not_configured":
    case "not_configured":
      return "LiveKit is not configured on the server yet — see docs/SETUP-LIVEKIT.md.";
    case "not_a_member":
      return "You are not a member of this family.";
    case "not_a_conversation_member":
      return "You are not part of this conversation.";
    case "unknown_room":
      return "That call link is not valid.";
    case "call_ended":
      return "That call has ended.";
    case "not_authenticated":
      return "Please sign in again.";
    default:
      return "The call could not be started. Try again.";
  }
}
