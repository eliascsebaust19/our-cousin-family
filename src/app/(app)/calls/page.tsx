import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Calls" };

export default function CallsPage() {
  return (
    <ComingSoon
      title="Family Calls"
      summary="Audio and video rooms for the family — one tap to call everyone, built on LiveKit. This feature is wired up in the next milestone and requires your own LiveKit Cloud keys."
      requires={[
        "A free LiveKit Cloud account",
        "API key + secret added to Supabase secrets",
        "The calls Edge Function deployed (mints per-user room tokens)",
      ]}
      dependsOn="Setup guide: docs/SETUP-LIVEKIT.md (written in this repository)."
    />
  );
}
