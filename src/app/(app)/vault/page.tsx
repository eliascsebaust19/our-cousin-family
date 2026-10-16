import { Suspense } from "react";
import type { Metadata } from "next";
import { VaultView } from "@/components/vault/vault-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Memory Vault" };

function VaultSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-3xl" />
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="aspect-square w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * The Memory Vault: a searchable photo/video archive whose bytes live in one
 * Google Drive account, mediated by the `vault` Edge Function (the only holder
 * of the Google credentials) and mirrored into Postgres for search.
 */
export default function VaultPage() {
  return (
    <Suspense fallback={<VaultSkeleton />}>
      <VaultView />
    </Suspense>
  );
}
