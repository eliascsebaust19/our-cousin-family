"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { FamilyProvider, useFamily } from "@/components/app/family-provider";
import { AppHeader } from "@/components/app/app-header";
import { BottomNav } from "@/components/app/bottom-nav";
import type { Membership, ProfileLite } from "@/lib/types";

function PendingBanner() {
  const { pendingFamilies } = useFamily();
  if (pendingFamilies.length === 0) return null;

  return (
    <div className="border-b border-brand-amber/30 bg-brand-amber/10">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2 text-xs text-foreground/90 sm:px-6">
        <Clock className="h-3.5 w-3.5 shrink-0 text-brand-warm" aria-hidden />
        <p className="min-w-0 flex-1 truncate">
          Waiting for approval to join{" "}
          <strong className="font-semibold">{pendingFamilies[0]!.name}</strong>
          {pendingFamilies.length > 1 ? ` (+${pendingFamilies.length - 1} more)` : ""}
        </p>
        <Link
          href="/family"
          className="shrink-0 font-semibold text-primary hover:underline"
        >
          View
        </Link>
      </div>
    </div>
  );
}

export function AppShell({
  userId,
  profile,
  memberships,
  children,
}: {
  userId: string;
  profile: ProfileLite;
  memberships: Membership[];
  children: React.ReactNode;
}) {
  return (
    <FamilyProvider
      userId={userId}
      profile={profile}
      memberships={memberships}
    >
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader />
        <PendingBanner />
        <main className="mx-auto w-full max-w-2xl flex-1 px-3 pb-32 pt-4 sm:px-6 sm:pb-28">
          {children}
        </main>
        <BottomNav />
      </div>
    </FamilyProvider>
  );
}
