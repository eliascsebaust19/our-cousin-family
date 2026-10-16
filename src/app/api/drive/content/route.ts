import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Streams a Memory Vault file from Google Drive.
 *
 * The bytes themselves are served by the `vault` Edge Function, which is the
 * only place the Google credentials live. This route exists because `<img>` and
 * `<video>` cannot attach an `Authorization` header: the browser sends its
 * Supabase session cookie here instead, and the route forwards the caller's
 * access token upstream. Range requests are passed through untouched so video
 * seeking works.
 *
 * Nothing is cached: `private` responses are per-user.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const item = request.nextUrl.searchParams.get("item");
  if (!item) {
    return NextResponse.json({ error: "missing_item" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const upstreamUrl = new URL(`${baseUrl}/functions/v1/vault`);
  upstreamUrl.searchParams.set("action", "content");
  upstreamUrl.searchParams.set("item", item);

  const range = request.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        authorization: `Bearer ${session.access_token}`,
        ...(range ? { range } : {}),
      },
      cache: "no-store",
    });
  } catch {
    // The Edge Function is not deployed yet, or the project is unreachable.
    return NextResponse.json({ error: "vault_unavailable" }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    const detail = await upstream.text().catch(() => "");
    return new NextResponse(detail || "vault_error", {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/octet-stream",
  );
  headers.set("accept-ranges", upstream.headers.get("accept-ranges") ?? "bytes");
  headers.set("cache-control", "private, max-age=300");
  const passthrough = ["content-length", "content-range", "etag", "last-modified"];
  for (const name of passthrough) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
