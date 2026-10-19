"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Check, ChevronDown, Plus, Users } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ROLE_LABELS } from "@/lib/constants";
import { InstallAppButton } from "@/components/pwa/pwa-install-prompt";

function FamilyBadge({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary"
      aria-hidden
    >
      {initials || "F"}
    </span>
  );
}

export function AppHeader() {
  const {
    activeFamily,
    families,
    memberships,
    setActiveFamilyId,
    unreadNotifications,
  } = useFamily();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-safe backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-3 sm:px-6">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 touch-target items-center gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-accent"
              aria-label="Switch family"
            >
              {activeFamily ? (
                <FamilyBadge name={activeFamily.name} />
              ) : (
                <LogoMark />
              )}
              <span className="min-w-0">
                <span className="block max-w-[46vw] truncate font-display text-sm font-semibold leading-tight">
                  {activeFamily?.name ?? "Our Cousin Family"}
                </span>
                <span className="block text-[11px] leading-tight text-muted-foreground">
                  {activeFamily
                    ? families.length > 1
                      ? `${families.length} families`
                      : "Your family"
                    : "No family yet"}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </SheetTrigger>

          <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display">Your families</SheetTitle>
              <SheetDescription>
                Switch spaces, or start a new one.
              </SheetDescription>
            </SheetHeader>

            <ul className="mt-4 max-h-[45vh] space-y-1 overflow-y-auto">
              {families.map((family) => {
                const role = memberships.find(
                  (m) => m.family.id === family.id,
                )?.role;
                const isActive = activeFamily?.id === family.id;
                return (
                  <li key={family.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFamilyId(family.id);
                        setOpen(false);
                      }}
                      className={`flex w-full touch-target items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        isActive
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent hover:bg-accent"
                      }`}
                    >
                      <FamilyBadge name={family.name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {family.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {ROLE_LABELS[role ?? "member"] ?? "Member"}
                        </span>
                      </span>
                      {isActive ? (
                        <Check className="h-4 w-4 text-primary" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 grid gap-2">
              <Button asChild className="h-12 rounded-full">
                <Link href="/create-family" onClick={() => setOpen(false)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Create a family
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full">
                <Link href="/join" onClick={() => setOpen(false)}>
                  <Users className="h-4 w-4" aria-hidden />
                  Join with a code
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1.5">
          <InstallAppButton size="sm" variant="ghost" className="h-9 px-2 text-xs text-primary hover:bg-primary/10" />
          <Link
            href="/notifications"
            aria-label={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications} unread`
                : "Notifications"
            }
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-foreground/80 transition hover:bg-accent hover:text-foreground"
          >
            <Bell className="h-5 w-5" aria-hidden />
            {unreadNotifications > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-warm px-1 text-[10px] font-bold leading-none text-white">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
