import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

/** Centered or left-aligned mobile-first card used by all auth screens. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  align = "center",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div
      className={cn(
        "flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8",
        align === "left"
          ? "mx-auto md:mx-0 md:ml-12 lg:ml-20 xl:ml-28"
          : "mx-auto",
      )}
    >
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <div className="rounded-3xl border border-border/80 bg-card/95 p-6 shadow-xl backdrop-blur-md">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? (
        <div className="mt-5 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
