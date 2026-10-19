"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center p-6 pt-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="font-display text-lg font-bold text-foreground">
        Something went wrong
      </h2>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        {error.message || "We encountered an unexpected issue loading this section."}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button
          onClick={() => reset()}
          className="gap-2 rounded-xl text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try Again
        </Button>
        <Button asChild variant="outline" className="gap-2 rounded-xl text-xs">
          <Link href="/home">
            <Home className="h-3.5 w-3.5" /> Home
          </Link>
        </Button>
      </div>
    </div>
  );
}

