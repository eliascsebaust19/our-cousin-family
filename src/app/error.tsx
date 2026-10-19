"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="font-display text-xl font-bold text-foreground">
        We couldn&apos;t load this page
      </h2>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
        {error.message || "An unexpected error occurred. Please try reloading."}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button
          onClick={() => reset()}
          className="gap-2 rounded-xl text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try Again
        </Button>
        <Button asChild variant="outline" className="rounded-xl text-xs">
          <Link href="/">Go to Home</Link>
        </Button>
      </div>
    </div>
  );
}

