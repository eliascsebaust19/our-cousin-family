import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="relative flex min-h-dvh items-center justify-start">
      {/* Background image */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/login.jpeg')" }}
      />
      {/* Left-side frosted glass blur fading to the right */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 backdrop-blur-md"
        style={{
          maskImage:
            "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0) 65%)",
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0) 65%)",
        }}
      />
      {/* Left-to-right white gradient fading out gradually towards the right */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-r from-white/95 via-white/70 to-transparent dark:from-background/95 dark:via-background/70 dark:to-transparent"
      />

      <AuthCard
        align="left"
        title="Welcome back"
        subtitle="Sign in to your family's private space."
        footer={
          <>
            New here?{" "}
            <Link
              href="/signup"
              className="font-medium text-primary hover:underline"
            >
              Create an account
            </Link>
            <span className="mx-2 text-border" aria-hidden>·</span>
            <Link
              href="/join"
              className="font-medium text-primary hover:underline"
            >
              Join with a code
            </Link>
          </>
        }
      >
        <LoginForm next={next} serverError={error} />
      </AuthCard>
    </div>
  );
}
