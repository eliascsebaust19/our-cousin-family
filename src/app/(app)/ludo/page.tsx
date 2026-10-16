import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Family Ludo" };

export default function LudoPage() {
  return (
    <ComingSoon
      title="Family Ludo"
      summary="Server-authoritative Ludo for 4, 6, or 8 players, with real board layouts for each player count — dice rolls happen on the server so nobody can cheat. Built in the next milestone."
      requires={[
        "No external accounts needed — runs entirely on Supabase",
        "The ludo Edge Functions deployed (game engine + realtime state)",
        "docs/ludo-rules.md agreed on before implementation",
      ]}
      dependsOn="Coming in Milestone 2 of the build plan."
    />
  );
}
