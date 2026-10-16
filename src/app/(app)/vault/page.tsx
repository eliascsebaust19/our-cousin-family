import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Memory Vault" };

export default function VaultPage() {
  return (
    <ComingSoon
      title="Memory Vault"
      summary="A searchable archive of the family's photos and videos, backed by your own Google Drive — organized by year, event, and who's in the picture. This feature is built in the next milestone and won't be faked before then."
      requires={[
        "A Google Cloud project with the Drive API enabled",
        "OAuth consent screen approved for your Google account",
        "The Google OAuth client ID/secret and a refresh token in Supabase secrets",
        "The vault Edge Function deployed (handles the Drive connection server-side)",
      ]}
      dependsOn="Setup guide: docs/SETUP-GOOGLE-DRIVE.md (written in this repository)."
    />
  );
}
