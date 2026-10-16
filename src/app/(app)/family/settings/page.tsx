import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FamilySettingsForm } from "@/components/family/family-settings-form";

export const metadata: Metadata = { title: "Family settings" };

export default function FamilySettingsPage() {
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
        <h1 className="font-display text-xl font-semibold">Family settings</h1>
      </div>

      <FamilySettingsForm />
    </div>
  );
}
