// ============================================================================
// LiveKit token function — the only thing that can hand out a room join token.
//
//   GET  ?action=participants&room=family:<uuid>   who is in the room right now
//   POST ?action=token       body {"room":"family:<uuid>","canPublish":true}
//
// Both actions resolve the room back to a family or a conversation and re-check
// membership against the database before doing anything. A valid Supabase JWT
// only establishes *who* is calling; it is never treated as permission.
//
// Deploy with:
//   supabase functions deploy livekit-token --no-verify-jwt
//
// `--no-verify-jwt` because the function verifies the JWT itself (so it can
// distinguish "no token" from "bad token" and answer with a clear error).
//
// The minted token is scoped to exactly one room and expires in an hour. The
// expiry is checked when a participant connects, so a call that runs longer
// than an hour is not interrupted.
// ============================================================================

import {
  corsHeaders,
  errorResponse,
  fail,
  json,
  requireConversationMember,
  requireMember,
  requireUser,
  serviceClient,
} from "../_shared/http.ts";
import {
  listParticipants,
  parseRoom,
  readLiveKitConfig,
  signAccessToken,
} from "../_shared/livekit.ts";

const TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Resolves a room to the membership rule that guards it. This is the whole
 * authorization model for calls, in one place.
 */
async function authorizeRoom(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
  room: string,
) {
  const parsed = parseRoom(room);
  if (parsed.kind === "family") {
    await requireMember(admin, parsed.id, userId);
  } else {
    await requireConversationMember(admin, parsed.id, userId);
  }
  return parsed;
}

async function displayNameFor(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
  fallback: string | null,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("full_name, nickname")
    .eq("id", userId)
    .maybeSingle();
  return (
    (data?.full_name as string | null) ??
    (data?.nickname as string | null) ??
    fallback
  );
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const admin = serviceClient();
    const user = await requireUser(request, admin);
    const config = readLiveKitConfig();
    if (!config) fail("calls_not_configured", "missing_livekit_secrets");

    if (action === "participants") {
      const room = url.searchParams.get("room");
      const parsed = await authorizeRoom(admin, user.id, room ?? "");
      return json({
        room: parsed.room,
        participants: await listParticipants(config, parsed.room),
      });
    }

    if (action === "token") {
      const body = (await request.json().catch(() => ({}))) as {
        room?: string;
        canPublish?: boolean;
      };
      const parsed = await authorizeRoom(admin, user.id, body.room ?? "");
      // A caller may join listen-only (e.g. audio muted by choice, or a viewer)
      // but can never publish into a room they are not a member of — that was
      // decided above, before the token exists.
      const canPublish = body.canPublish !== false;

      const token = await signAccessToken(config, {
        identity: user.id,
        name: await displayNameFor(admin, user.id, user.name),
        grant: {
          roomJoin: true,
          room: parsed.room,
          canPublish,
          canSubscribe: true,
          canPublishData: true,
        },
        ttlSeconds: TOKEN_TTL_SECONDS,
      });

      return json({
        url: config.url,
        room: parsed.room,
        identity: user.id,
        token,
      });
    }

    fail("bad_request", "unknown_action");
  } catch (error) {
    return errorResponse(error);
  }
});
