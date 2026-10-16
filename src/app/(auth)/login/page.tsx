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
    <AuthCard
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
  );
}
