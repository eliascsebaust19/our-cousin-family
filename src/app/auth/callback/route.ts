import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * OAuth / email-link callback: exchanges the PKCE `code` for a session,
 * then continues to the requested page.
 *
 * Configure in Supabase Auth settings (and in Google Cloud OAuth):
 *   {SITE_URL}/auth/callback
 */
export async function GET(request: Request) {
  // Unauthenticated endpoint that calls the Auth API — throttle per IP.
  const limit = rateLimit(clientKey(request, "auth-callback"), {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.redirect(
      new URL("/login?error=rate_limited", new URL(request.url).origin),
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}
