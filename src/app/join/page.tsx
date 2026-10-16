import type { Metadata } from "next";
import { JoinFlow } from "@/components/family/join-flow";

export const metadata: Metadata = { title: "Join a family" };

export default function JoinPage() {
  return <JoinFlow />;
}
