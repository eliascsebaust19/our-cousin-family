import type { Metadata } from "next";
import { MembersPanel } from "@/components/family/members-panel";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <MembersPanel initialFilter={filter} />;
}
