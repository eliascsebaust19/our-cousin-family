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

function functionUrl(): string {
  // Use Next.js internal API route (/api/calls), which runs server-side with LIVEKIT_API_KEY/SECRET
  return "/api/calls";
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
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    // Network-level failure
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
      // Non-JSON body
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
      return "The calls server is not reachable. Check your connection.";
    case "calls_not_configured":
    case "not_configured":
      return "LiveKit credentials (LIVEKIT_API_KEY / LIVEKIT_API_SECRET) are not configured on the server.";
    case "permission_denied":
      return "Microphone or camera permission was denied in your browser settings.";
    case "not_a_member":
      return "You are not a member of this family.";
    case "not_a_conversation_member":
      return "You are not part of this conversation.";
    case "unknown_room":
      return "That call link is not valid.";
    case "call_ended":
      return "The call has ended.";
    case "not_authenticated":
      return "Please sign in again.";
    default:
      return "The call could not be started. Try again.";
  }
}
