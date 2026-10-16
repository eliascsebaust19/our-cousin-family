"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validation";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = resetPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setError(undefined);
    setPending(true);
    const supabase = createClient();
    const redirect = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: `${redirect}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      },
    );

    if (resetError) {
      setPending(false);
      toast.error(resetError.message);
      return;
    }

    setSentTo(parsed.data.email);
    setPending(false);
  }

  if (sentTo) {
    return (
      <div className="space-y-4 text-center">
        <span
          aria-hidden
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl"
        >
          📧
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If an account exists for{" "}
          <strong className="font-semibold text-foreground">{sentTo}</strong>,
          a reset link is on its way. The link is valid for a short time.
        </p>
        <Button asChild variant="outline" className="h-12 w-full rounded-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="email" label="Email" error={error}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
        />
      </Field>

      <Button
        type="submit"
        className="h-12 w-full rounded-full"
        disabled={pending}
      >
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
