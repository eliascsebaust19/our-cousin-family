import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="relative flex min-h-dvh items-center justify-start">
      {/* Background image */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/createaccount.jpeg')" }}
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
        title="Create your account"
        subtitle="Join your family's private space — you'll need an invitation code or a family member's approval."
        footer={
          <>
            Already have an account?{" "}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </>
        }
      >
        <SignUpForm next={next} />
      </AuthCard>
    </div>
  );
}
