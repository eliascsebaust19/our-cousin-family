import type { Metadata } from "next";
import { FundListClient } from "@/components/fund/fund-list-client";

export const metadata: Metadata = {
  title: "Family Fund & Shared Expenses | Our Cousin Family",
  description:
    "Transparent bookkeeping ledger for family events, medical aid, gifts, and common expenses.",
};

export default function FundPage() {
  return <FundListClient />;
}

