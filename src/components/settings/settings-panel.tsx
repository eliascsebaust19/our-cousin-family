"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
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
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setMounted(true), []);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      toast.error(error.message);
      return;
    }
    router.push("/login");
    router.refresh();
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

      <section className="rounded-2xl border border-border bg-card p-4">
        <Button
          variant="outline"
          className="h-12 w-full rounded-full text-destructive hover:text-destructive"
          onClick={() => void signOut()}
          disabled={signingOut}
        >
          <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Our Cousin Family — a private space for your relatives. Only invited
          family members can ever see what&apos;s shared here.
        </p>
      </section>
    </div>
  );
}
