import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Honest placeholder for features that land in a later milestone. We never
 * simulate an integration — each page states exactly what's needed.
 */
export function ComingSoon({
  title,
  summary,
  requires,
  dependsOn,
}: {
  title: string;
  summary: string;
  requires: string[];
  dependsOn?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/family"
          aria-label="Back to family"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-semibold">{title}</h1>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-amber/20">
          <Construction className="h-6 w-6 text-brand-warm" aria-hidden />
        </span>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>
        {requires.length > 0 ? (
          <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left">
            {requires.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <span aria-hidden className="mt-0.5 text-primary">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {dependsOn ? (
          <p className="mt-4 text-xs text-muted-foreground">{dependsOn}</p>
        ) : null}
        <Button asChild variant="outline" className="mt-5 h-11 rounded-full">
          <Link href="/home">Back to the family feed</Link>
        </Button>
      </div>
    </div>
  );
}

export type { LucideIcon };
