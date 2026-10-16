import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JoinFlow } from "@/components/family/join-flow";

export const metadata: Metadata = { title: "Join a family" };

/** Invite deep link: /join/ABC123XYZ */
export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalised = decodeURIComponent(code).toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Bare /join has its own page; keep the entry form for junk codes.
  if (!/^[A-Z0-9]{8,12}$/.test(normalised)) {
    redirect("/join");
  }

  return <JoinFlow initialCode={normalised} />;
}
