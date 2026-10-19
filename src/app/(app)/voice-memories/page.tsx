import type { Metadata } from "next";
import { VoiceMemoriesClient } from "@/components/voice/voice-memories-client";

export const metadata: Metadata = {
  title: "Voice Memories & Story Archive | Our Cousin Family",
  description:
    "Record and preserve elder stories, childhood laughs, and family history in their own voice.",
};

export default function VoiceMemoriesPage() {
  return <VoiceMemoriesClient />;
}

