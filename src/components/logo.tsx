import Link from "next/link";

/** App logo mark + optional wordmark. */
export function LogoMark() {
  return (
    <span
      aria-hidden
      className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <circle cx="8" cy="9" r="3.2" fill="currentColor" opacity="0.9" />
        <circle cx="16" cy="9" r="3.2" fill="currentColor" opacity="0.6" />
        <path
          d="M4 19c.8-3 3.2-4.6 6-4.6h4c2.8 0 5.2 1.6 6 4.6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label="Our Cousin Family — home"
    >
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-tight text-brand-navy dark:text-foreground">
        Our Cousin Family
      </span>
    </Link>
  );
}
