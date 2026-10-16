import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Token-hash confirmation for custom Supabase email templates that link to:
 *   {SITE_URL}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/home
 *
 * With the *default* templates ({{ .ConfirmationURL }}) links flow through
 * /auth/callback instead; both paths are supported.
 */
const ALLOWED_TYPES = new Set<EmailOtpType>([
  "signup",
  "recovery",
  "email_change",
  "invite",
  "magiclink",
]);

export async function GET(request: Request) {
  // Unauthenticated endpoint that calls the Auth API — throttle per IP.
  const limit = rateLimit(clientKey(request, "auth-confirm"), {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.redirect(
      new URL("/login?error=rate_limited", new URL(request.url).origin),
    );
  }

  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));

  if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}
