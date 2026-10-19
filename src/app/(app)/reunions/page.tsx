import type { Metadata } from "next";
import { ReunionListClient } from "@/components/reunion/reunion-list-client";

export const metadata: Metadata = {
  title: "Family Travel & Reunion Planner | Our Cousin Family",
  description:
    "Plan and coordinate family trips, Eid reunions, picnics, schedules, and headcounts.",
};

export default function ReunionsPage() {
  return <ReunionListClient />;
}

