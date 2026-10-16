"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.6c-.1 1.1-.9 2.7-2.5 3.8l3.9 3c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2-6.6-4.9l-4 3.1C5.3 21.4 8.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4c-.3-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4L1.4 6.5C.5 8.2 0 10.1 0 12s.5 3.8 1.4 5.5l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c2.2 0 3.7.9 4.5 1.7l3.3-3.2C17.9 1.2 15.2 0 12 0 8.4 0 5.3 2.6 3.4 6.5l4 3.1C8.3 6.7 8.9 4.7 12 4.7z"
      />
    </svg>
  );
}

/** Google sign-in / sign-up button (Supabase Auth OAuth). */
export function GoogleSignInButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setPending(true);
    const supabase = createClient();
    const redirect =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${redirect}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      },
    });
    if (error) {
      setPending(false);
      toast.error(error.message || "Could not start Google sign-in");
    }
    // On success the browser navigates away to Google.
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 w-full rounded-full"
      onClick={signInWithGoogle}
      disabled={pending}
    >
      <GoogleIcon />
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
