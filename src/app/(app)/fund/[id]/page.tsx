import type { Metadata } from "next";
import { FundDetailClient } from "@/components/fund/fund-detail-client";

export const metadata: Metadata = {
  title: "Fund Details & Ledger | Our Cousin Family",
  description: "View contributions, expenses, and transparent balance for this fund.",
};

export default async function FundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FundDetailClient id={id} />;
}

