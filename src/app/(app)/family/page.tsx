import type { Metadata } from "next";
import { FamilyOverview } from "@/components/family/family-overview";

export const metadata: Metadata = { title: "Family" };

export default function FamilyPage() {
  return <FamilyOverview />;
}
