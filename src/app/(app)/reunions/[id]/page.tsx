import type { Metadata } from "next";
import { ReunionDetailClient } from "@/components/reunion/reunion-detail-client";

export const metadata: Metadata = {
  title: "Trip & Reunion Details | Our Cousin Family",
  description: "View itinerary, tasks, budget, and RSVP for the family trip.",
};

export default async function ReunionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReunionDetailClient id={id} />;
}

