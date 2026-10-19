import type { Metadata } from "next";
import { FamilyTreeView } from "@/components/tree/family-tree-view";

export const metadata: Metadata = {
  title: "Family Tree | Our Cousin Family",
  description: "Interactive lineage and family tree for your cousins and relatives.",
};

export default function FamilyTreePage() {
  return <FamilyTreeView />;
}

