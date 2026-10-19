"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  ChevronRight,
  Download,
  Loader2,
  LogOut,
  Pencil,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatBirthday, upcomingBirthday } from "@/lib/format";
import { RELATIONSHIPS, ROLE_LABELS } from "@/lib/constants";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { usePwaInstall } from "@/components/pwa/pwa-install-prompt";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { FamilyLite } from "@/lib/types";

export function ProfileView() {
  const router = useRouter();
  const {
    profile,
    userId,
    families,
    memberships,
    pendingFamilies,
    setActiveFamilyId,
  } = useFamily();
  const { isInstalled, promptInstall } = usePwaInstall();
  const [online, setOnline] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      localStorage.removeItem("ocf:activeFamilyId");
      sessionStorage.clear();
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    } finally {
      window.location.href = "/login";
    }
  }

  async function handleSwitchAccount() {
    setSwitching(true);
    try {
      localStorage.removeItem("ocf:activeFamilyId");
      sessionStorage.clear();
      const supabase = createClient();
      await supabase.auth.signOut();
      const redirect = typeof window !== "undefined" ? window.location.origin : "";
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${redirect}/auth/callback`,
          queryParams: {
            prompt: "select_account",
            access_type: "offline",
          },
        },
      });
    } catch (e) {
      console.error(e);
      window.location.href = "/login";
    }
  }

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.rpc("touch_last_seen");
    void supabase
      .from("profiles")
      .select("last_seen_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data?.last_seen_at) return;
        setOnline(Date.now() - new Date(data.last_seen_at).getTime() < 150_000);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const birthday = profile.birthday
    ? upcomingBirthday(profile.birthday)
    : null;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-20 bg-gradient-to-r from-primary/25 via-brand-amber/25 to-brand-warm/20" />
        <div className="-mt-10 px-4 pb-4">
          <div className="flex items-end justify-between gap-3">
            <span className="rounded-full ring-4 ring-card">
              <UserAvatar
                path={profile.avatar_url}
                name={profile.full_name}
                size={80}
              />
            </span>
            <Button asChild size="sm" variant="outline" className="h-10 rounded-full">
              <Link href="/profile/edit">
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Edit profile
              </Link>
            </Button>
          </div>

          <div className="mt-3">
            <h1 className="font-display text-xl font-semibold">
              {profile.full_name}
              {profile.nickname ? (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  “{profile.nickname}”
                </span>
              ) : null}
            </h1>
            <p className="text-xs text-muted-foreground">
              {[
                profile.username ? `@${profile.username}` : null,
                profile.relationship
                  ? (RELATIONSHIPS[profile.relationship] ?? profile.relationship)
                  : null,
                online ? "🟢 Online" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {profile.bio ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            ) : null}
            {birthday && profile.show_birthday ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-amber/20 px-2.5 py-1 text-xs font-medium">
                <CalendarDays className="h-3.5 w-3.5 text-brand-warm" aria-hidden />
                🎂 Birthday {formatBirthday(profile.birthday!)} —{" "}
                {birthday.label.toLowerCase()}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          My families
        </h2>
        {families.length === 0 && pendingFamilies.length === 0 ? (
          <div className="mt-3 text-sm text-muted-foreground">
            <p>You&apos;re not in a family yet.</p>
            <div className="mt-3 grid gap-2">
              <Button asChild className="h-11 rounded-full">
                <Link href="/create-family">Create a family</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full">
                <Link href="/join">Join with a code</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {[...families, ...pendingFamilies].map((family: FamilyLite) => {
              const membership = memberships.find(
                (m) => m.family.id === family.id,
              );
              const pending = membership?.status === "pending";
              return (
                <li key={family.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setActiveFamilyId(family.id);
                      router.push("/home");
                    }}
                    className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-60"
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary"
                    >
                      {family.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {family.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {pending
                          ? "Waiting for approval"
                          : (ROLE_LABELS[membership?.role ?? "member"] ??
                            "Member")}
                      </span>
                    </span>
                    {pending ? null : (
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          <li>
            <Link
              href="/notifications"
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition hover:bg-accent"
            >
              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
              Notifications
              <ChevronRight
                className="ml-auto h-4 w-4 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
          <li>
            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition hover:bg-accent"
            >
              <Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
              Settings & theme
              <ChevronRight
                className="ml-auto h-4 w-4 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        </ul>
      </section>

      {families.length === 0 ? (
        <Skeleton className="hidden h-2 w-full" />
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Account & Session
        </h2>
        <div className="grid gap-2">
          {!isInstalled && (
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start rounded-xl font-medium border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              onClick={() => void promptInstall()}
            >
              <Download className="mr-3 h-4 w-4 shrink-0 text-primary" />
              <div className="flex flex-col text-left min-w-0 flex-1">
                <span className="text-xs font-semibold leading-tight">Install App on Phone</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Add to home screen for fast fullscreen access</span>
              </div>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start rounded-xl font-medium"
            onClick={() => void handleSwitchAccount()}
            disabled={switching || signingOut}
          >
            {switching ? (
              <Loader2 className="mr-3 h-4 w-4 animate-spin text-primary shrink-0" />
            ) : (
              <ArrowLeftRight className="mr-3 h-4 w-4 text-primary shrink-0" />
            )}
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="text-xs font-semibold leading-tight">Switch Account</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Log in with another Gmail or account on this phone</span>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start rounded-xl font-medium border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void handleSignOut()}
            disabled={signingOut || switching}
          >
            {signingOut ? (
              <Loader2 className="mr-3 h-4 w-4 animate-spin shrink-0" />
            ) : (
              <LogOut className="mr-3 h-4 w-4 shrink-0" />
            )}
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="text-xs font-semibold leading-tight">Log out of this ID</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Sign out of {profile.full_name || "your account"}</span>
            </div>
          </Button>
        </div>
      </section>
    </div>
  );
}
