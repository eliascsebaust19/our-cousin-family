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
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = host && !host.includes("localhost")
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || url.origin);

  const limit = rateLimit(clientKey(request, "auth-confirm"), {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.redirect(new URL("/login?error=rate_limited", origin));
  }

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
      return NextResponse.redirect(new URL(next, origin));
    }
    const isExpired = error.message.toLowerCase().includes("expired");
    const errType = isExpired ? "expired_link" : "invalid_link";
    return NextResponse.redirect(new URL(`/login?error=${errType}`, origin));
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
}
