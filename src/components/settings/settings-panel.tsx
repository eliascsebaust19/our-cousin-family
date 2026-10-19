"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  Check,
  ChevronRight,
  Download,
  Loader2,
  LogOut,
  Moon,
  Palette,
  Shield,
  Sun,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/components/pwa/pwa-install-prompt";

type ThemeChoice = "light" | "dark" | "system";

const THEME_OPTIONS: {
  value: ThemeChoice;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Palette },
];

export function SettingsPanel() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => setMounted(true), []);

  async function signOut() {
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

  async function switchAccount() {
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

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
          <Palette className="h-4 w-4 text-primary" aria-hidden />
          Appearance
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((option) => {
            const selected = (theme ?? "system") === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!mounted}
                onClick={() => setTheme(option.value)}
                aria-pressed={selected}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-medium transition ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <option.icon className="h-4.5 w-4.5" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
        {mounted && theme === "system" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Following your device: {resolvedTheme === "dark" ? "dark" : "light"}.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          <li>
            <Link
              href="/profile/edit"
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition hover:bg-accent"
            >
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
              Edit profile
              <ChevronRight
                className="ml-auto h-4 w-4 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
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
              href="/family"
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition hover:bg-accent"
            >
              <Shield className="h-4 w-4 text-muted-foreground" aria-hidden />
              Family & privacy
              <ChevronRight
                className="ml-auto h-4 w-4 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        </ul>
      </section>

      {/* Progressive Web App / Mobile Installation Section */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
          <Download className="h-4 w-4 text-primary" aria-hidden />
          Mobile App & Installation
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Install Our Cousin Family on your phone&apos;s home screen for quick standalone access, offline support, and full-screen experience.
        </p>

        <div className="mt-3">
          {isInstalled ? (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-xs font-medium text-primary">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <span>Installed on this device as a standalone app</span>
            </div>
          ) : isInstallable ? (
            <Button
              onClick={() => void promptInstall()}
              className="h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:brightness-110"
            >
              <Download className="mr-2 h-4 w-4" /> Install to Home Screen
            </Button>
          ) : (
            <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How to install manually:</p>
              <p className="mt-1">
                • <strong>Android / Chrome / Edge:</strong> Open browser menu (⋮) and tap <em>&quot;Install app&quot;</em> or <em>&quot;Add to Home screen&quot;</em>.
              </p>
              <p className="mt-1">
                • <strong>iPhone / Safari:</strong> Tap the Share button (square with arrow) and tap <em>&quot;Add to Home Screen&quot;</em>.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Account & Session
        </h2>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-full font-medium"
          onClick={() => void switchAccount()}
          disabled={switching || signingOut}
        >
          {switching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
          ) : (
            <ArrowLeftRight className="mr-2 h-4 w-4 text-primary" />
          )}
          {switching ? "Switching account…" : "Switch Account"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void signOut()}
          disabled={signingOut || switching}
        >
          {signingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Our Cousin Family — a private space for your relatives. Only invited
          family members can ever see what&apos;s shared here.
        </p>
      </section>
    </div>
  );
}
