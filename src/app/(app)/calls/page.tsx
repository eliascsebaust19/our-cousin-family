import type { Metadata } from "next";
import { CallsHome } from "@/components/calls/calls-home";

export const metadata: Metadata = { title: "Calls" };

/**
 * Call hub. The room itself is derived from the active family
 * (`family:<family_id>`), so there is nothing to configure here — the page
 * shows who is already talking and lets you walk in.
 */
export default function CallsPage() {
  return <CallsHome />;
}
