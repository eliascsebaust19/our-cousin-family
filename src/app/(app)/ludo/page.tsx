import { Suspense } from "react";
import type { Metadata } from "next";
import { LudoHome } from "@/components/ludo/ludo-home";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Family Ludo" };

function LudoSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-3xl" />
      <Skeleton className="aspect-square w-full rounded-3xl" />
    </div>
  );
}

/**
 * Server-authoritative Ludo. The rules, dice, and turn order all live in
 * Postgres (see supabase/migrations/20261016060000_ludo.sql); this page only
 * renders the state the server hands back over the `ludo_*` RPCs.
 */
export default function LudoPage() {
  return (
    <Suspense fallback={<LudoSkeleton />}>
      <LudoHome />
    </Suspense>
  );
}
