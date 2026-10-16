import type { Metadata } from "next";
import { InvitationsPanel } from "@/components/family/invitations-panel";

export const metadata: Metadata = { title: "Invitations" };

export default function InvitationsPage() {
  return <InvitationsPanel />;
}
