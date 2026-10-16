import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";

export const metadata: Metadata = { title: "Edit profile" };

export default function ProfileEditPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          aria-label="Back to profile"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-semibold">Edit profile</h1>
      </div>

      <ProfileEditForm />
    </div>
  );
}
