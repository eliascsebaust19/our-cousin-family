import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  listParticipants,
  parseRoom,
  readLiveKitConfig,
  signAccessToken,
} from "@/lib/server/livekit";

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

async function authorizeUserAndRoom(request: Request, roomString: string) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "") || null;

  let supabase: any;
  let user: any = null;

  if (bearerToken) {
    const tokenClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      },
    );
    const { data: authData } = await tokenClient.auth.getUser(bearerToken);
    if (authData?.user) {
      user = authData.user;
      supabase = tokenClient;
    }
  }

  if (!user) {
    supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    user = authData?.user ?? null;
  }

  if (!user) {
    return { error: "not_authenticated", status: 401 };
  }

  let parsed;
  try {
    parsed = parseRoom(roomString);
  } catch {
    return { error: "unknown_room", status: 400 };
  }

  if (parsed.kind === "family") {
    // 1. Check with security definer RPC
    const { data: isMember } = await supabase.rpc("is_family_member", {
      p_family_id: parsed.id,
      p_user_id: user.id,
    });

    if (isMember) {
      return { user, parsed, supabase };
    }

    // 2. Direct query fallback
    const { data: member } = await supabase
      .from("family_members")
      .select("id")
      .eq("family_id", parsed.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!member) {
      return { error: "not_a_member", status: 403 };
    }
  } else if (parsed.kind === "dm") {
    const { data: member } = await supabase
      .from("conversation_members")
      .select("id")
      .eq("conversation_id", parsed.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return { error: "not_a_conversation_member", status: 403 };
    }
  }

  return { user, parsed, supabase };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const room = url.searchParams.get("room");

    if (action !== "participants" || !room) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const auth = await authorizeUserAndRoom(request, room);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const config = readLiveKitConfig();
    if (!config) {
      return NextResponse.json(
        { error: "calls_not_configured", detail: "missing_livekit_secrets" },
        { status: 503 },
      );
    }

    const participants = await listParticipants(config, auth.parsed.room);
    return NextResponse.json({
      room: auth.parsed.room,
      participants,
    });
  } catch (error) {
    console.error("[Calls API GET error]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action !== "token") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      room?: string;
      canPublish?: boolean;
    };

    if (!body.room) {
      return NextResponse.json({ error: "unknown_room" }, { status: 400 });
    }

    const auth = await authorizeUserAndRoom(request, body.room);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const config = readLiveKitConfig();
    if (!config) {
      return NextResponse.json(
        { error: "calls_not_configured", detail: "missing_livekit_secrets" },
        { status: 503 },
      );
    }

    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("full_name, nickname")
      .eq("id", auth.user.id)
      .maybeSingle();

    const displayName =
      profile?.nickname?.trim() ||
      profile?.full_name?.trim() ||
      auth.user.user_metadata?.full_name ||
      "Family member";

    const canPublish = body.canPublish !== false;

    const token = await signAccessToken(config, {
      identity: auth.user.id,
      name: displayName,
      grant: {
        roomJoin: true,
        room: auth.parsed.room,
        canPublish,
        canSubscribe: true,
        canPublishData: true,
      },
      ttlSeconds: TOKEN_TTL_SECONDS,
    });

    return NextResponse.json({
      url: config.url,
      room: auth.parsed.room,
      identity: auth.user.id,
      token,
    });
  } catch (error) {
    console.error("[Calls API POST error]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

