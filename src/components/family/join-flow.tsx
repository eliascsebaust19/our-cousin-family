"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { joinFamilySchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type PreviewStatus =
  | "not_found"
  | "revoked"
  | "expired"
  | "exhausted"
  | "already_member"
  | "pending"
  | "joinable";

type Preview = {
  status: PreviewStatus;
  family_id?: string;
  family_name?: string;
  description?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  require_approval?: boolean;
};

const PROBLEM_COPY: Record<string, string> = {
  not_found: "We couldn't find an invitation with that code.",
  revoked: "This invitation has been cancelled by the family admins.",
  expired: "This invitation has expired. Ask a family admin for a new one.",
  exhausted: "This invitation has already been used its maximum number of times.",
};

export function JoinFlow({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | undefined>();
  const checkedInitial = useRef(false);

  const lookUp = useCallback(async (value: string) => {
    const parsed = joinFamilySchema.safeParse({ code: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      setPreview(null);
      return;
    }
    setError(undefined);
    setChecking(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("preview_invitation", {
      p_code: parsed.data.code,
    });
    setChecking(false);

    if (rpcError) {
      toast.error("Could not check that code — please try again");
      return;
    }
    setPreview((data ?? null) as Preview | null);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
    });
  }, []);

  // Deep link: /join/CODE → look up immediately.
  useEffect(() => {
    if (checkedInitial.current || !initialCode) return;
    checkedInitial.current = true;
    void lookUp(initialCode);
  }, [initialCode, lookUp]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookUp(code);
  }

  async function join() {
    if (!preview?.family_name) return;
    setJoining(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("join_family_by_code", {
      p_code: code,
    });
    setJoining(false);

    if (rpcError) {
      toast.error(
        rpcError.message.includes("not_authenticated")
          ? "Please sign in to join this family"
          : rpcError.message,
      );
      return;
    }

    const payload = data as { status: string } | null;
    const status = payload?.status;

    if (status === "active") {
      toast.success("Welcome to the family!");
      router.push("/home");
      router.refresh();
      return;
    }
    if (status === "pending") {
      toast.success("Request sent — an admin will approve you soon");
      router.push("/home");
      router.refresh();
      return;
    }
    if (status === "already_member") {
      toast.message("You're already a member of this family");
      router.push("/home");
      router.refresh();
      return;
    }

    toast.error(PROBLEM_COPY[status ?? "not_found"] ?? "Could not join");
    void lookUp(code);
  }

  const authHref = (target: "login" | "signup") =>
    `/${target}?next=${encodeURIComponent(`/join/${code}`)}`;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">
          Join your family
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the invitation code a relative shared with you.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <label htmlFor="invite-code" className="sr-only">
          Invitation code
        </label>
        <Input
          id="invite-code"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          placeholder="ABC123XYZ"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          className="h-14 rounded-2xl text-center font-mono text-lg tracking-[0.3em]"
          aria-invalid={!!error}
          aria-describedby={error ? "invite-error" : undefined}
        />
        {error ? (
          <p id="invite-error" className="text-center text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="outline"
          className="h-12 w-full rounded-full"
          disabled={checking || code.length < 8}
        >
          {checking ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              Checking…
            </>
          ) : (
            "Check code"
          )}
        </Button>
      </form>

      {checking && !preview ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : null}

      {preview ? (
        preview.status === "joinable" ? (
          <div className="animate-fade-in-up rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary"
              >
                {(preview.family_name ?? "F").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-semibold">
                  {preview.family_name}
                </h2>
                {preview.require_approval ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden />
                    An admin approves new members
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You can join right away
                  </p>
                )}
              </div>
            </div>

            {preview.description ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {preview.description}
              </p>
            ) : null}

            {signedIn === null ? (
              <Skeleton className="mt-4 h-12 w-full rounded-full" />
            ) : signedIn ? (
              <Button
                className="mt-4 h-12 w-full rounded-full"
                onClick={() => void join()}
                disabled={joining}
              >
                {joining ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                    Joining…
                  </>
                ) : (
                  <>
                    <Users className="mr-1.5 h-4 w-4" aria-hidden />
                    Join {preview.family_name}
                  </>
                )}
              </Button>
            ) : (
              <div className="mt-4 space-y-2">
                <Button asChild className="h-12 w-full rounded-full">
                  <Link href={authHref("signup")}>
                    Create an account to join
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full rounded-full"
                >
                  <Link href={authHref("login")}>
                    I already have an account
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ) : preview.status === "already_member" ? (
          <Notice
            tone="success"
            title="You're already in this family"
            body="Open your feed to catch up with everyone."
            action={
              <Button asChild className="h-12 w-full rounded-full">
                <Link href="/home">Go to my feed</Link>
              </Button>
            }
          />
        ) : preview.status === "pending" ? (
          <Notice
            tone="info"
            title="Your request is waiting for approval"
            body="A family admin needs to approve you before you can see the family's posts."
            action={
              <Button asChild variant="outline" className="h-12 w-full rounded-full">
                <Link href="/home">Back to app</Link>
              </Button>
            }
          />
        ) : (
          <Notice
            tone="danger"
            title="This invitation can't be used"
            body={PROBLEM_COPY[preview.status] ?? "Something went wrong."}
            action={
              <Button
                onClick={() => {
                  setPreview(null);
                  setCode("");
                }}
                variant="outline"
                className="h-12 w-full rounded-full"
              >
                Try another code
              </Button>
            }
          />
        )
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have a code?{" "}
        <Link href="/create-family" className="font-medium text-primary">
          Create a new family
        </Link>
      </p>
    </div>
  );
}

function Notice({
  tone,
  title,
  body,
  action,
}: {
  tone: "success" | "info" | "danger";
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "info" ? Clock : ShieldAlert;
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "info"
        ? "text-brand-warm"
        : "text-destructive";

  return (
    <div className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 text-center">
      <Icon className={`mx-auto h-7 w-7 ${toneClass}`} aria-hidden />
      <h2 className="mt-2 font-display text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
