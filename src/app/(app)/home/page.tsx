import type { Metadata } from "next";
import { Feed } from "@/components/feed/feed";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <Feed />;
}
