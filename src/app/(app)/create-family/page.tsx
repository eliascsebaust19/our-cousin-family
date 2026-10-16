import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateFamilyForm } from "@/components/family/create-family-form";

export const metadata: Metadata = { title: "Create a family" };

export default function CreateFamilyPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/home"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-semibold">Create a family</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Start a private space for your relatives — posts, photos, chat and
        memories live here, and only members can see them.
      </p>

      <CreateFamilyForm />
    </div>
  );
}
