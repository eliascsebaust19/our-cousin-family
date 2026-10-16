import Link from "next/link";
import { Logo } from "@/components/logo";

export default function JoinLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 via-brand-amber/10 to-transparent"
      />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6 pb-safe sm:px-6">
        <Link href="/" className="mx-auto" aria-label="Our Cousin Family home">
          <Logo />
        </Link>
        <div className="mt-8 flex-1">{children}</div>
      </div>
    </div>
  );
}
