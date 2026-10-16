"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { signUpSchema } from "@/lib/validation";
import { safeNextPath } from "@/lib/safe-next";
import { Field } from "@/components/field";
import { GoogleSignInButton } from "@/components/auth/google-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignUpForm({ next }: { next?: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = signUpSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setPending(true);
    const supabase = createClient();
    const redirect = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${redirect}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`,
      },
    });

    if (error) {
      setPending(false);
      toast.error(error.message);
      return;
    }

    // Email confirmation disabled → session returned immediately.
    if (data.session) {
      router.push(safeNextPath(next));
      router.refresh();
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
          ✉️
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We sent a confirmation link to{" "}
          <strong className="font-semibold text-foreground">{sentTo}</strong>.
          Open it on this device to finish creating your account.
        </p>
        <Button asChild variant="outline" className="h-12 w-full rounded-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <GoogleSignInButton next={next} />

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="fullName" label="Full name" error={errors.fullName}>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="e.g. Ayesha Rahman"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={!!errors.fullName}
          />
        </Field>

        <Field id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
        </Field>

        <Field id="password" label="Password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
          />
        </Field>

        <Field
          id="confirmPassword"
          label="Confirm password"
          error={errors.confirmPassword}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={!!errors.confirmPassword}
          />
        </Field>

        <Button
          type="submit"
          className="h-12 w-full rounded-full"
          disabled={pending}
        >
          {pending ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to keep your family&apos;s content within the
          family.
        </p>
      </form>
    </div>
  );
}
